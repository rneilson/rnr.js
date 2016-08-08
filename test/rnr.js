/* Tests for reactor.js */

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
// var should = chai.should();
var rnr = require('../dist/rnr.cjs.js');

describe('Reactor', function() {

	// Override default uncaught error handler
	var uncaught;
	rnr.Reactor.uncaught(function(err) {
		uncaught = err;
	});

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

		it('should only take a function as param updatefn', function() {

			var goodfn = function() {
				rnr.cr(undefined, function(){});
			};

			var badfn = function() {
				rnr.cr(undefined, 1);
			};

			expect(goodfn).to.not.throw(/must be a function/);

			expect(badfn).to.throw(/must be a function/);
		});

		it('should only take a function as param cancelfn', function() {

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

	describe('update()', function() {

		var counter = 0;
		var a, b, c, d;

		it('should update the value when called', function() {

			a = rnr.cr();

			expect(a.value).to.be.undefined;

			a.update(1);

			expect(a.value).to.equal(1);
		});

		it('should update the value each time it is called', function() {

			a.update(2);

			expect(a.value).to.equal(2);

			a.update('a');

			expect(a.value).to.equal('a');
		});

		it('should not call updatefn when initial value is undefined', function() {

			b = rnr.cr(undefined, function(x) {
				counter++;
				return x + 1;
			});

			expect(counter).to.equal(0);
		});

		it('should call updatefn when updated', function() {

			b.update(0);

			expect(counter).to.equal(1);
		});

		it('should update the value with the output of updatefn', function() {

			b.update(1);

			expect(b.value).to.equal(2);
		});

		it('should not call updatefn when the passed value is undefined', function() {

			var tmpcount = counter;
			b.update(undefined);

			expect(counter).to.equal(tmpcount);

		});

		it('should update with passed value if updatefn returns undefined', function() {

			c = rnr.cr(0, function() {
				counter++;
			});
			c.update(1);

			expect(c.value).to.equal(1);
		});

		it('should call updatefn with given and previous values', function() {

			var newvalue, oldvalue;
			d = rnr.cr(0, function(newval, oldval) {
				newvalue = newval;
				oldvalue = oldval;
				return newval;
			});
			d.update(1);

			expect(newvalue).to.equal(1);
			expect(oldvalue).to.equal(0);
		});

	});

	describe('on()', function() {

		var counter = 0;
		var a = rnr.cr(1);
		var b, c, d;

		it('should return a new Reactor instance', function() {

			b = a.on();

			expect(b).to.be.an.instanceof(rnr.Reactor);
			expect(b).to.not.equal(a);
		});

		it('should add the child to its parent\'s child set', function() {

			var children = a.children;

			expect(children).to.include.members([b]);
		});

		it('should add another child when called again on the parent', function() {

			c = a.on(function(x) {
				counter++;
				return x + 1;
			});
			var children = a.children;

			expect(children).to.include.members([b, c]);
		});

		it('should have its parent\'s current value if no updatefn given', function() {

			expect(b.value).to.equal(a.value);
		});

		it('should have the result of updatefn called with its parent\'s current value', function () {

			expect(c.value).to.equal(a.value + 1);
		});

		it('should be updated when its parent is updated to a new value', function() {

			var tmpvalue = c.value;
			a.update(2);

			expect(c.value).to.not.equal(tmpvalue);
			expect(c.value).to.equal(a.value + 1);
		});

		it('should be updated only if its parent\'s new value differs from previous', function() {

			var tmpcount = counter;
			var tmpvalue = a.value;
			a.update(tmpvalue);

			expect(counter).to.equal(tmpcount);
		});

		it('should add another child level when called on a child', function() {

			d = c.on(function(x) {
				return x + 2;
			});

			expect(c.children).to.include.members([d]);
		});

		it('should update its child\'s value when its parent updates it', function() {

			a.update(1);

			expect(c.value).to.equal(2);
			expect(d.value).to.equal(4);
		});

		it('should have the value thrown if updatefn throws', function() {

			a = rnr.cr(0, function(x) {
				if (x === 1) {
					throw 'updatefn';
				}
			});
			a.update(1);

			expect(a.value).to.equal('updatefn');
		});

		it('should have iserr property true if updatefn throws', function() {

			expect(a.iserr).to.be.true;
		});

		it('should not call its own errorfn when updatefn throws if errorfn given', function() {

			counter = 0;
			b = rnr.cr(0, function(x) {
				if (x === 1) {
					throw new Error('updatefn');
				}
			}, function(e) {
				counter++;
			});
			b.update(1);

			expect(counter).to.equal(0);
		});

		it('should pass the error to its children if no errorfn given', function() {

			counter = 0;
			a.update(0);
			b = a.on(null, function(e) {
				counter++;
				return e;
			});
			a.update(1);

			expect(counter).to.equal(1);
			expect(b.value).to.equal('updatefn');
		});

		it('should set the value to the result of errorfn if its parent\'s updatefn throws', function() {

			a.update(0);
			b = a.on(null, function(e) {
				return 2;
			});
			a.update(1);

			expect(b.value).to.equal(2);
		});

		it('should have iserr property false if its parent\'s updatefn throws and its errorfn returns a value', function() {

			expect(b.iserr).to.be.false;
		});

		it('should pass the value returned from errorfn to its children', function() {

			a.update(0);
			b = a.on(null, function(e) {
				return 2;
			});
			c = b.on();
			a.update(1);

			expect(c.value).to.equal(2);
		});

		it('should call uncaught handler if child\'s errorfn re-throws and is not caught', function() {

			a = rnr.cr(0, function(x) {
				if (x === 1) {
					throw new Error('updatefn');
				}
			});
			b = a.on(null, function(e) {
				throw 'errorfn';
			});
			a.update(1);

			expect(uncaught).to.equal('errorfn');
		});
	});

	describe('onerror()', function() {

		var a = rnr.cr(0);
		var b, c, d;

		it('should return a new Reactor instance', function() {

			b = a.onerror();

			expect(b).to.be.an.instanceof(rnr.Reactor);
			expect(b).to.not.equal(a);
		});

		it('should add the child to its parent\'s child set', function() {

			expect(a.children).to.include.members([b]);
		});

		it('should add another child when called again on the parent', function() {

			c = a.onerror();

			expect(a.children).to.include.members([b, c]);
		});

		it('should be updated when its parent is updated to a new value without throwing', function() {

			a.update(1);

			expect(b.value).to.equal(1);
			expect(c.value).to.equal(1);
		});

		it('should call errorfn if parent passes error', function() {
			var counter = 0;
			a = rnr.cr(0, function(x) {
				if (x === 1) {
					throw new Error('updatefn');
				}
			});
			b = a.onerror(function(e) {
				counter++;
			});
			a.update(1);

			expect(counter).to.equal(1);
		});

		it('should set the value to the result of errorfn', function() {
			c = a.onerror(function(e) {
				return 2;
			});
			a.update(1);

			expect(c.value).to.equal(2);
		});
	});

	describe('error()', function() {

		var a;

		it('should have the given value if no errorfn', function() {

			a = rnr.cr(0);

			expect(a.value).to.equal(0);

			a.error(1);

			expect(a.value).to.equal(1);
		});

		it('should have iserr property true if no errorfn', function() {

			expect(a.iserr).to.be.true;
		});

		it('should call errorfn when error() called', function() {

			var counter = 0;
			a = rnr.cr(0, null, function(e) {
				counter++;
			});
			a.error(1);

			expect(counter).to.equal(1);
		});

		it('should call errorfn with given and previous values', function() {

			var newvalue, oldvalue;
			a = rnr.cr(0, null, function(newval, oldval) {
				newvalue = newval;
				oldvalue = oldval;
				return newval;
			});
			a.error(1);

			expect(newvalue).to.equal(1);
			expect(oldvalue).to.equal(0);
		});

		it('should update the value to the output of errorfn', function() {

			a = rnr.cr(0, null, function(x) {
				return x + 1;
			});
			a.error(1);

			expect(a.value).to.equal(2);
		});

		it('should have iserr equal false if errorfn returns a value', function() {

			expect(a.iserr).to.be.false;
		});

		it('should have iserr equal true if errorfn throws', function() {

			a = rnr.cr(undefined, null, function(x) {
				throw x + 1;
			});
			a.error(1);

			expect(a.value).to.equal(2);
			expect(a.iserr).to.be.true;
		});

		it('should pass the value returned by errorfn to its children', function() {

			a = rnr.cr(0, null, function(x) {
				return x + 1;
			});
			var b = a.on();
			a.error(1);

			expect(b.value).to.equal(2);
		});

		it('should call its childrens\' _err() if no errorfn', function() {

			var counter = 0;
			a = rnr.cr(0);
			var b = a.onerror(function(e) {
				counter++;
			});
			a.error(1);

			expect(counter).to.equal(1);
		});

		it('should call its childrens\' _err() if errorfn throws', function() {

			var counter = 0;
			a = rnr.cr(undefined, null, function(x) {
				throw x + 1;
			});
			var b = a.onerror(function(e) {
				counter++;
			});
			a.error(1);

			expect(counter).to.equal(1);
			expect(b.value).to.equal(2);
			expect(b.iserr).to.be.false;
		});

		it('should call uncaught handler if no errorfn in it or its or children', function() {

			a = rnr.cr(0);
			var b = a.on();

			a.error(1);

			expect(a.value).to.equal(1);
			expect(a.iserr).to.be.true;
			expect(b.value).to.equal(1);
			expect(b.iserr).to.be.true;
			expect(uncaught).to.equal(1);
		});
	});

	describe('cancel()', function() {

		it('should be done when cancelled', function() {

			var a = rnr.cr();
			a.cancel();

			expect(a.done).to.be.true;
		});

		it('should have the given final value when cancelled', function() {

			var a = rnr.cr(0);
			a.cancel(1);

			expect(a.value).to.equal(1);
		});

		it('should call cancelfn when cancelled', function() {

			var counter = 0;
			var a = rnr.cr(0, null, null, function() {
				counter++;
			});
			a.cancel();

			expect(counter).to.equal(1);
		});

		it('should not call updatefn when cancelled directly', function() {

			var count1 = 0;
			var a = rnr.cr(0, function() {
				count1++;
			});
			var count2 = count1;
			a.cancel();

			expect(count1).to.equal(count2);
		});

		it('should call cancelfn with finalval and oldval', function() {

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
			var b = a.on();
			var c = a.on();
			a.cancel();

			expect(b.done).to.be.true;
			expect(c.done).to.be.true;
		});

		it('should propagate cancellation down through all child levels', function() {

			var a = rnr.cr();
			var b = a.on();
			var c = b.on();
			a.cancel();

			expect(b.done).to.be.true;
			expect(c.done).to.be.true;
		});

		it('should pass the final value to its children if no cancelfn given', function() {

			var a = rnr.cr(0);
			var b = a.on();
			var c = b.on();
			a.cancel(1);

			expect(b.value).to.equal(1);
			expect(c.value).to.equal(1);
		});

		it('should pass the result of cancelfn to its children when cancelled', function() {

			var a = rnr.cr(0, null, null, function(x) {
				return x + 1;
			});
			var b = a.on();
			var c = b.on();
			a.cancel(1);

			expect(b.value).to.equal(2);
			expect(c.value).to.equal(2);
		});

		it('should autocancel when set if all children are cancelled', function() {

			var a = rnr.cr();
			var b = a.on();
			var c = a.on();
			b.cancel();
			c.cancel();
			a.update(1);

			expect(a.done).to.be.true;
		});

		it('should autocancel its children when update() called if their children are all cancelled', function() {

			var a = rnr.cr(0);
			var b = a.on();
			var c = b.on();
			c.cancel();
			a.update(1);

			expect(a.done).to.be.true;
			expect(b.done).to.be.true;
		});

		it('should call cancelfn with the value passed to update() if autocancelling', function() {

			var final = 0;
			var a = rnr.cr(0, null, null, function(x) {
				final = x;
			});
			var b = a.on();
			b.cancel();
			a.update(1);

			expect(final).to.equal(1);
		});

		it('should remove cancelled children when set if any children still active', function() {

			var a = rnr.cr();
			var b = a.on();
			var c = a.on();
			c.cancel();
			a.update(1);
			var children = a.children;

			expect(a.done).to.be.false;
			expect(b.done).to.be.false;
			expect(children).to.include.members([b]);
			expect(children).to.not.include.members([c]);
		});

		it('should throw an error when on() called on cancelled', function() {

			var a = rnr.cr();
			a.cancel();

			expect(function() {
				var b = a.on();
			}).to.throw(/Cannot cascade from cancelled/);
		});
	});

	describe('oncancel()', function() {

		var a = rnr.cr(0);
		var b, c, d;

		it('should return a new Reactor instance', function() {

			b = a.oncancel();

			expect(b).to.be.an.instanceof(rnr.Reactor);
			expect(b).to.not.equal(a);
		});

		it('should add the child to its parent\'s child set', function() {

			expect(a.children).to.include.members([b]);
		});

		it('should add another child when called again on the parent', function() {

			c = a.oncancel();

			expect(a.children).to.include.members([b, c]);
		});

		it('should have its parent\'s final value when cancelled if no cancelfn given', function() {

			a.cancel(1);

			expect(b.value).to.equal(1);
			expect(c.value).to.equal(1);
		});

		it('should have the result of cancelfn called with its parent\'s final value when cancelled', function() {

			a = rnr.cr();
			b = a.oncancel(function(x) {
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
			b = a.on();
			b.cancel();
			a.update(1);

			expect(a.done).to.be.false;
			expect(a.children).to.have.lengthOf(0);
		});

		it('should not autocancel when persistent if parent set when all children cancelled', function() {

			b = a.on().persist();
			c = b.on();
			c.cancel();
			a.update(1);

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
				var b = a.on();
				a.attach(b);
			}).to.throw(/Cannot attach/);
		});

		it('should throw if arg is not a Reactor', function() {

			var a = rnr.cr(0);

			expect(function() {
				a.attach(1);
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

			a.update(3);
			expect(c.value).to.equal(3);

			b.update(4);
			expect(c.value).to.equal(4);
		});
	});

	describe('detach()', function() {

		var a, b;

		beforeEach(function() {
			a = rnr.cr();
			b = a.on();
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
			b = a.on();
			c = a.on();
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

			a.update(3);

			expect(c.value).to.equal(3);

			b.update(4);

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

			a.update(3);

			expect(c.value).to.eql([3, 2]);

			b.update(4);

			expect(c.value).to.eql([3, 4]);
		});
	});

	describe('update() with promises', function() {

		function promiser () {
			var p = {};
			p.promise = new Promise(function (resolve, reject) {
				p.resolve = resolve;
				p.reject = reject;
			});
			return p;
		}

		var a, b, c, q, r, s, counter, newval, oldval;

		it('should set iserr to undefined when called with a promise', function () {

			counter = 0;

			a = rnr.cr(0, function(x, y) {
				newval = x;
				oldval = y;
				counter++;
				return x;
			});

			expect(a.value).to.equal(0);
			expect(a.iserr).to.be.false;
			expect(counter).to.equal(1);

			q = promiser();
			a.update(q.promise);

			expect(a.iserr).to.be.undefined;
		});

		it('should have pending equal true when waiting for the promise to be resolved', function() {

			expect(a.pending).to.be.true;
		});

		it('should have its previous value while pending', function() {
			
			expect(a.value).to.equal(0);
		});

		it('should not have called updatefn while pending', function() {

			expect(counter).to.equal(1);
		});

		it('should have the value of the promise once resolved', function () {

			q.resolve(1);
			return expect(q.promise.then(function(x) {
				expect(a.value).to.equal(1);
				return x;
			})).to.eventually.equal(1);
		});

		it('should have iserr equal false once promise resolved', function () {

			expect(a.iserr).to.be.false;
		});

		it('should have pending equal false once promise resolved', function() {

			expect(a.pending).to.be.false;
		});

		it('should call updatefn with new and old values when promise resolved', function() {

			expect(counter).to.equal(2);
			expect(newval).to.equal(1);
			expect(oldval).to.equal(0);
		});

		it('should have iserr undefined and previous value if update() called again with a new promise', function() {

			var tmp1 = a.value;
			var tmp2 = counter;

			q = promiser();
			a.update(q.promise);
			
			expect(a.iserr).to.be.undefined;
			expect(a.value).to.equal(tmp1);
			expect(counter).to.equal(tmp2);
		});

		it('should have the value of the promise once rejected', function() {

			q.reject(2);
			return expect(q.promise.then(undefined, function(x) {
				expect(a.value).to.equal(2);
				return x;
			})).to.eventually.equal(2);
		});

		it('should have iserr equal true once promise rejected', function() {

			expect(a.iserr).to.equal.true;
		});

		it('should have pending equal false once promise rejected', function() {

			expect(a.pending).to.be.false;
		});

		it('should update its children with iserr undefined when update() called with a promise', function() {

			a.update(0);
			b = a.on();

			expect(b.value).to.equal(0);
			expect(b.iserr).to.be.false;

			q = promiser();
			a.update(q.promise);

			expect(b.value).to.equal(0);
			expect(b.iserr).to.be.undefined;
		});

		it('should update its children with the value of the promise once resolved and set iserr to false', function() {

			q.resolve(1);
			return expect(q.promise.then(function(x) {
				expect(b.value).to.equal(1);
				expect(b.iserr).to.be.false;
				return x;
			})).to.eventually.equal(1);
		});

		it('should update its children with the value of the promise once rejected and set iserr to true', function() {

			q = promiser();
			a.update(q.promise);

			q.reject(2);
			return expect(q.promise.then(undefined, function(x) {
				expect(b.value).to.equal(2);
				expect(b.iserr).to.be.true;
				return x;
			})).to.eventually.equal(2);
		});

		it('should have value and iserr undefined when its updatefn returns a pending promise', function() {

			q = promiser();
			a = rnr.cr(undefined, function() {
				return q.promise;
			});

			expect(a.value).to.be.undefined;
			expect(a.iserr).to.be.false;

			a.update(0);

			expect(a.value).to.be.undefined;
			expect(a.iserr).to.be.undefined;
		});

		it('should set its value directly (bypassing updatefn) once the pending promise is resolved', function() {

			q.resolve(1);
			return expect(q.promise.then(function(x) {
				expect(a.value).to.equal(1);
				expect(a.iserr).to.be.false;
				return x;
			})).to.eventually.equal(1);
		});

		it('should set its value directly (bypassing errorfn) once a pending promise is rejected', function() {

			var tmp = a.value;

			q = promiser();
			a.update(0);

			expect(a.value).to.equal(tmp);
			expect(a.iserr).to.be.undefined;

			q.reject(2);
			return expect(q.promise.then(undefined, function(x) {
				expect(a.value).to.equal(2);
				expect(a.iserr).to.be.true;
				return x;
			})).to.eventually.equal(2);
		});

		it('should set its childrens\' iserr to undefined when its updatefn returns a pending promise', function() {

			a.update();

			expect(a.value).to.be.undefined;
			expect(a.iserr).to.be.false;

			b = a.on(function(x) {
				return x + 1;
			}, function(x) {
				return x - 1;
			});

			expect(b.value).to.be.undefined;
			expect(b.iserr).to.be.false;

			q = promiser();
			a.update(0);

			expect(b.value).to.be.undefined;
			expect(b.iserr).to.be.undefined;
		});

		it('should call its childrens\' updatefn once its pending promise is resolved', function() {

			q.resolve(2);
			return expect(q.promise.then(function(x) {
				expect(a.value).to.equal(2);
				expect(a.iserr).to.be.false;
				expect(b.value).to.equal(3);
				expect(b.iserr).to.be.false;
				return x;
			})).to.eventually.equal(2);
		});

		it('should call its childrens\' errorfn once its pending promise is rejected', function() {

			a.update();
			q = promiser();
			a.update(0);

			q.reject(2);
			return expect(q.promise.then(undefined, function(x) {
				expect(a.value).to.equal(2);
				expect(a.iserr).to.be.true;
				expect(b.value).to.equal(1);
				expect(b.iserr).to.be.false;
				return x;
			})).to.eventually.equal(2);
		});
	});

	describe('then()', function() {

		function promiser () {
			var p = {};
			p.promise = new Promise(function (resolve, reject) {
				p.resolve = resolve;
				p.reject = reject;
			});
			return p;
		}

		var a, q, r;
		// a = rnr.cr();

		it('should return a promise', function() {

			a = rnr.cr();
			q = a.then();

			expect(q).to.be.an.instanceof(Promise);
		});

		it('should resolve the promise when update() called', function() {

			q = a.then();

			a.update(1);

			return expect(q).to.eventually.equal(1);
		});

		it('should reject the promise when error() called', function() {

			q = a.then();
			a.error(2);
			return expect(q).to.be.rejectedWith(2);
		});

		it('should resolve the promise with the output of updatefn', function () {

			a = rnr.cr(undefined,
				function(x) {
					if (x === 0) {
						throw -1;
					}
					return x + 1;
				}, 
				function(y) {
					if (y === -2) {
						throw -4;
					}
					return y - 1;
				}
			);

			q = a.then();
			a.update(1);
			return expect(q).to.be.fulfilled.and.eventually.equal(2);
		});

		it('should reject the promise with the thrown value if updatefn throws', function() {

			q = a.then();
			a.update(0);
			return expect(q).to.be.rejectedWith(-1);
		});

		it('should resolve the promise with the output of errorfn', function() {

			q = a.then();
			a.error(2);
			return expect(q).to.be.fulfilled.and.eventually.equal(1);
		});

		it('should reject the promise with the thrown value if errorfn throws', function() {

			q = a.then();
			a.error(-2);
			return expect(q).to.be.rejectedWith(-4);
		});

		it('should return a promise from each call', function() {

			q = a.then();
			r = a.then();

			expect(q).to.be.an.instanceof(Promise);
			expect(r).to.be.an.instanceof(Promise);
		});

		it('should resolve all promises when update() called and updatefn returns', function() {

			a.update(1);

			return expect(Promise.all([q, r])).to.become([2, 2])
		});

		it('should reject all promises when update() called and updatefn throws', function() {

			q = a.then();
			r = a.then();

			a.update(0);

			return Promise.all([
				expect(q).to.be.rejectedWith(-1),
				expect(r).to.be.rejectedWith(-1)
			]);
		});

		it('should resolve all promises when error() called and errorfn returns', function() {

			q = a.then();
			r = a.then();

			a.error(1);

			return expect(Promise.all([q, r])).to.become([0, 0]);
		});

		it('should reject all promises when error() called and errorfn throws', function() {

			q = a.then();
			r = a.then();

			a.error(-2);

			return Promise.all([
				expect(q).to.be.rejectedWith(-4),
				expect(r).to.be.rejectedWith(-4)
			]);
		});

		it('should leave the promise pending if updatefn returns a promise', function() {

			var pending = true;

			a = rnr.cr(undefined, function() {
				q = promiser();
				return q.promise;
			}, function() {
				q = promiser();
				return q.promise;
			});

			r = a.then(function (x) {
				pending = false;
				return x;
			});

			expect(pending).to.be.true;

			a.update(0);

			expect(q.promise).to.be.instanceof(Promise);
			return expect(Promise.resolve().then(function() {
				expect(pending).to.be.true;
			})).to.be.fulfilled;
		});

		it('should resolve the promise once updatefn\'s promise is resolved', function() {

			q.resolve(1);

			return expect(r).to.eventually.equal(1);
		});

		it('should reject the promise once updatefn\'s promise is rejected', function() {

			r = a.then();
			a.update(0);

			q.reject(1);

			return expect(r).to.be.rejectedWith(1);
		});

		it('should leave the promise pending if errorfn returns a promise', function() {

			var pending = true;

			r = a.then(function (x) {
				pending = false;
				return x;
			});

			expect(pending).to.be.true;

			a.error(0);

			expect(q.promise).to.be.instanceof(Promise);
			return expect(Promise.resolve().then(function() {
				expect(pending).to.be.true;
			})).to.be.fulfilled;
		});

		it('should resolve the promise once errorfn\'s promise is resolved', function() {

			q.resolve(1);

			return expect(r).to.be.fulfilled.and.eventually.equal(1);
		});

		it('should reject the promise once errorfn\'s promise is rejected', function() {

			r = a.then();
			a.error(0);

			q.reject(1);

			return expect(r).to.be.rejectedWith(1);
		});

		it('should reject the promise with an error if Reactor is cancelled afterward', function() {

			r = a.then();
			a.cancel();

			return expect(r).to.be.rejectedWith(Error);
		});

		it('should return a rejected promise if Reactor is already cancelled', function() {

			expect(a.done).to.be.true;

			r = a.then();

			return expect(r).to.be.rejectedWith(Error);
		});
	});
});
