# rnr.js
A library for cascading reactive data in Javascript (ES6)

**Please note**:
The API has changed as of version **0.5.0**. Please update dependent code accordingly.

### Overview

**rnr.js** is a library for creating and managing cascading reactive data, with an interface based loosely on Node's EventEmitter and the Promise API. It can be used to perform DOM data-binding, to replace oft-repeated Promise chains, to untangle event callback nests, to pipe data through a sequence of functions, or anything else where multiple processing steps are required whenever a value is updated. A "Reactor" -- the core class -- can be chained, branched, and cancelled, each with functions provided for updates, errors, and/or finalization. Adding a new child is as simple as calling the `on()` method.

It's perhaps easiest to consider a Reactor to be akin to a repeatable, persistent Promise. Instead of reestablishing a chain of `then()` and `catch()` each time a Promise is created, a chain (or tree) of dependent functions can be set up once, and simply rerun whenever `update()` is called with a new value on the parent Reactor.

A Reactor has any or all of three attached functions: `updatefn`, which is called when the `update()` method is called on the Reactor or its parent; `errorfn`, which is called if if an error is passed down from its parent, or it has the `error()` method called; and/or `cancelfn`, which is called when it or its parent has the `cancel()` method called. Each Reactor will subsequently call its children (if any) with the result of these functions. The `value` property stores the most recent result of `update()` or `error()`, or the final value after `cancel()`. The `iserr` property indicates if an error was passed down from its parent without `errorfn` present, or if a value was thrown by either `updatefn` or `errorfn` as appropriate.

As with Promises, a Reactor can be in one of three states: valid, error, or pending. A Reactor is in valid state when `update()` is called successfully, in error state if `updatefn` or `errorfn` throw or if `error()` is called and `errorfn` is not present or throws, and in pending state if `update()` is called with a thenable, if `updatefn` or `errorfn` return a thenable, or if the `pending` symbol is passed to `update()` or returned from `updatefn` or `errorfn`.

### Changelog

**0.5.0**:
- no more initial values during Reactor construction
  - all Reactors begin with value `undefined` and in pending state
  - no initval parameter in Reactor constructor or `cr()`
  - initial update will still be performed if parent Reactor not pending
- removed `undefined` return value checking for output of `updatefn` and `errorfn`
  - calling `update()` with `undefined` will no longer skip `updatefn`
  - returning `undefined` from `updatefn` will no longer propagate originally-passed value
  - no more `newval !== oldval` check; always cascades unless value is `hold`
- added `hold` and `pending` symbols
  - `hold` will prevent setting and propagating new value
  - `pending` will propagate pending status but retain old value
- error value stored separately from last valid result
  - `updatefn` and `errorfn` called with last valid result
  - error value cleared on next successful update
  - `.value` property returns correct value (valid or error) for current state

**0.4.4**:
- resolving a promise passed to `update()` with a value of `undefined` will now still call `updatefn`

**0.4.2**:
- `value` is no longer set to `undefined` when awaiting resolution of a thenable; `value` remains set to the previous value
- new getter property `pending` added; `true` when awaiting resolution of a thenable, `false` otherwise
- `cancel()` will reject any pending promises from `then()` with an error
- `then()` will return a rejected promise if Reactor is already cancelled
- `now()` method added, returning an immediately resolved/rejected promise with the current value, or a pending promise as per `then()` if currently awaiting resolution of a thenable

**0.4.0**:
- *thenable* objects (including but not limited to Promises) are now handled by `update()`
  - `update(thenable)` will set and propagate `undefined` for both `value` and `iserr` properties until `thenable` is resolved or rejected, at which point `value` will be set to the returned value of `thenable`, and `iserr` will be `false` if resolved, or `true` if rejected
  - if `updatefn` or `errorfn` return a promise will set `value` and `iserr` as above, until said promise is resolved or rejected
  - a promise returned by `updatefn` which is eventually rejected will set `iserr` to `true`
  - a promise returned by `errorfn` which is eventually resolved will set `iserr` to `false`
  - if `update()` or `error()` are called before `thenable` is resolved/rejected, the value will be set as normal -- however, please note that `thenable` is assumed to be non-cancelable, and therefore the intermediate value will be overwritten once `thenable` resolves or rejects
