import { funcOrNull } from './utils.js';

/* Cascading-reactor defs & helpers */

// Symbols for private properties
const _value = Symbol('_value');
const _then = Symbol('_then');
const _finally = Symbol('_finally');
const _active = Symbol('_active');
const _done = Symbol('_done');
const _persist = Symbol('_persist');
const _children = Symbol('_children');

// Symbols for private methods
const _addchild = Symbol('_addchild');
const _delchild = Symbol('_delchild');
const _isactive = Symbol('_isactive');
const _set = Symbol('_set');

class Reactor {
	constructor(newval, thenfn, finalfn) {
		// Params thenfn and finalfn are optional
		// Must be functions if given, however

		try {
			this[_then] = funcOrNull(thenfn);
		} catch (e) {
			throw new Error("Param 'thenfn' must be a function");
		}

		try {
			this[_finally] = funcOrNull(finalfn);
		} catch (e) {
			throw new Error("Param 'finalfn' must be a function");
		}

		// Initial value
		var initval;

		// If newval is another Reactor, set it as parent
		if (newval instanceof Reactor) {
			// Add this to parent's child set
			newval[_addchild](this);
			// Get initial value from parent
			initval = newval.value;
		}
		else {
			// Newval is standalone, no parent
			// Use provided initial value
			initval = newval;
		}

		// Start with empty child list
		this[_children] = new Set();

		// Function thenfn run once if present
		// and given/parent value isn't undefined
		if ((initval !== undefined) && (this[_then] !== null)) {
			this[_value] = this[_then](initval);
		}
		else {
			// Nothing to run or nothing to be run on
			// Value will be undefined if initval is
			this[_value] = initval;
		}

		// Set active, default non-persistent
		this[_active] = true;
		this[_done] = false;
		this[_persist] = false;
	}

	// Creates new Reactor with multiple parents, with value equal to last-set parent
	// Initial value will be undefined
	static any(...parents) {
		var newcr = new Reactor();
		for (let parent of parents) {
			if (parent instanceof Reactor) {
				newcr.attach(parent, true);
			}
		}
		return newcr;
	}

	// Creates new reactor with multiple parents, with value equal to array of parent values
	// Parents which are reactors will be attached to, and each set() will update the returned array
	// Parents which are objects with a .value property will be included by reference
	// Parents which are raw values will be included in output as constants
	static all(...parents) {
		var sources = [];
		var newcr = new Reactor(undefined, () => {
			let arr = [];
			for (let source of sources) {
				arr.push(source.value);
			}
			return arr;
		});
		for (let parent of parents) {
			if (parent instanceof Reactor) {
				// Attach to parent
				newcr.attach(parent, true);
				sources.push(parent)
			}
			else if (Object.prototype.hasOwnProperty.call(parent, 'value')) {
				sources.push(parent);
			}
			else {
				// Convert raw values to container objects
				sources.push({value: parent});
			}
		}
		// Get initial values from parents
		newcr.set(true);
		return newcr;
	}

	get value () {
		return this[_value];
	}

	get done () {
		return this[_done];
	}

	get persistent () {
		return this[_persist];
	}

	get children () {
		return Array.from(this[_children]);
	}

	// Checks if any children are active, then sets or cancels accordingly
	set (val) {
		if (this[_done]) {
			return this;
		}
		if (this[_isactive]()) {
			return this[_set](val);
		}
		return this.cancel(val);
	}

	// Returns new reactor with given thenfn and/or finalfn
	then (thenfn, finalfn) {
		if (this[_done]) {
			throw new Error("Cannot cascade from cancelled");
		}
		return new Reactor(this, thenfn, finalfn);
	}

	// Returns new reactor with no thenfn and given finalfn
	finally (finalfn) {
		return this.then(null, finalfn);
	}

	// Cancels reactor and cascades
	cancel (final) {
		if (this[_done]) {
			return this;
		}
		// If finalfn is set, will be called with (final, value) before
		// passing result downward
		var finalval = (this[_finally] !== null) ? this[_finally](final, this[_value]) : final;
		// Reset finalval to final if _finally() returned undefined
		finalval = (finalval !== undefined) ? finalval : final;
		this[_value] = finalval;

		var children = this[_children];
		// Cascade to children (set skipdel to true regardless of passed arg)
		for (let child of children) {
			child.cancel(finalval);
		}

		// Clear thenfn/finalfn, and mark cancelled
		this[_then] = null;
		this[_finally] = null;
		this[_active] = false;
		this[_done] = true;
		return this;
	}

	// Must be called with explicit false to remove persistence
	// Undefined considered implicit true here
	persist (per) {
		this[_persist] = ((per === undefined) || (!!per));
		return this;
	}

	// Attach this to new parent
	// If skipset is true and parent is a Reactor, will skip setting value to parent's
	attach (parent, skipset) {
		if (this[_done]) {
			throw new Error("Cannot attach cancelled Reactor");
		}
		if (this === parent) {
			throw new Error("Cannot attach Reactor to itself");
		}
		if (this[_children].has(parent)) {
			throw new Error("Cannot attach Reactor to its child");
		}
		if (parent instanceof Reactor) {
			// Set new parent, add this to new parent's child set, and recalculate value
			parent[_addchild](this);
			// Will invoke setter and thus cascade if appropriate
			if (skipset) {
				return this;
			}
			return this.set(parent.value);
		}
		// This is now top of tree, set value and cascade as necessary
		return this.set(parent);
	}

	// Detach this from parent with optional auto-cancel if no children remain
	detach (parent, autocancel) {
		parent[_delchild](this, autocancel);
		return this;
	}

	// Clear children without self auto-cancel and optionally cancel children
	// Returns array of now-former children
	clear (cancel, final) {
		var children = this.children;
		// Clear child set
		this[_children].clear();
		// Explicitly cancel children if requested
		if (cancel) {
			for (let i = 0, len = children.length; i < len; i++) {
				children[i].cancel(final);
			}
		}
		return children;
	}

	[_addchild] (child) {
		if (this[_done]) {
			throw new Error('Cannot add child to cancelled Reactor');
		}
		this[_children].add(child);
		return this;
	}

	[_delchild] (child, autocancel) {
		var children = this[_children];
		children.delete(child);
		if ((autocancel) && (children.size == 0)) {
			return this.cancel();
		}
		return this;
	}

	[_isactive] () {
		if (this[_done]) {
			return false;
		}
		var active;
		// Default to active if no children
		if (this[_children].size == 0) {
			active = true;
		}
		else {
			// If persistent, will be active even if all children inactive
			active = this[_persist];
			for (let child of this[_children]) {
				if (child[_isactive]()) {
					active = true;
				}
			}
		}
		return this[_active] = active;
	}

	[_set] (val) {
		// Can assume if called that:
		// - _isactive() has already been called this sweep
		// - we can run thenfn safely
		// - we can cancel and remove inactive children
		var oldval = this[_value];
		// Only run thenfn if val not undefined
		var newval = ((val !== undefined) && (this[_then] !== null)) ? this[_then](val, oldval) : val;
		// Set and pass along the raw value instead if newval is undefined
		newval = (newval !== undefined) ? newval : val;

		// Only triggers cascade if value actually changed
		if (newval !== oldval) {
			this[_value] = newval;
			for (let child of this[_children]) {
				if (child[_active]) {
					child[_set](newval);
				}
				else {
					this[_delchild](child.cancel(newval));
				}
			}
		}
		return this;
	}

}

export { Reactor };
