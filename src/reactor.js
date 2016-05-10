/* Cascading-reactor defs & helpers */

// Symbols for private properties
const _value = Symbol('_value');
const _parent = Symbol('_parent');
const _children = Symbol('_children');
const _then = Symbol('_then');
const _finally = Symbol('_finally');
const _active = Symbol('_active');

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
			initval = newval.get();
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

		// Set active
		this[_active] = true;
	}

	get active () {
		return this[_active];
	}

	get () {
		return this[_value];
	}

	set (val) {
		if (this[_active]) {
			var oldval = this[_value];
			var newval = (this[_then] !== null) ? this[_then](val, oldval) : val;

			// Only triggers cascade if value actually changed
			if ((newval !== oldval) && (newval !== undefined)) {
				this[_value] = newval;
				this[_children].forEach(child => child.set(newval));
			}
			// Set and pass along the raw value instead if newval is undefined
			else {
				this[_value] = val;
				this[_children].forEach(child => child.set(val));
			}
			return this[_value];
		}
		throw new Error("Cannot set() cancelled");
	}

	// Returns new reactor with given thenfunc and/or finalfunc
	then (thenfunc, finalfunc) {
		if (this[_active]) {
			return new Reactor(this, thenfunc, finalfunc);
		}
		throw new Error("Cannot cascade from cancelled");
	}

	// Returns new reactor with no thenfunc and given finalfunc
	finally (finalfunc) {
		if (this[_active]) {
			return new Reactor(this, null, finalfunc);
		}
		throw new Error("Cannot cascade from cancelled");
	}

	// Cancels reactor and cascades
	// All relations, callbacks, and values cleared
	cancel (final) {
		return this[_cancel](final, false);
	}

	// Sets new parent (or null) and recalculates value if req'd
	// Returns new parent
	attach (par) {
		if (this[_active]) {
			if (this[_parent] !== par) {
				if (this[_parent] !== null) {
					// Remove from parent's child set
					this.detach();
				}
				if (par instanceof Reactor) {
					// Set new parent, add this to new parent's child set, and recalculate value
					this[_parent] = par[_addchild](this);
					// Will invoke setter and thus cascade if appropriate
					this.set(par.get());
				}
			}
			return this[_parent];
		}
		throw new Error("Cannot attach() cancelled");
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
		if (this[_active]) {
			// If finalfunc is set, will be called with (final, value) before
			// passing result downward
			var finalval = (this[_finally] !== null) ? this[_finally](final, this[_value]) : final;
			// Reset finalval to val if _finally() returned undefined
			finalval = (finalval !== undefined) ? finalval : final;

			// Cascade to children (set skipdel to true regardless of passed arg)
			this[_children].forEach(child => child[_cancel](finalval, true));

			// Clear children
			this[_children].clear();

			// Clear parent
			// If skipdel is true, won't call delchild() on parent
			// (so parent can clean its own child set after cascading)
			this.detach(skipdel);

			// Clear value, thenfunc, finalfunc, and mark cancelled
			this[_value] = undefined;
			this[_then] = null;
			this[_finally] = null;
			this[_active] = false;

			// Done
			return finalval;
		}
		return undefined;
	}
}

export function cr (initval) {
	return new Reactor(initval);
}