- `then()` is now available on Reactor objects, returning a promise which will be resolved or rejected on the next call to `update()` or `error()`, or when a pending thenable (as supplied to `update()`, or returned by `updatefn` or `errorfn`) is resolved or rejected
  - by default, `then()` uses the native `new Promise()` constructor; this can be overridden with a user-specified function using `Reactor.promiser()` (see below for details) in order to use another Promise-equivalent library such as Angular's `$q`
  - please note that the promise returned by `then()` will not be resolved/rejected until the Reactor's value is updated; the current value will not be automatically promisified by `then()`

**0.3.1**:
- `errorfn` no longer called if `thenfn` of same Reactor throws; error value stored directly and `error()` called on children
- value passed to `error()` and error thrown by `thenfn` now stored as value in Reactor in addition to cascading to children, with `iserr` property `true` to disambiguate from successful `update()` calls
- `iserr` determines whether `update()` (if `false`) or `error()` (if `true`) is called on children

**0.3.0**:
- `then()` renamed to `on()`
- `catch()` renamed to `onerror()`
- `finally()` renamed to `oncancel()`

### Requirements

**rnr.js** requires Node 6.0 or higher, uses rollup.js for bundling, and uses the Mocha test framework with the Chai assertion library for unit testing. These will be automatically installed as dev dependencies when installing through `npm`.

### Installation

The easiest method is simply `npm install rnr`. Manual installation is possible through `git clone https://github.com/rneilson/rnr.js.git`; however, the bundled library in the `/dist` directory requires Node to be installed, and can be built with `npm run build`.

### Importing

ES6 syntax:
```
import * as rnr from 'rnr';
```

Node/CommonJS syntax:
```
const rnr = require('rnr');
```

Three library versions are available depending on use:
- `/dist/rnr.js` ES6 native export format (recommended for use with rollup.js)
- `/dist/rnr.cjs.js` CommonJS module format (for use with Node/npm)
- `/dist/rnr.iife.js` Immediately-invoked function expression (for direct use in the browser)

### Usage

To create a new Reactor object:
```
var a = new rnr.Reactor(updatefn, errorfn, cancelfn);
```
Or use the shortcut function:
```
var a = rnr.cr(updatefn, errorfn, cancelfn);
```
To create a child of an existing Reactor:
```
var b = a.on(updatefn, errorfn, cancelfn);
```
Additional syntaxes:
```
var c = b.onerror(errorfn, cancelfn); // Equivalent to b.on(null, errorfn, cancelfn);
var d = c.oncancel(cancelfn);        // Equivalent to c.on(null, null, cancelfn);
```

Parameter | Description
--------- | -----------
`updatefn` | Function to call when `update()` is called, or if a value is passed down from parent.
`errorfn` | Function to call if `error()` method is called, or if an error is passed down from parent.
`cancelfn` | Function to call when `cancel()` method is called directly or by parent.

`updatefn`, `errorfn`, and `cancelfn` must be `null`, `undefined`, or functions with signature `fn(value, lastres)`, where `value` is the argument to `update(value)`, `error(value)`, or `cancel(value)` as appropriate, and `lastres` is the previous stored value (result of `updatefn`).

### Reactor properties

`value`  
Read-only getter; this Reactor's current value.

`iserr`  
Read-only getter; `true` if `value` is an error thrown by `updatefn` or `errorfn`, or by a call to `error()` with no `errorfn`; `false` if `value` is a value successfully returned by `updatefn` or `errorfn`, or by a call to `update()` with no `updatefn`; `undefined` if a thenable if `update()` was called with a thenable, if `updatefn` or `errorfn` returned a thenable, or if `updatefn` or `errorfn` returned the `pending` symbol.

`done`  
Read-only getter; `true` if this Reactor has been cancelled, `false` otherwise.

`persistent`  
Read-only getter; `true` if `persist()` method called on this Reactor, `false` otherwise.

`children`  
Read-only getter; array of this Reactor's current children (returns new array when accessed).

`pending`  
Read-only getter; `true` if this Reactor is in pending state, `false` otherwise.

### Reactor methods

`on(updatefn, errorfn, cancelfn)`  
Returns new Reactor as child.

