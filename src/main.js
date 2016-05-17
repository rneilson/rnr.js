import { Reactor } from './reactor.js';

/* Shortcut functions */

function cr (...args) {
	return new Reactor(...args);
}

function crAny (...args) {
	return Reactor.any(...args);
}

function crAll (...args) {
	return Reactor.all(...args);
}

export { cr, crAny, crAll, Reactor };

