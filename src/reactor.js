import { funcOrNull, isCallable, isThenable } from './utils.js';

/* Cascading-reactor defs & helpers */

// Symbols for private properties
const _value = Symbol('_value');
const _updfn = Symbol('_updfn');
const _errfn = Symbol('_errfn');
const _canfn = Symbol('_canfn');
const _active = Symbol('_active');
const _iserr = Symbol('_iserr');
const _done = Symbol('_done');
const _persist = Symbol('_persist');
const _children = Symbol('_children');
const _locked = Symbol('_locked');
const _promise = Symbol('_promise');
const _resolve = Symbol('_resolve');
const _reject = Symbol('_reject');

// Symbols for private methods
const _addchild = Symbol('_addchild');
const _delchild = Symbol('_delchild');
const _isactive = Symbol('_isactive');
const _upd = Symbol('_upd');
const _set = Symbol('_set');

// Uncaught error handler (default noop)
let uncaughthandler = null;

// Calls uncaught error handler
function uncaughterr (err) {
	if (uncaughthandler !== null) {
		uncaughthandler(err);
	}
}

// Promise constructor (default native)
let promiseme = function(resolver) {
	return new Promise(resolver);
}

class Reactor {
	constructor(newval, updatefn, errorfn, cancelfn) {
		// Params updatefn, errorfn and cancelfn are optional
		// Must be functions if given, however

		this[_updfn] = funcOrNull(updatefn, 'updatefn');
		this[_errfn] = funcOrNull(errorfn, 'errorfn');
		this[_canfn] = funcOrNull(cancelfn, 'cancelfn');

		// Initial value
		this[_value] = undefined;
		this[_iserr] = false;

		// Start with empty child list
		this[_children] = new Set();

		// No initial promise
		this[_promise] = null;
		this[_resolve] = null;
		this[_reject] = null;

		// Lock during updates and error propagation
		this[_locked] = false;

		// Set active, default non-persistent
		this[_active] = true;
		this[_done] = false;
		this[_persist] = false;

		// If newval is another Reactor, set it as parent
		if (newval instanceof Reactor) {
			// Add this to parent's child set
			newval[_addchild](this);
			// Get initial value from parent
			this[_upd](newval.value, newval.iserr);
		}
		else {
			// Newval is standalone, no parent - use provided initial value
			this[_upd](newval, false);
		}
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
	// Parents which are reactors will be attached to, and each update() will update the returned array
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
		newcr.update(true);
		return newcr;
	}

	// Sets uncaught error handler
	static uncaught (errfn) {
		uncaughthandler = funcOrNull(errfn, 'errfn');
	}

	// Sets promise constructor/creator
	static promiser (promfn) {
		if (!isCallable(promfn)) {
			throw new Error("Promise creator must be a function!");
		}
		promiseme = resfn;
	}

	get value () {
		return this[_value];
	}

