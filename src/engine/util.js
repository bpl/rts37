// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

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

	// Assertion failure error

	function AssertionFailure(message) {
		this.message = message;
		this.name = 'AssertionFailure';
	}

	AssertionFailure.prototype.toString = function () {
		return this.name + ': ' + this.message;
	};

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
			if (values.hasOwnProperty(key)) {
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

	return {
		assert: assert,
		splitLines: splitLines,
		padToThree: padToThree,
		AssertionFailure: AssertionFailure,
		inherits: inherits,
		defaults: defaults
	};

});