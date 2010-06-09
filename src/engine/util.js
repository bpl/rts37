// Firing Solution                           //
// Utilies shared by server and client parts //

function assert(condition, error) {
	if (!condition) {
		throw new AssertionFailure(error);
	}
}

///////////////////////
// AssertionFailure //
/////////////////////

function AssertionFailure(message) {
	this.message = message;
	this.name = 'AssertionFailure';
}

AssertionFailure.prototype.toString = function () {
	return this.name + ': ' + this.message;
};

//////////////
// Exports //
////////////

if (typeof exports != 'undefined') {
	exports.assert = assert;
	exports.AssertionFailure = AssertionFailure;
}