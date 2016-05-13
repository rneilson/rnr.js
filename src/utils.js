/* Utility functions */

export function isCallable (fn) {
	return typeof fn === 'function' || Object.prototype.toString.call(fn) === '[object Function]';
}

export function funcOrNull (fn) {
	if ((fn === undefined) || (fn === null)) {
		return null;
	}
	if (isCallable(fn)) {
		return fn;
	}
	throw new Error("Param 'fn' must be a function");
}

