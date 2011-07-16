// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(function () {

	function Handler(callback, context) {
		this.callback = callback;
		this.context = context;
	}

	function Event() {
		this._handlers = [];
	}

	// Registers an event handler to this event. This function specified in the
	// first argument is the handler to be called.
	Event.prototype.register = function (callback, context) {
		this._handlers.push(new Handler(callback, context || null));
	};

	Event.prototype.emit = function (/* ... */) {
		for (var i = 0; i < this._handlers.length; ++i) {
			var handler = this._handlers[i];
			handler.callback.apply(handler.context, arguments);
		}
	};

	return Event;

});