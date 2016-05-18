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

