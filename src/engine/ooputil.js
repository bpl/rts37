// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

// Utilities for object-oriented programming in JavaScript

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
				assert(defaults._instanceOf(values[key], defaultValue), 'defaults: type "' + this.constructor.typeName + '" requires parameter "' + key + '" to be of type "' + defaultValue.typeName + '"');
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

defaults._instanceOf = function (obj, parent) {
	return (obj instanceof parent || (obj && typeof obj.__parentTypes == 'object'
			&& obj.__parentTypes.indexOf(parent) >= 0));
};