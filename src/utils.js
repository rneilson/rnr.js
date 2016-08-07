import { Reactor } from './reactor.js';

/* Utility functions */

export function isCallable (fn) {
	return typeof fn === 'function' || Object.prototype.toString.call(fn) === '[object Function]';
}

export function funcOrNull (fn, name) {
	if ((fn === undefined) || (fn === null)) {
		return null;
	}
	if (isCallable(fn)) {
		return fn;
	}
	throw new Error(`Param ${name} must be a function`);
}

export function isThenable (obj) {
	return obj !== undefined && obj !== null && typeof obj === 'object' && !(obj instanceof Reactor) && 'then' in obj;
}
