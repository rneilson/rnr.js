/* Cascading-reactor defs & helpers */

import { isCallable } from './utils.js';

// Symbols for private properties
const _value = Symbol('_value');
const _then = Symbol('_then');
const _finally = Symbol('_finally');
const _done = Symbol('_done');
const _persist = Symbol('_persist');

// Parent->children (weak) map
const _children = new WeakMap();

export class Reactor {
	constructor(newval, thenfn, finalfn) {
		// Params thenfn and finalfn are optional
		// Must be functions if given, however

		if ((thenfn === undefined) || (thenfn === null)) {
			this[_then] = null;
		}
		else if (isCallable(thenfn)) {
			this[_then] = thenfn;
		}
		else {
			throw new Error("Param 'thenfn' must be a function");
		}

		if ((finalfn === undefined) || (finalfn === null)) {
			this[_finally] = null;
		}
		else if (isCallable(finalfn)) {
			this[_finally] = finalfn;
		}
		else {
			throw new Error("Param 'finalfn' must be a function");
		}

		// Initial value
		var initval;

		// If newval is another Reactor, set it as parent
		if (newval instanceof Reactor) {
			// Add this to parent's child set
			_children.get(newval).add(this);
			// Get initial value from parent
			initval = newval.value;
		}
		else {
			// Newval is standalone, no parent
			// Use provided initial value
			initval = newval;
		}

		// Start with empty child list
		_children.set(this, new Set());

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
		this[_persist] = false;
		this[_done] = false;
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
		return Array.from(_children.get(this));
	}

	set (val) {
		if (this[_done]) {
			return this;
		}
		var oldval = this[_value];
		// Only run thenfn if val not undefined
		var newval = ((val !== undefined) && (this[_then] !== null)) ? this[_then](val, oldval) : val;
		// Set and pass along the raw value instead if newval is undefined
		newval = (newval !== undefined) ? newval : val;

		// Only triggers cascade if value actually changed
		if (newval !== oldval) {
			this[_value] = newval;

			// Autocancel
			var cancelled = [];
			var children = _children.get(this);

			for (var child of children) {
				child = child.set(newval);

				if (child.done) {
					cancelled.push(child);
				}
			}
			var len = cancelled.length;
			if (len > 0) {
				if ((len == children.size) && (!this[_persist])) {
					// Cancel self if all children cancelled
					return this.cancel(newval);
				}
				else {
					// Cull cancelled children
					for (var i = 0; i < len; i++) {
						children.delete(cancelled[i]);
					}
				}
			}
		}
		return this;
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
		if (this[_done]) {
			throw new Error("Cannot cascade from cancelled");
		}
		return new Reactor(this, null, finalfn);
	}

	// Cancels reactor and cascades
	cancel (final) {
		if (this[_done]) {
			return this;
		}
		// If finalfn is set, will be called with (final, value) before
		// passing result downward
		var finalval = (this[_finally] !== null) ? this[_finally](final, this[_value]) : final;
		// Reset finalval to val if _finally() returned undefined
		finalval = (finalval !== undefined) ? finalval : final;
		this[_value] = finalval;

		var children = _children.get(this);
		if (children !== undefined) {
			// Cascade to children (set skipdel to true regardless of passed arg)
			for (var child of children) {
				child.cancel(finalval);
			}
		}

		// Clear thenfn/finalfn, and mark cancelled
		this[_then] = null;
		this[_finally] = null;
		this[_done] = true;
		return this;
	}

	// Generator style (for later)
	return () {
		return this.cancel();
	}

	// Attach this to new parent
	// If skipset is true and parent is a Reactor, will skip setting value to parent's
	attach (parent, skipset) {
		if (this[_done]) {
			throw new Error("Cannot attach() cancelled");
		}
		if (parent instanceof Reactor) {
			// Set new parent, add this to new parent's child set, and recalculate value
			_children.get(parent).add(this);
			// Will invoke setter and thus cascade if appropriate
			if (skipset) {
				return this;
			}
			return this.set(parent.value);
		}
		// This is now top of tree, set value and cascade as necessary
		return this.set(parent);
	}

	// Detach this from parent without auto-cancel
	detach (parent) {
		_children.get(parent).delete(this);
		return this;
	}

	// Clear children without self auto-cancel and optionally cancel children
	// Returns array of now-former children
	clear (cancel, final) {
		var children = this.children;
		if (children !== undefined) {
			// Clear child set
			_children.get(this).clear();
			// Explicitly cancel children if requested
			if (cancel) {
				for (var i = 0, len = children.length; i < len; i++) {
					children[i].cancel(final);
				}
			}
		}
		return children;
	}

	// Must be called with explicit false to remove persistence
	// Undefined considered implicit true here
	persist (per) {
		this[_persist] = ((per === undefined) || (!!per));
		return this;
	}

}

// Shortcut for 'new Reactor()'
export function cr (initval, thenfn, finalfn) {
	return new Reactor(initval, thenfn, finalfn);
}

// Creates new Reactor with multiple parents
// Will not set any initial value
export function crAny (...parents) {
	var newcr = cr();
	for (let parent of parents) {
		if (parent instanceof Reactor) {
			newcr.attach(parent, true);
		}
	}
	return newcr;
}

