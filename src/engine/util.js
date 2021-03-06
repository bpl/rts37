// Copyright © 2012 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Random utilities

(function (callback) {
	if (typeof module === 'object' && 'exports' in module) {
		module.exports = callback();
	} else if (typeof define === 'function') {
		define(callback);
	} else {
		throw new Error('Both Require.js and Node.js globals missing');
	}
})(function () {

	function assert(condition, error) {
		if (!condition) {
			throw new AssertionFailure(error);
		}
	}

	function required(value) {
		if (typeof value === 'undefined') {
			throw new Error('Required value missing in options array');
		}
		return value;
	}

	// Less wordy way to call hasOwnProperty without fear of collision
	var hop = Function.prototype.call.bind(Object.prototype.hasOwnProperty);

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

	// OOP-related utilities

	function inherits(child, parent) {
		for (var property in parent.prototype) {
			if (typeof child.prototype[property] == 'undefined') {
				child.prototype[property] = parent.prototype[property];
			}
		}
		child.prototype.__parentTypes = (typeof parent.prototype.__parentTypes == 'undefined'
				? [] : parent.prototype.__parentTypes.slice(0));
		child.prototype.__parentTypes.push(parent);
	}

	function defaults(values, defaultValues) {
		for (var key in defaultValues) {
			var defaultValue = defaultValues[key];
			if (hop(values, key)) {
				if (defaultValue === Number) {
					assert(typeof values[key] == 'number', 'defaults: type "' + this.constructor.typeName + '" requires parameter "' + key + '" to be a number');
				} else if (typeof defaultValue == 'function') {
					assert(_instanceOf(values[key], defaultValue), 'defaults: type "' + this.constructor.typeName + '" requires parameter "' + key + '" to be of type "' + defaultValue.typeName + '"');
				}
				this[key] = values[key];
			} else {
				if (defaultValue === Number || typeof defaultValue == 'function') {
					assert(false, 'defaults: type "' + this.constructor.typeName + '" requires parameter "' + key + '"');
					this[key] = null;
				} else {
					this[key] = defaultValues[key];
				}
			}
		}
	}

	function _instanceOf (obj, parent) {
		return (obj instanceof parent || (obj && typeof obj.__parentTypes == 'object'
				&& obj.__parentTypes.indexOf(parent) >= 0));
	}

	// Assertion failure error

	function AssertionFailure(message) {
		this.message = message;
		this.name = 'AssertionFailure';
	}

	AssertionFailure.prototype.toString = function () {
		return this.name + ': ' + this.message;
	};

	// Simple map

	// This is designed to be replaced by the proposed ES6 Map object whenever
	// that is available. Note that iteration in ES6 Map is still unspecified as
	// is whether it will contain functional programming helpers.

	// FIXME: Safely handle __proto__

	function Map() {
		this._values = {};
	}

	Map.prototype.get = function (key) {
		if (hop(this._values, key)) {
			return this._values[key];
		}
		return undefined;
	};

	Map.prototype.set = function (key, value) {
		this._values[key] = value;
	};

	Map.prototype.has = function (key) {
		return hop(this._values, key);
	};

	Map.prototype['delete'] = function (key) {
		if (hop(this._values, key)) {
			delete this._values[key];
			return true;
		}
		return false;
	};

	Map.prototype.forEach = function (callback, thisObject) {
		var val = this._values;
		if (thisObject) {
			for (var key in val) {
				if (hop(val, key)) {
					callback.call(thisObject, val[key], key, val);
				}
			}
		} else {
			for (var key in val) {
				if (hop(val, key)) {
					callback(val[key], key, val);
				}
			}
		}
	};

	Map.prototype.some = function (callback, thisObject) {
		var val = this._values;
		if (thisObject) {
			for (var key in val) {
				if (hop(val, key)) {
					if (callback.call(thisObject, val[key], key, val)) {
						return true;
					}
				}
			}
		} else {
			for (var key in val) {
				if (hop(val, key)) {
					if (callback(val[key], key, val)) {
						return true;
					}
				}
			}
		}
		return false;
	};

	return {
		assert: assert,
		required: required,
		hop: hop,
		padToThree: padToThree,
		inherits: inherits,
		defaults: defaults,
		AssertionFailure: AssertionFailure,
		Map: Map
	};

});