# rnr.js
A library for cascading reactive data in Javascript (ES6)

**Please note**:
This project is a work in progress. The base API *should* remain stable as additional features are added, but it's not guaranteed.

### Overview

**rnr.js** is a library for creating and managing cascading reactive data, with an interface based on the Promise API. It can be used to perform DOM data-binding, to replace oft-repeated Promise chains, to untangle event callback nests, to pipe data through a sequence of functions, or anything else where multiple processing steps are required whenever a value is updated. A "Reactor" -- the core class -- can be chained, branched, and cancelled, each with functions provided for updates, errors, and/or finalization. Adding a new child is as simple as calling the `then()` method.

It's perhaps easiest to consider a Reactor to be akin to a repeatable, persistent Promise. Instead of reestablishing a chain of `then()` and `catch()` each time a Promise is created, a chain (or tree) of dependent functions can be set up once, and simply rerun whenever `update()` is called with a new value on the parent Reactor.

A Reactor has any or all of three attached functions: `thenfn`, which is called when the `update()` method is called on the Reactor or its parent; `catchfn`, which is called if `thenfn` throws an error or if an error is passed down from its parent; and/or `finalfn`, which is called when it or its parent has the `cancel()` method called. Each Reactor will subsequently call its children (if any) with the result of these functions. The `value` property stores the most recent result of `then()`, the value returned by `catchfn` if it does not re-throw, or the final value after `cancel()`.

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
var rnr = require('rnr');
```

Three library versions are available depending on use:
- `/dist/rnr.js` ES6 native export format (recommended for use with rollup.js)
- `/dist/rnr.cjs.js` CommonJS module format (for use with Node/npm)
- `/dist/rnr.iife.js` Immediately-invoked function expression (for direct use in the browser)

### Usage

To create a new Reactor object:
```
var a = new rnr.Reactor(initval, thenfn, catchfn, finalfn);
```
Or use the shortcut function:
```
var a = rnr.cr(initval, thenfn, catchfn, finalfn);
```
To create a child of an existing Reactor:
```
var b = a.then(thenfn, catchfn, finalfn);
```
Additional syntaxes:
```
var c = b.catch(catchfn, finalfn); // Equivalent to b.then(null, catchfn, finalfn);
var d = c.finally(finalfn);        // Equivalent to c.then(null, null, finalfn);
```

Parameter | Description
--------- | -----------
`initval` | Initial value *or* parent Reactor.
`thenfn` | Function to call when updated. Unless `undefined`, Will be called with `initval`, or its `value` property if a Reactor.
`catchfn` | Function to call if `thenfn` throws, or an uncaught error is passed down from parent.
`finalfn` | Function to call when `cancel()` method is called directly or by parent.

### Reactor properties

`value`
Read-only getter; Reactor's current value.

`done`
Read-only getter; `true` if Reactor has been cancelled, `false` otherwise.

`persistent`
Read-only getter; `true` if `persist()` method called on this Reactor, `false` otherwise.

`children`
Read-only getter; array of Reactor's current children (returns new array when accessed).

### Reactor methods

`then(thenfn, catchfn, finalfn)`
Returns new Reactor as child.

`catch(catchfn, finalfn)`
Equivalent to then(null, catchfn, finalfn).

`finally(finalfn)`
Equivalent to then(null, null, finalfn).

`update(val)`
Calls `thenfn` if present, stores returned value (or given if no `thenfn`), and updates children.

`error(val)`
Calls `catchfn` if present, stores returned value (if `catchfn`) and updates children. If no `catchfn`, calls `error(val)` on children.

`cancel(val)`
Calls `finalfn` if present, stores returned value (or given if no `finalfn`), and cancels children.

`attach(parent, skipset)`
Adds Reactor as child of parent; will not initialize with parent's current value if `skipset` is `true`.

`detach(parent, autocancel)`
Removes Reactor as child of `parent`; will call `cancel()` on parent if `autocancel` is `true` and no children of `parent` remain.

`clear(cancel, final)`
Removes all children from Reactor; will call `cancel(final)` on children if `cancel` is `true`.

### Reactor static methods

`Reactor.any(...parents)`
Returns new Reactor with multiple parents, which is updated when any parent is updated; value is the latest value passed by any parent.

`Reactor.all(...parents)`
Returns new Reactor with multiple parents, which is updated when any parent is updated; value is an array of the current values of all parents.

Alternate syntaxes:
```
crAny(...parents); // Equivalent to Reactor.any(...parents)
crAll(...parents); // Equivalent to Reactor.all(...parents)
```

