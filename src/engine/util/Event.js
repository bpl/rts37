// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

// AMD support in Node.js only comes in two flavours, nonexistent (pre-0.5) and
// completely borken (0.5), so we need this shim.
(function (injects, callback) {
	if (typeof module === 'object' && 'exports' in module) {
		module.exports = callback(require('../util'));
	} else if (typeof define === 'function') {
		define(injects, callback);
	} else {
		throw new Error('Both Require.js and Node.js globals missing');
	}
})(['engine/util'], function (util) {

	// Sentinel object to indicate that the event handler should be deregistered
	const STOP = Object.freeze({});

	function Handler(callback, context) {
		this.callback = callback;
		this.context = context;
	}

	function Event(globalEventName) {
		if (globalEventName) {
			var oldEvent = Event._globalEvents.get(globalEventName);
			if (oldEvent) {
				util.assert(!oldEvent._alreadyCreated, 'Event: global event created twice: ' + globalEventName);
				oldEvent._alreadyCreated = true;
				return oldEvent;
			}
			Event._globalEvents.set(globalEventName, this);
		}
		this._alreadyCreated = true;
		this._handlers = [];
	}

	Event.STOP = STOP;

	Event._globalEvents = new util.Map();

	/**
	 * Registers a listener to an event handler by the global name of the event.
	 * @param {string} globalEventName
	 * @param {function} callback
	 * @param {object} context
	 */
	Event.register = function (globalEventName, callback, context) {
		if (!Event._globalEvents.has(globalEventName)) {
			var newEvent = new Event(globalEventName);
			newEvent._alreadyCreated = false;
		}
		Event._globalEvents.get(globalEventName).register(callback, context);
	};

	// Registers an event handler to this event. This function specified in the
	// first argument is the handler to be called.
	Event.prototype.register = function (callback, context) {
		this._handlers.push(new Handler(callback, context || null));
	};

	Event.prototype.emit = function (/* ... */) {
		var i = 0;
		while (i < this._handlers.length) {
			var handler = this._handlers[i];
			if (handler.callback.apply(handler.context, arguments) !== STOP) {
				++i;
			} else {
				this._handlers.splice(i, 1);
			}
		}
	};

	return Event;

});