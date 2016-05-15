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

		it('should be active after creation', function() {

			expect(a.done).to.be.false;
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

		var a, b, c;
		var counter = 0;

		it('should update the value when set', function() {

			a = rnr.cr();

			expect(a.value).to.be.undefined;

			a.set(1);

			expect(a.value).to.equal(1);
		});

		it('should update the value each time it is set', function() {

			a.set(2);

			expect(a.value).to.equal(2);

			a.set('a');

			expect(a.value).to.equal('a');
		});

		it('should not run thenfn when initial value is undefined', function() {

			b = rnr.cr(undefined, function(x) {
				counter++;
				return x + 1;
			});

			expect(counter).to.equal(0);
		});

		it('should run thenfn when updated', function() {

			b.set(0);

			expect(counter).to.equal(1);
		});

		it('should update the value with the output of thenfn', function() {

			b.set(1);

			expect(b.value).to.equal(2);
		});

		it('should not run thenfn when the passed value is undefined', function() {

			var tmpcount = counter;

			b.set(undefined);

			expect(counter).to.equal(tmpcount);

		});

		it('should update with passed value if thenfn returns undefined', function() {

			c = rnr.cr(0, function() {
				counter++;
			});

			c.set(1);

			expect(c.value).to.equal(1);
		});

	});

	describe('then()', function() {

		var counter = 0;
		var a = rnr.cr(1);
		var b = a.then();
		var c = a.then(function(x) {
			counter++;
			return x + 1;
		});

		it('should return a new Reactor instance', function() {

			expect(b).to.be.an.instanceof(rnr.Reactor);

			expect(c).to.be.an.instanceof(rnr.Reactor);
		});

		it('should be in its parent\'s child set', function() {

			var children = a.children;

			expect(children).to.include(b);

			expect(children).to.include(c);
		});

		it('should have its parent\'s current value if no thenfn given', function() {

			expect(b.value).to.equal(a.value);
		});

		it('should have the result of thenfn called with its parent\'s current value', function () {

			expect(c.value).to.equal(a.value + 1);
		});

		it('should be updated when its parent is set to a new value', function() {

			var tmpvalue = c.value;

			a.set(2);

			expect(c.value).to.not.equal(tmpvalue);

			expect(c.value).to.equal(a.value + 1);
		});

		it('should be updated only if its parent\'s new value differs from previous', function() {

			var tmpcount = counter;
			var tmpvalue = a.value;

			a.set(tmpvalue);

			expect(counter).to.equal(tmpcount);
		});

	});

	describe.skip('cancel()', function(){});

	describe.skip('finally()', function(){});

	describe.skip('persist()', function(){});

	describe.skip('attach()', function(){});

	describe.skip('detach()', function(){});

	describe.skip('clear()', function(){});

	describe.skip('crAny()', function(){});

	describe.skip('crAll()', function(){});
});
