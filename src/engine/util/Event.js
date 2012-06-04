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