/* Tests for reactor.js */

var assert = require('chai').assert;
var rnr = require('../dist/rnr.cjs.js');

describe('Reactor', function() {

	describe('cr()', function() {

		it('should return a Reactor instance');

		it('should have a value of undefined when no initial value given');

		it('should have the given initial value after creation');

		it('should only take a function as param thenfn');

		it('should only take a function as param finalfn');

	});

	describe('set()', function() {

		it('should update the value when set');

		it('should update if value is different from previous');

		it('should not update if value is the same as previous');

		it('should update the value with the output of thenfn');

		it('should not run thenfn when the value is undefined');

	});

	describe('then()', function() {

		it('should return a new Reactor instance');

		it('should update children when parent set');

		it('should run thenfn when parent updated');

		it('should not run thenfn when parent passes undefined');

	});

	describe.skip('finally()', function(){});

	describe.skip('cancel()', function(){});

	describe.skip('persist()', function(){});

	describe.skip('attach()', function(){});

	describe.skip('detach()', function(){});

	describe.skip('clear()', function(){});

	describe.skip('crAny()', function(){});

	describe.skip('crAll()', function(){});
});
