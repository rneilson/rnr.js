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

			expect(goodfn).to.not.throw(/must be a function/);

			expect(badfn).to.throw(/must be a function/);
		});

		it('should only take a function as param finalfn', function() {

			var goodfn = function() {
				rnr.cr(undefined, function(){}, function(){});
			};

			var badfn = function() {
				rnr.cr(undefined, function(){}, 1);
			};

			expect(goodfn).to.not.throw(/must be a function/);

			expect(badfn).to.throw(/must be a function/);
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
			expect(b).to.not.equal(a);
		});

		it('should add the child to its parent\'s child set', function() {

			var children = a.children;

			expect(children).to.include.members([b]);
		});

		it('should add another child when called again on the parent', function() {

			c = a.then(function(x) {
				counter++;
				return x + 1;
			});
			var children = a.children;

			expect(children).to.include.members([b, c]);
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

			expect(c.children).to.include.members([d]);
		});

		it('should update its child\'s value when its parent updates it', function() {

			a.set(1);

			expect(c.value).to.equal(2);
			expect(d.value).to.equal(4);
		});

		it('should throw if thenfn throws, and error is uncaught by self or children', function() {

			a = rnr.cr(0, function(x) {
				if (x === 1) {
					throw new Error('thenfn');
				}
			});

			expect(function() {
				a.set(1);
			}).to.throw(/thenfn/);
		});

		it('should call catchfn if thenfn throws if catchfn given', function() {

			counter = 0;
			b = rnr.cr(0, function(x) {
				if (x === 1) {
					throw new Error('thenfn');
				}
			}, function(e) {
				counter++;
			});
			b.set(1);

			expect(counter).to.equal(1);
		});

		it('should pass the error to its children if no catchfn given', function() {

			counter = 0;
			b = a.then(null, function(e) {
				counter++;
			});
			a.set(1);

			expect(counter).to.equal(1);
		});

		it('should set the value to the result of catchfn', function() {

			b = a.then(null, function(e) {
				return 2;
			});
			a.set(1);

			expect(b.value).to.equal(2);
		});

		it('should pass the value to its children if catchfn returns without re-throwing', function() {

			b = a.then(null, function(e) {
				return 2;
			});
			c = b.then();
			a.set(1);

			expect(c.value).to.equal(2);
		});

		it('should throw if child\'s catchfn re-throws', function() {

			a = rnr.cr(0, function(x) {
				if (x === 1) {
					throw new Error('thenfn');
				}
			});
			b = a.then(null, function(e) {
				throw new Error('catchfn');
			});

			expect(function() {
				a.set(1);
			}).to.throw(/then/);
		});
	});

	describe('catch()', function() {

		var a = rnr.cr(0);
		var b, c, d;

		it('should return a new Reactor instance', function() {

			b = a.catch();

			expect(b).to.be.an.instanceof(rnr.Reactor);
			expect(b).to.not.equal(a);
		});

		it('should add the child to its parent\'s child set', function() {

			expect(a.children).to.include.members([b]);
		});

		it('should add another child when called again on the parent', function() {

			c = a.catch();

			expect(a.children).to.include.members([b, c]);
		});

		it('should be updated when its parent is set to a new value without throwing', function() {

			a.set(1);

			expect(b.value).to.equal(1);
			expect(c.value).to.equal(1);
		});

		it('should call catchfn if parent passes error', function() {
			var counter = 0;
			a = rnr.cr(0, function(x) {
				if (x === 1) {
					throw new Error('thenfn');
				}
			});
			b = a.catch(function(e) {
				counter++;
			});
			a.set(1);

			expect(counter).to.equal(1);
		});

		it('should set the value to the result of catchfn', function() {
			c = a.catch(function(e) {
				return 2;
			});
			a.set(1);

			expect(c.value).to.equal(2);
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
			var a = rnr.cr(0, null, null, function() {
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
			var a = rnr.cr(0, null, null, function(final, old) {
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

			var a = rnr.cr(0, null, null, function(x) {
				return x + 1;
			});
			var b = a.then();
			var c = b.then();
			a.cancel(1);

			expect(b.value).to.equal(2);
			expect(c.value).to.equal(2);
		});

		it('should autocancel when set if all children are cancelled', function() {

			var a = rnr.cr();
			var b = a.then();
			var c = a.then();
			b.cancel();
			c.cancel();
			a.set(1);

			expect(a.done).to.be.true;
		});

		it('should autocancel its children when set() called if their children are all cancelled', function() {

			var a = rnr.cr(0);
			var b = a.then();
			var c = b.then();
			c.cancel();
			a.set(1);

			expect(a.done).to.be.true;
			expect(b.done).to.be.true;
		});

		it('should call finalfn with the value passed to set() if autocancelling', function() {

			var final = 0;
			var a = rnr.cr(0, null, null, function(x) {
				final = x;
			});
			var b = a.then();
			b.cancel();
			a.set(1);

			expect(final).to.equal(1);
		});

		it('should remove cancelled children when set if any children still active', function() {

			var a = rnr.cr();
			var b = a.then();
			var c = a.then();
			c.cancel();
			a.set(1);
			var children = a.children;

			expect(a.done).to.be.false;
			expect(b.done).to.be.false;
			expect(children).to.include.members([b]);
			expect(children).to.not.include.members([c]);
		});

		it('should throw an error when then() called on cancelled', function() {

			var a = rnr.cr();
			a.cancel();

			expect(function() {
				var b = a.then();
			}).to.throw(/Cannot cascade from cancelled/);
		});
	});

	describe('finally()', function() {

		var a = rnr.cr(0);
		var b, c, d;

		it('should return a new Reactor instance', function() {

			b = a.finally();

			expect(b).to.be.an.instanceof(rnr.Reactor);
			expect(b).to.not.equal(a);
		});

		it('should add the child to its parent\'s child set', function() {

			expect(a.children).to.include.members([b]);
		});

		it('should add another child when called again on the parent', function() {

			c = a.finally();

			expect(a.children).to.include.members([b, c]);
		});

		it('should have its parent\'s final value when cancelled if no finalfn given', function() {

			a.cancel(1);

			expect(b.value).to.equal(1);
			expect(c.value).to.equal(1);
		});

		it('should have the result of finalfn called with its parent\'s final value when cancelled', function() {

			a = rnr.cr();
			b = a.finally(function(x) {
				return x + 1;
			})

			expect(b.value).to.be.undefined;

			a.cancel(1);

			expect(b.value).to.equal(2);
		});
	});

	describe('persist()', function() {

		var a, b, c;

		beforeEach(function() {
			a = rnr.cr(0);
		});

		it('should return the same object', function() {
			b = a.persist();

			expect(b).to.equal(a);
		});

		it('should set persistent to true when called without arguments', function() {

			a.persist();

			expect(a.persistent).to.be.true;
		});

		it('should set persistent to true when called with true', function() {

			a.persist(true);

			expect(a.persistent).to.be.true;
		});

		it('should set persistent to false when called with false', function() {

			a.persist(false);

			expect(a.persistent).to.be.false;
		});

		it('should not autocancel when persistent if set when all children cancelled', function() {

			a.persist();
			b = a.then();
			b.cancel();
			a.set(1);

			expect(a.done).to.be.false;
			expect(a.children).to.have.lengthOf(0);
		});

		it('should not autocancel when persistent if parent set when all children cancelled', function() {

			b = a.then().persist();
			c = b.then();
			c.cancel();
			a.set(1);

			expect(a.done).to.be.false;
			expect(a.children).to.include.members([b]);
			expect(b.done).to.be.false;
			expect(b.children).to.have.lengthOf(0);
		});
	});

	describe('attach()', function() {

		it('should throw when called on cancelled Reactor', function() {

			expect(function() {
				var a = rnr.cr();
				a.cancel();
				a.attach(0);
			}).to.throw(/Cannot attach/);
		});

		it('should throw when called with itself as arg', function() {

			expect(function() {
				var a = rnr.cr();
				a.attach(a);
			}).to.throw(/Cannot attach/);
		});

		it('should throw when called with any of its children as arg', function() {

			expect(function() {
				var a = rnr.cr();
				var b = a.then();
				a.attach(b);
			}).to.throw(/Cannot attach/);
		});

		it('should add it to new parent\'s child set', function() {

			var a = rnr.cr();
			var b = rnr.cr();
			b.attach(a);

			expect(a.children).to.include.members([b]);
		});

		it('should set initial value to new parent\'s value', function() {

			var a = rnr.cr(1);
			var b = rnr.cr(0);
			b.attach(a);

			expect(b.value).to.equal(1);
		});

		it('should not set initial value to new parent\'s value when skipset arg true', function() {

			var a = rnr.cr(1);
			var b = rnr.cr(0);
			b.attach(a, true);

			expect(b.value).to.equal(0);
		});

		it('should return the same object', function() {

			var a = rnr.cr(1);
			var b = rnr.cr(0);
			var c = b.attach(a);

			expect(c).to.equal(b);
		});

		it('should set the value to parent arg if arg is not a Reactor', function() {

			var a = rnr.cr(0);
			a.attach(1);

			expect(a.value).to.equal(1);
		});

		it('should add multiple parents if called multiple times', function() {

			var a = rnr.cr(1);
			var b = rnr.cr(2);
			var c = rnr.cr();

			c.attach(a);

			expect(c.value).to.equal(1);
			expect(a.children).to.include.members([c]);

			c.attach(b);

			expect(c.value).to.equal(2);
			expect(b.children).to.include.members([c]);

			a.set(3);
			expect(c.value).to.equal(3);

			b.set(4);
			expect(c.value).to.equal(4);
		});
	});

	describe('detach()', function() {

		var a, b;

		beforeEach(function() {
			a = rnr.cr();
			b = a.then();
		});

		it('should remove it from given parent\'s child set', function() {

			expect(a.children).to.include.members([b]);

			b.detach(a);

			expect(a.children).to.not.include.members([b]);
		});

		it('should not cancel given parent if last child removed', function() {

			b.detach(a);

			expect(a.done).to.be.false;
		});

		it('should cancel given parent if last child removed and autocancel arg true', function() {

			b.detach(a, true);

			expect(a.done).to.be.true;
		});
	});

	describe('clear()', function() {

		var a, b, c;

		beforeEach(function() {
			a = rnr.cr();
			b = a.then();
			c = a.then();
		});

		it('should remove all children from child set', function() {

			expect(a.children).to.include.members([b, c]);

			a.clear();

			expect(a.children).to.have.lengthOf(0);
		});

		it('should not autocancel self when called', function() {

			a.clear();

			expect(a.done).to.be.false;
		});

		it('should not cancel children if cancel arg not given', function() {

			a.clear();

			expect(b.done).to.be.false;
			expect(c.done).to.be.false;
		});

		it('should not cancel children if cancel arg false', function() {

			a.clear(false);

			expect(b.done).to.be.false;
			expect(c.done).to.be.false;
		});

		it('should cancel children if cancel arg true', function() {

			a.clear(true);

			expect(b.done).to.be.true;
			expect(c.done).to.be.true;
		});

		it('should use final arg when cancelling children', function() {

			a.clear(true, 1);

			expect(b.done).to.be.true;
			expect(b.value).to.equal(1);
			expect(c.done).to.be.true;
			expect(c.value).to.equal(1);
		});
	});

	describe('crAny()', function() {

		var a, b, c;
		a = rnr.cr(1);
		b = rnr.cr(2);

		it('should return a new Reactor', function() {

			c = rnr.crAny(a, b);

			expect(c).to.be.an.instanceof(rnr.Reactor);
		});

		it('should add it to all given parents\' child sets', function() {

			expect(a.children).to.include.members([c]);
			expect(b.children).to.include.members([c]);
		});

		it('should have an initial value of undefined', function() {

			expect(c.value).to.be.undefined;
		});

		it('should update when any parent set', function() {

			a.set(3);

			expect(c.value).to.equal(3);

			b.set(4);

			expect(c.value).to.equal(4);
		});
	});

	describe('crAll()', function() {

		var a, b, c;
		a = rnr.cr(1);
		b = rnr.cr(2);

		it('should return a new Reactor', function() {

			c = rnr.crAll(a, b);

			expect(c).to.be.an.instanceof(rnr.Reactor);
		});

		it('should add it to all given parents\' child sets', function() {

			expect(a.children).to.include.members([c]);
			expect(b.children).to.include.members([c]);
		});

		it('should have an initial value of an array of all parents\' values', function() {

			expect(c.value).to.eql([1, 2]);
		});

		it('should update when any parent set', function() {

			a.set(3);

			expect(c.value).to.eql([3, 2]);

			b.set(4);

			expect(c.value).to.eql([3, 4]);
		});
	});
});
