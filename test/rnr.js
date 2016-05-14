/* Tests for reactor.js */

var assert = require('chai').assert;
var rnr = require('../dist/rnr.cjs.js');

describe('Reactor', function() {

	describe('cr()', function() {

		it('should return a Reactor instance');

		it('should have a value of undefined to start');

		it('should have a value after being set');

	});

	describe('cr(val)', function() {

		it('should have the initial value after creation');

		it('should update the value when set');
	});

	describe('set()', function() {

		it('should update if value is different from previous');

		it('should not update if value is the same as previous');
	});

	describe('then()', function() {

		it('should update children when parent set');

		it('should run the function when updated');

		it('should not run the function when the input is undefined');
	});
});
