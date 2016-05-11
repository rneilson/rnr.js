/* Cascading-reactor defs & helpers */

import { isCallable } from './utils.js';

// Symbols for private properties
const _value = Symbol('_value');
const _parent = Symbol('_parent');
const _children = Symbol('_children');
const _then = Symbol('_then');
const _finally = Symbol('_finally');
const _done = Symbol('_done');

// Symbols for private methods
const _cancel = Symbol('_cancel');
const _addchild = Symbol('_addchild');
const _delchild = Symbol('_delchild');

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

		// Set active
		this[_done] = false;
	}

	get done () {
		return this[_done];
	}

	get parent () {
		return this[_parent];
	}

	get children () {
		return Array.from(this[_children]);
	}

	get value () {
		return this[_value];
	}

	set (val) {
		if (this[_done]) {
			throw new Error("Cannot set() cancelled");
		}
		var oldval = this[_value];
		// Only run thenfn if val not undefined
		var newval = ((val !== undefined) && (this[_then] !== null)) ? this[_then](val, oldval) : val;
		// Set and pass along the raw value instead if newval is undefined
		newval = (newval !== undefined) ? newval : val;

		// Autocancel
		var cancelled = false;

		// Only triggers cascade if value actually changed
		if (newval !== oldval) {
			this[_value] = newval;
			for (var child of this[_children]) {
				if (child.done) {
					this[_children].delete(child);
					cancelled = true;
				}
				else {
					child.set(newval);
				}
			}
		}
		// Cancel self if all children cancelled
		if ((cancelled) && (this[_children].size === 0)) {
			return this[_cancel](newval, false);
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
	// All relations, callbacks, and values cleared
	cancel (final) {
		return this[_cancel](final, false);
	}

	return () {
		return this.cancel();
	}

	// Sets new parent (or null) and recalculates value if req'd
	// Returns new parent
	attach (par) {
		if (this[_done]) {
			throw new Error("Cannot attach() cancelled");
		}
		if (this[_parent] !== par) {
			if (this[_parent] !== null) {
				// Remove from parent's child set
				this.detach();
			}
			if (par instanceof Reactor) {
				// Set new parent, add this to new parent's child set, and recalculate value
				this[_parent] = par[_addchild](this);
				// Will invoke setter and thus cascade if appropriate
				this.set(par.value);
			}
		}
		return this[_parent];
	}

	// Removes from parent's child set and nulls parent
	// Returns old parent
	detach (skipdel) {
		if ((!skipdel) && (this[_parent] !== null)) {
			this[_parent][_delchild](this);
		}
		// Clear parent regardless
		var par = this[_parent];
		this[_parent] = null;
		return par;
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
	[_cancel] (final, skipdel) {
		if (this[_done]) {
			return this;
		}
		// If finalfn is set, will be called with (final, value) before
		// passing result downward
		var finalval = (this[_finally] !== null) ? this[_finally](final, this[_value]) : final;
		// Reset finalval to val if _finally() returned undefined
		finalval = (finalval !== undefined) ? finalval : final;

		// Cascade to children (set skipdel to true regardless of passed arg)
		for (var child of this[_children]) {
			child[_cancel](finalval, true);
		}

		// Clear children
		this[_children].clear();

		// Clear parent
		// If skipdel is true, won't call delchild() on parent
		// (so parent can clean its own child set after cascading)
		this.detach(skipdel);

		// Set value to final, clear thenfn/finalfn, and mark cancelled
		this[_value] = finalval;
		this[_then] = null;
		this[_finally] = null;
		this[_done] = true;

		// Done
		return this;
	}
}

export function cr (initval, thenfn, finalfn) {
	return new Reactor(initval, thenfn, finalfn);
}