`onerror(errorfn, cancelfn)`  
Equivalent to on(null, errorfn, cancelfn).

`oncancel(cancelfn)`  
Equivalent to on(null, null, cancelfn).

`onchange(updatefn, errorfn, cancelfn)`  
Returns new Reactor as child, with an intermediate function which will only update (calling `updatefn` if given) if `update()` is passed a value different (by `!==`) from the previous passed value.

`update(val, skipfn)`  
Calls `updatefn` if present and stores returned value, stores `val` if `updatefn` not present, or stores error if `updatefn` throws. `update()` (or `error()` if `updatefn` throws) are then called on children. If `skipfn` is `true`, `updatefn` will not be called. All Reactors in the tree will be locked while updating; additional calls to `update()` or `error()` during the update sequence will be ignored.

`error(val, skipfn)`  
Calls `errorfn` if present and stores returned value, stores `val` if `errorfn` not present, or stores error if `errorfn` throws. `update()` (or `error()` if `errorfn` throws) are then called on children. If `skipfn` is `true`, `errorfn` will not be called. All Reactors in the tree will be locked while updating; additional calls to `update()` or `error()` during the update sequence will be ignored.

`cancel(val, skipfn)`  
Calls `cancelfn` if present and `skipfn` is not `true`, stores returned value (or `val` if `cancelfn` not present), and cancels children. This does **not** respect locked Reactors in the tree, and thus may be called during the update sequence.

`attach(parent, skipset)`  
Adds Reactor as child of parent; will not initialize with parent's current value if `skipset` is `true`.

`detach(parent, autocancel)`  
Removes Reactor as child of `parent`; will call `cancel()` on parent if `autocancel` is `true` and no children of `parent` remain.

`clear(cancel, final)`  
Removes all children from Reactor; will call `cancel(final)` on children if `cancel` is `true`.

`then(onresolve, onreject)`  
Returns a promise to be resolved or rejected on the next call to `update()` or `error()`, or when a pending thenable (passed to `update()`, or returned from `updatefn` or `errorfn`) is resolved or rejected. This promise will be pending until the Reactor's value changes; the current value is not promisified. Calling `cancel()` will reject this promise with an error. Calling `then()` on an already-cancelled Reactor will return an immediately-rejected promise.

`catch(onreject)`  
Equivalent to `then(undefined, onreject)`.

`now(onresolve, onreject)`  
Returns a promise immediately resolved (if `iserr` `false`) or rejected (if `iserr` `true`) with the current value, or if Reactor is awaiting a pending thenable (`iserr` is `undefined`), returns a pending promise as per `then()`. Calling `now()` on an already-cancelled Reactor will return an immediately-rejected promise.

### Reactor static methods

`Reactor.uncaught(errfn)`  
Sets uncaught error handler function for all Reactor instances. Default is `null` (noop). `errfn` must be `null` or a function of signature `function (err) {...}`.

`Reactor.promiser(promisefn)`  
Sets promise constructor function used by `then()`. `promisefn` must be a function taking a single argument of `resolver` as per Promises/A+ specification, where `resolver` is a function with signature `function (resolve, reject) {...}`. Default is `function (resolver) { return new Promise(resolver); }`.

`Reactor.any(...parents)`  
Returns new Reactor with multiple parents, which is updated when any parent is updated; value is the latest value passed by any parent.

`Reactor.all(...parents)`  
Returns new Reactor with multiple parents, which is updated when any parent is updated; value is an array of the current values of all parents.

`Reactor.hold`  
Read-only getter; returns `hold` symbol. If passed to `update()` or returned (not thrown) from `updatefn` or `errorfn`, will prevent setting a new value or cascading updates to children.

`Reactor.pending`  
Read-only getter; returns `pending` symbol. If passed to `update()` or returned (not thrown) from `updatefn` or `errorfn`, will retain the last valid value but set the Reactor and any children to pending state.

Alternate syntaxes:
```
rnr.crAny(...parents); // Equivalent to Reactor.any(...parents)
rnr.crAll(...parents); // Equivalent to Reactor.all(...parents)
rnr.hold;              // Equivalent to Reactor.hold
rnr.pending;           // Equivalent to Reactor.pending
```

