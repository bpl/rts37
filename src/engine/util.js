// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

// Utilies shared by server and client parts

function assert(condition, error) {
	if (!condition) {
		throw new AssertionFailure(error);
	}
}

function splitLines(s) {
	return s.match(/^.*$/mg);
}

// Converts a number to string and pads it to three digits
function padToThree(value) {
	if (value < 10) {
		return '00' + value;
	} else if (value < 100) {
		return '0' + value;
	} else {
		return value.toString();
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
	exports.splitLines = splitLines;
	exports.padToThree = padToThree;
	exports.AssertionFailure = AssertionFailure;
}