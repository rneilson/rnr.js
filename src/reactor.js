/* Cascading-reactor defs & helpers */

// Symbols for private properties
const _value = Symbol('_value');
const _parent = Symbol('_parent');
const _children = Symbol('_children');
const _then = Symbol('_then');
const _finally = Symbol('_finally');

// Symbols for private methods
const _cancel = Symbol('_cancel');
const _addchild = Symbol('_addchild');
const _delchild = Symbol('_delchild');

export class Reactor {
	constructor(newval, thenfunc, finalfunc) {
		// Params thenfunc and finalfunc are optional
		// Must be functions if given, however

		if ((thenfunc === undefined) || (thenfunc === null)) {
			this[_then] = null;
		}
		else if (typeof thenfunc === 'function') {
			this[_then] = thenfunc;
		}
		else {
			throw new Error("Param 'thenfunc' must be a function");
		}

		if ((finalfunc === undefined) || (finalfunc === null)) {
			this[_finally] = null;
		}
		else if (typeof finalfunc === 'function') {
			this[_finally] = finalfunc;
		}
		else {
			throw new Error("Param 'finalfunc' must be a function");
		}

		// Initial value
		var initval;

		// If newval is another Reactor, set it as parent
		if (newval instanceof Reactor) {
			// Add this to parent's child set
			this[_parent] = newval[_addchild](this);
			// Get initial value from parent
			initval = newval.value;
		}
		else {
			// If newval is standalone, no parent
			this[_parent] = null;
			// Use provided initial value
			initval = newval;
		}

		// Start with empty child list
		this[_children] = new Set();

		// Function thenfunc run once if present
		// and given/parent value isn't undefined
		if ((initval !== undefined) && (this[_then] !== null)) {
			this[_value] = this[_then](initval);
		}
		else {
			// Nothing to run or nothing to be run on
			// Value will be undefined if initval is
			this[_value] = initval;
		}

	}

	get value() {
		return this[_value];
	}

	set value(val) {
		var oldval = this[_value];
		var newval = (this[_then] !== null) ? this[_then](val, oldval) : val;

		// Only triggers cascade if value actually changed
		if ((newval !== oldval) && (newval !== undefined)) {
			this[_value] = newval;
			this[_children].forEach(child => {child.value = newval});
		}
		else {
			// Set and pass along the raw value instead if newval is undefined
			this[_value] = val;
			this[_children].forEach(child => {child.value = val});
		}
	}

	get parent() {
		return this[_parent];
	}

	// Leaving setter in for now
	// Might be easier for collection reactors later on if whole collection is changed and compared
	set parent(par) {
		if (this[_parent] !== par) {
			if (this[_parent] !== null) {
				// Remove from parent's child set
				this.detach();
			}
			if (par instanceof Reactor) {
				// Set new parent, add this to new parent's child set, and recalculate value
				this[_parent] = par[_addchild](this);
				// Will invoke setter and thus cascade if appropriate
				this.value = par.value;
			}
		}
	}

	// Returns new reactor with given thenfunc and/or finalfunc
	then (thenfunc, finalfunc) {
		return new Reactor(this, thenfunc, finalfunc);
	}

	// Returns new reactor with no thenfunc and given finalfunc
	finally (finalfunc) {
		return new Reactor(this, null, finalfunc);
	}

	// Cancels reactor and cascades
	// All relations, callbacks, and values cleared
	cancel (final) {
		return this[_cancel](final, false);
	}

	// Removes from parent's child set and nulls parent
	detach (skipdelete) {
		if ((!skipdelete) && (this[_parent] !== null)) {
			this[_parent][_delchild](this);
		}
		// Clear parent regardless
		this[_parent] = null;
	}

	/*
		Private(ish) methods
	*/

	// Adds child to set
	[_addchild] (child) {
		this[_children].add(child);
		return this;
	}

	// Removes child from set
	[_delchild] (child) {
		// Error if child not in set
		// TODO: make this silent failure instead?
		if (!(this[_children].delete(child))) {
			throw new Error("Child not in set when _delchild() called: " + child.toString);
		}
		return this;
	}

	// Internal portion of cancel()
	[_cancel] (final, skipdelete) {
		// If finalfunc is set, will be called with (final, value) before
		// passing result downward
		var finalval = (this[_finally] !== null) ? this[_finally](final, this[_value]) : final;
		finalval = (finalval !== undefined) ? finalval : final;

		// Cascade to children (set skipdelete to true regardless of passed arg)
		this[_children].forEach(child => child[_cancel](finalval, true));

		// Clear children
		this[_children].clear();

		// Clear parent
		// If skipdelete is true, won't call delchild() on parent
		// (so parent can clean its own child set after cascading)
		this.detach(skipdelete);

		// Clear value, thenfunc, finalfunc
		this[_value] = null;
		this[_then] = null;
		this[_finally] = null;

		// Done
		return finalval;
	}
}

export function cr (initval) {
	return new Reactor(initval);
}

