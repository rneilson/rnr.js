/* Cascading-reactor defs & helpers */

import { isCallable } from './utils.js';

// Symbols for private properties
const _value = Symbol('_value');
const _then = Symbol('_then');
const _finally = Symbol('_finally');
const _done = Symbol('_done');

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

		// Set active
		this[_done] = false;
	}

	get value () {
		return this[_value];
	}

	get done () {
		return this[_done];
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
			// Autocancel
			var cancelled = [];
			var children = _children.get(this);

			this[_value] = newval;
			for (var child of children) {
				child = child.set(newval);

				if (child.done) {
					cancelled.push(child);
				}
			}
			var len = cancelled.length;
			if (len > 0) {
				if (len == children.size) {
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
	// All relations, callbacks, and values cleared
	cancel (final) {
		if (this[_done]) {
			return this;
		}
		// If finalfn is set, will be called with (final, value) before
		// passing result downward
		var finalval = (this[_finally] !== null) ? this[_finally](final, this[_value]) : final;
		// Reset finalval to val if _finally() returned undefined
		finalval = (finalval !== undefined) ? finalval : final;

		var children = _children.get(this);
		if (children !== undefined) {
			// Cascade to children (set skipdel to true regardless of passed arg)
			for (var child of children) {
				child.cancel(finalval);
			}
		}

		// No longer necessary -- weakmap will GC once reference to this released
		// And might be useful to hold onto tree for inspection
		// children.clear();

		// Set value to final, clear thenfn/finalfn, and mark cancelled
		this[_value] = finalval;
		this[_then] = null;
		this[_finally] = null;
		this[_done] = true;

		// Done
		return this;
	}

	// Generator style (for later)
	return () {
		return this.cancel();
	}

	// Attach this to new parent
	attach (parent) {
		if (this[_done]) {
			throw new Error("Cannot attach() cancelled");
		}
		if (parent instanceof Reactor) {
			// Set new parent, add this to new parent's child set, and recalculate value
			_children.get(parent).add(this);
			// Will invoke setter and thus cascade if appropriate
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
		// Clear child set
		_children.get(this).clear();
		// Explicitly cancel children if requested
		if (cancel) {
			for (var i = 0, len = children.length; i < len; i++) {
				children[i].cancel(final);
			}
		}
		return children;
	}

}

export function cr (initval, thenfn, finalfn) {
	return new Reactor(initval, thenfn, finalfn);
}

