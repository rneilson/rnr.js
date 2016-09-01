import { Reactor } from './reactor.js';

/* Utility functions */

export function funcOrNull (fn, name) {
	if ((fn === undefined) || (fn === null)) {
		return null;
	}
	if (typeof fn === 'function') {
		return fn;
	}
	throw new Error(`Param ${name} must be a function`);
}

export function isThenable (obj) {
	return obj !== undefined && obj !== null && typeof obj === 'object' && !(obj instanceof Reactor) && 'then' in obj;
}
