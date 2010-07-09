// Firing Solution                           //
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
	exports.AssertionFailure = AssertionFailure;
}