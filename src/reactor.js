import { funcOrNull, isThenable } from './utils.js';

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

// Symbols for private methods
const _addchild = Symbol('_addchild');
const _delchild = Symbol('_delchild');
const _isactive = Symbol('_isactive');
const _upd = Symbol('_upd');
const _err = Symbol('_err');
const _set = Symbol('_set');

// Uncaught error handler (default noop)
let uncaughthandler = null;

// Calls uncaught error handler
function uncaughterr (err) {
	if (uncaughthandler !== null) {
		uncaughthandler(err);
	}
}

class Reactor {
	constructor(newval, updatefn, errorfn, cancelfn) {
		// Params updatefn, errorfn and cancelfn are optional
		// Must be functions if given, however

		this[_updfn] = funcOrNull(updatefn, 'updatefn');
		this[_errfn] = funcOrNull(errorfn, 'errorfn');
		this[_canfn] = funcOrNull(cancelfn, 'cancelfn');

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

		// Function updatefn run once if present
		// and given/parent value isn't undefined
		if ((initval !== undefined) && (this[_updfn] !== null)) {
			this[_value] = this[_updfn](initval);
		}
		else {
			// Nothing to run or nothing to be run on
			// Value will be undefined if initval is
			this[_value] = initval;
		}

		// Lock during updates and error propagation
		this[_locked] = false;

		// Set active, default non-persistent
		this[_active] = true;
		this[_iserr] = false;
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
			return this[_upd](val, skipfn);
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
			if (isThenable(val)) {
				// Update once thenable resolves (assumes error path for resolve or reject)
				val.then(res => this.error(res), rej => this.error(rej, true));
				// Set undefined until thenable resolves
				return this[_set]();
			}
			return this[_err](val, skipfn);
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
			if (skipset) {
				return this;
			}
			return this.update(parent.value);
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

	// Can assume if _upd, _err, or _set called that:
	// - _isactive() has already been called this sweep
	// - we can call _updfn safely
	// - we can cancel and remove inactive children
	// - we can lock while calling _upd or _err
	// - isThenable() has already been called on input

	[_upd] (val, skipfn) {
		this[_locked] = true;
		var oldval = this[_value];
		var newval;
		var iserr = false;

		if (val === undefined || skipfn || this[_updfn] === null) {
			newval = val;
		}
		else {
			try {
				// Set and pass along the raw value instead if _updfn returns undefined
				newval = this[_updfn](val, oldval);
				newval = (newval !== undefined) ? newval : val;
			}
			catch (e) {
				// Set value to error, cascade (skip this errfn)
				return this[_err](e, true);
			}
		}

		// Post-fn thenable check
		if (isThenable(newval)) {
			// Update once thenable resolved/rejected (assume function already called)
			newval.then(res => this.update(res, true), rej => this.error(rej, true));
			// Set value and error status to undefined while thenable pending
			newval = undefined;
			iserr = undefined;
		}

		// Only trigger cascade if value or error status changed
		if (newval !== oldval || this[_iserr] !== iserr) {
			// Set and cascade new value
			this[_set](newval, iserr);
		}
		this[_locked] = false;
		return this;
	}

	[_err] (err, skipfn) {
		this[_locked] = true;
		var valOrErr;
		var oldval = this[_value];
		var iserr = true;

		if (err === undefined || skipfn || this[_errfn] === null) {
			valOrErr = err;
		}
		else {
			try {
				// Call _errfn and set value to result if successful
				valOrErr = this[_errfn](err, oldval);
				valOrErr = (valOrErr !== undefined) ? valOrErr : err;
				iserr = false;
			}
			catch (e) {
				// Pass along new error if _errfn throws
				valOrErr = e;
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

		// Only trigger cascade if value or error status have changed
		if (valOrErr !== oldval || this[_iserr] !== iserr) {
			// Set and cascade new value/error
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
					if (iserr === false) {
						child[_upd](val);
					}
					else if (iserr === true) {
						child[_err](val);
					}
					else if (iserr === undefined) {
						// Directly set value and error
						child[_set](val, iserr);
					}
				}
				else {
					child.cancel(val);
					this[_delchild](child);
				}
			}
		}
		// Forward to uncaught handler if no children (end of branch)
		else if (iserr == true && val !== undefined) {
			uncaughterr(val);
		}

		return this;
	}
}

export { Reactor };
