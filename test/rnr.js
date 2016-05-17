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

		var counter = 0;
		var a, b, c, d;

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

		it('should not call thenfn when initial value is undefined', function() {

			b = rnr.cr(undefined, function(x) {
				counter++;
				return x + 1;
			});

			expect(counter).to.equal(0);
		});

		it('should call thenfn when updated', function() {

			b.set(0);

			expect(counter).to.equal(1);
		});

		it('should update the value with the output of thenfn', function() {

			b.set(1);

			expect(b.value).to.equal(2);
		});

		it('should not call thenfn when the passed value is undefined', function() {

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

		it('should call thenfn with newval and oldval', function() {

			var newvalue, oldvalue;
			d = rnr.cr(0, function(newval, oldval) {
				newvalue = newval;
				oldvalue = oldval;
				return newval;
			});
			d.set(1);

			expect(newvalue).to.equal(1);
			expect(oldvalue).to.equal(0);
		});

	});

	describe('then()', function() {

		var counter = 0;
		var a = rnr.cr(1);
		var b, c, d;

		it('should return a new Reactor instance', function() {

			b = a.then();

			expect(b).to.be.an.instanceof(rnr.Reactor);
		});

		it('should add the child to its parent\'s child set', function() {

			var children = a.children;

			expect(children).to.include(b);
		});

		it('should add another child when called again on the parent', function() {

			c = a.then(function(x) {
				counter++;
				return x + 1;
			});
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

		it('should add another child level when called on a child', function() {

			d = c.then(function(x) {
				return x + 2;
			});

			expect(c.children).to.include(d);
		});

		it('should update its child\'s value when its parent updates it', function() {

			a.set(1);

			expect(c.value).to.equal(2);
			expect(d.value).to.equal(4);
		});

	});

	describe('cancel()', function() {

		it('should set as done when cancelled', function() {

			var a = rnr.cr();
			a.cancel();

			expect(a.done).to.be.true;
		});

		it('should set the given final value when cancelled', function() {

			var a = rnr.cr(0);
			a.cancel(1);

			expect(a.value).to.equal(1);
		});

		it('should call finalfn when cancelled', function() {

			var counter = 0;
			var a = rnr.cr(0, null, function() {
				counter++;
			});
			a.cancel();

			expect(counter).to.equal(1);
		});

		it('should not call thenfn when cancelled directly', function() {

			var count1 = 0;
			var a = rnr.cr(0, function() {
				count1++;
			});
			var count2 = count1;
			a.cancel();

			expect(count1).to.equal(count2);
		});

		it('should call finalfn with finalval and oldval', function() {

			var prevval, currval;
			var a = rnr.cr(0, null, function(final, old) {
				currval = final;
				prevval = old;
			});
			a.cancel(1);

			expect(prevval).to.equal(0);
			expect(currval).to.equal(1);
		});

		it('should cancel its children when cancelled', function() {

			var a = rnr.cr();
			var b = a.then();
			var c = a.then();
			a.cancel();

			expect(b.done).to.be.true;
			expect(c.done).to.be.true;
		});

		it('should propagate cancellation down through all child levels', function() {

			var a = rnr.cr();
			var b = a.then();
			var c = b.then();
			a.cancel();

			expect(b.done).to.be.true;
			expect(c.done).to.be.true;
		});

		it('should pass the final value to its children if no finalfn given', function() {

			var a = rnr.cr(0);
			var b = a.then();
			var c = b.then();
			a.cancel(1);

			expect(b.value).to.equal(1);
			expect(c.value).to.equal(1);
		});

		it('should pass the result of finalfn to its children when cancelled', function() {

			var a = rnr.cr(0, null, function(x) {
				return x + 1;
			});
			var b = a.then();
			var c = b.then();
			a.cancel(1);

			expect(b.value).to.equal(2);
			expect(c.value).to.equal(2);
		});

		it('should autocancel when set if all children are cancelled');

		it('should call finalfn with the value passed to set() if autocancelling');

		it('should autocancel its children when set() called if their children are all cancelled');

		it('should remove cancelled children when set if any children still active');
	});

	describe.skip('finally()', function(){});

	describe.skip('persist()', function(){});

	describe.skip('attach()', function(){});

	describe.skip('detach()', function(){});

	describe.skip('clear()', function(){});

	describe.skip('crAny()', function(){});

	describe.skip('crAll()', function(){});
});
