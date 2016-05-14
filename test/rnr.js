/* Tests for reactor.js */

var expect = require('chai').expect;
var rnr = require('../dist/rnr.cjs.js');

describe('Reactor', function() {

	describe('cr()', function() {

		var a = rnr.cr();

		it('should return a Reactor instance', function() {

			expect(a).to.be.an.instanceof(rnr.Reactor);
		});

		it('should have a value of undefined when no initial value given', function() {

			expect(a.value).to.be.undefined;
		});

		it('should have the given initial value after creation', function() {

			a = rnr.cr(1);

			expect(a.value).to.equal(1);
		});

		it('should only take a function as param thenfn', function() {

			var goodfn = function() {
				rnr.cr(undefined, function(){});
			};

			var badfn = function() {
				rnr.cr(undefined, 1);
			};

			expect(goodfn).to.not.throw(Error);

			expect(badfn).to.throw(Error);
		});

		it('should only take a function as param finalfn', function() {

			var goodfn = function() {
				rnr.cr(undefined, function(){}, function(){});
			};

			var badfn = function() {
				rnr.cr(undefined, function(){}, 1);
			};

			expect(goodfn).to.not.throw(Error);

			expect(badfn).to.throw(Error);
		});

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
