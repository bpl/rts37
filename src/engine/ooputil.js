// Alpha Site                                         //
// Utilities for object-oriented programming in JavaScript //

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

/////////////////////////////////
// Object activator singleton //
///////////////////////////////

function Activator(resolver, data) {
	assert(typeof resolver.resolveId == 'function', 'Activator: invalid resolver');
	assert(typeof data == 'object', 'Activator: invalid data');
	assert(typeof data.type == 'string', 'Activator: missing or invalid type');
	return new this.getType(data.type)(data);
}

Activator.types = {};

function register(typeName, type) {
	assert(typeof type == 'function', 'register: type must be a function');
	assert(typeof Activator.types[typeName] == 'undefined', 'register: object type already registered');
	Activator.types[typeName] = type;
	type.typeName = typeName;
	type.prototype.stringify = Activator._stringify;
	type.prototype.defaults = Activator._defaults;
}

Activator.getType = function (typeName) {
	var result = Activator.types[typeName];
	assert(typeof result == 'function', 'Activator.getType: object type "' + typeName + '" not registered');
	return result;
};

Activator.getDecoder = function (resolver) {
	return function decode(key, value) {
		switch (typeof value) {
			case 'string':
			case 'number':
				return value;
			case 'object':
				if (value === null) {
					return null;
				} else if (value instanceof Array) {
					var result = [];
					for (var i = 0; i < value.length; ++i) {
						result.push(decode(i, value[i]));
					}
					return result;
				} else if (typeof value['$id'] == 'number') {
					var actor = resolver.resolveId(value['$id']);
					assert(actor, 'Activator.getDecoder: could not resolve actor ' + value['$id']);
					return actor;
				} else {
					return value;
				}
			default:
				assert(false, 'Activator.getDecoder: a member with unknown type encountered');
				return null;
		}
	};
};

Activator._encodeMember = function (key, value) {
	if (key[key.length - 1] == '_') {
		return undefined;
	}
	switch (typeof value) {
		case 'string':
		case 'number':
			return value;
		case 'object':
			if (value === null) {
				return null;
			} else if (value instanceof Array) {
				var result = [];
				for (var i = 0; i < value.length; ++i) {
					result.push(Actor._encodeMember(value[i]));
				}
				return result;
			} else if (typeof value.id == 'number') {
				return {'$id': value.id};
			} else {
				return value;
			}
		default:
			assert(false, 'Activator._encodeMember: a member with an unknown type encountered');
			return null;
	}
};

Activator._encodeObject = function (obj) {
	// FIXME: Obsolete?
	var result = {};
	for (var key in obj) {
		if (obj.hasOwnProperty(key)) {
			var value = Activator._encodeMember(obj[key]);
			if (value !== undefined) {
				result[key] = value;
			}
		}
	}
	return result;
};

Activator._stringify = function () {
	return JSON.stringify(this, Activator._encodeMember);
};

Activator._instanceOf = function (obj, parent) {
	return (obj instanceof parent || (obj && typeof obj.__parentTypes == 'object'
			&& obj.__parentTypes.indexOf(parent) >= 0));
};

Activator._defaults = function (values, defaultValues) {
	for (var key in defaultValues) {
		var defaultValue = defaultValues[key];
		if (values.hasOwnProperty(key)) {
			if (defaultValue === Number) {
				assert(typeof values[key] == 'number', 'Activator._defaults: type "' + this.constructor.typeName + '" requires parameter "' + key + '" to be a number');
			} else if (typeof defaultValue == 'function') {
				assert(Activator._instanceOf(values[key], defaultValue), 'Activator._defaults: type "' + this.constructor.typeName + '" requires parameter "' + key + '" to be of type "' + defaultValue.typeName + '"');
			}
			this[key] = values[key];
		} else {
			if (defaultValue === Number || typeof defaultValue == 'function') {
				assert(false, 'Activator._defaults: type "' + this.constructor.typeName + '" requires parameter "' + key + '"');
				this[key] = null;
			} else {
				this[key] = defaultValues[key];
			}
		}
	}
};