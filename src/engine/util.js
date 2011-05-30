// Alpha Site                           //
// Utilies shared by server and client parts //

function assert(condition, error) {
	if (!condition) {
		throw new AssertionFailure(error);
	}
}

function splitLines(s) {
	return s.match(/^.*$/mg);
}

// Turns a multi-line string having the form:
// "a",1,3
// "b",4,6
// Into an array having the form: [["a",1,3],["b",4,6]]
function stateSpecToArray(state) {
	var result = [],
		lines = splitLines(state);
	for (var i = 0; i < lines.length; ++i) {
		var line = lines[i];
		if (line) {
			result.push(JSON.parse('{"d":[' + line + ']}')['d']);
		}
	}
	return result;
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
	exports.stateSpecToArray = stateSpecToArray;
	exports.padToThree = padToThree;
	exports.AssertionFailure = AssertionFailure;
}