	get iserr () {
		return this[_iserr];
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

	// Returns new reactor as child of this
	on (updatefn, errorfn, cancelfn) {
		if (this[_done]) {
			throw new Error("Cannot cascade from cancelled");
		}
		return new Reactor(this, updatefn, errorfn, cancelfn);
	}

	onerror (errorfn, cancelfn) {
		return this.on(null, errorfn, cancelfn)
	}

	oncancel (cancelfn) {
		return this.on(null, null, cancelfn);
	}

	// Checks if any children are active, then updates or cancels accordingly
	update (val, skipfn) {
		// Return without modification if done or currently locked
		if (this[_done] || this[_locked]) {
			return this;
		}
		if (this[_isactive]()) {
			if (isThenable(val)) {
				// Update once thenable resolves/rejects
				val.then(res => this.update(res), rej => this.error(rej));
				// Set undefined until thenable resolves
				return this[_set]();
			}
			return this[_upd](val, false, skipfn);
		}
		return this.cancel(val);
	}

	// Checks if any children are active, then passes error value or cancels accordingly
	error (val, skipfn) {
		// Return without modification if done or currently locked
		if (this[_done] || this[_locked]) {
			return this;
		}
		if (this[_isactive]()) {
			return this[_upd](val, true, skipfn);
		}
		return this.cancel(val);
	}

	// Cancels reactor and cascades
	cancel (final, skipfn) {
		if (this[_done]) {
			return this;
		}
		// If cancelfn is set, will be called with (final, value) before
		// passing result downward
		var finalval, finalerr;
		try {
			finalval = (!skipfn && this[_canfn] !== null) ? this[_canfn](final, this[_value]) : final;
			finalerr = false;
		}
		catch (e) {
			finalval = e;
			finalerr = true;
		}
		// Reset finalval to final if _canfn() returned undefined
		finalval = (finalval !== undefined) ? finalval : final;
		this[_value] = finalval;
		this[_iserr] = finalerr;

		// Clear promise and associated resolve/reject functions
		this[_promise] = null;
		this[_resolve] = null;
		this[_reject] = null;

		// Cascade to children
		for (let child of this[_children]) {
			child.cancel(finalval);
		}

		// Clear funcs for GC (req'd?) and mark cancelled
		this[_updfn] = null;
		this[_errfn] = null;
		this[_canfn] = null;
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
			return skipset ? this : this[_upd](parent.value, parent.iserr);
		}
		// Throw if not reactor
		throw new Error("Cannot attach to non-Reactor");
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

	// Returns promise to be resolved/rejected on next update
	then (onresolve, onreject) {
		// Create new base promise if not already present
		if (this[_promise] === null) {
			this[_promise] = promiseme((res, rej) => {
				this[_resolve] = res;
				this[_reject] = rej;
			});
		}
		// Forward args to base promise's then()
		return this[_promise].then(onresolve, onreject);
	}

	// For compatibility
	catch (onreject) {
		return this.then(undefined, onreject);
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

	// Can assume if _upd or _set called that:
	// - _isactive() has already been called this sweep
	// - we can call _updfn/_errfn safely
	// - we can cancel and remove inactive children
	// - we can lock while calling _upd
	// - isThenable() has already been called on input if req'd

	[_upd] (val, iserr, skipfn) {
		this[_locked] = true;
		var oldval = this[_value];
		var valOrErr;
		// var iserr = false;

		if (val === undefined || iserr === undefined || skipfn) {
			valOrErr = val;
		}
		else {
			try {
				if (iserr === false && this[_updfn] !== null) {
					valOrErr = this[_updfn](val, oldval);
				}
				else if (iserr === true && this[_errfn] !== null) {
					valOrErr = this[_errfn](val, oldval);
					iserr = false;
				}
				// Set and pass along the raw value instead if _updfn/_errfn returns undefined
				valOrErr = (valOrErr !== undefined) ? valOrErr : val;
			}
			catch (e) {
				// Set value to error, cascade
				valOrErr = e;
				iserr = true;
			}
		}

		// Post-fn thenable check
		if (isThenable(valOrErr)) {
			// Update once thenable resolved/rejected (assume function already called)
			valOrErr.then(res => this.update(res, true), rej => this.error(rej, true));
			// Set value and error status to undefined while thenable pending
			valOrErr = undefined;
			iserr = undefined;
		}

		// Only trigger cascade if value or error status changed
		if (valOrErr !== oldval || this[_iserr] !== iserr) {
			// Set and cascade new value
			this[_set](valOrErr, iserr);
		}
		this[_locked] = false;
		return this;
	}

	[_set] (val, iserr) {
		// Set given value
		this[_value] = val;
		this[_iserr] = iserr;

		// Cascade to children if present
		if (this[_children].size > 0) {
			for (let child of this[_children]) {
				if (child[_active]) {
					if (iserr === undefined) {
						// Directly set value and error
						child[_set](val, iserr);
					}
					else {
						// Cascade as normal
						child[_upd](val, iserr);
					}
				}
				else {
					child.cancel(val);
					this[_delchild](child);
				}
			}
		}
		// Forward to uncaught handler if no children (end of branch) and no pending promise
		else if (iserr == true && val !== undefined && this[_promise] === null) {
			uncaughterr(val);
		}

		// Resolve/reject promise if pending
		if (iserr !== undefined && this[_promise] !== null) {
			if (iserr === false) {
				this[_resolve](val);
			}
			else if (iserr === true) {
				this[_reject](val);
			}
			// Clear promise and associated resolve/reject functions
			this[_promise] = null;
			this[_resolve] = null;
			this[_reject] = null;
		}

		return this;
	}
}

export { Reactor };
