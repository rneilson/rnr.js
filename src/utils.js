/* Utility functions */

export function isCallable (fn) {
	return typeof fn === 'function' || Object.prototype.toString.call(fn) === '[object Function]';
}

