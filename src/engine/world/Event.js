////////////
// Event //
//////////

define(function () {

	function Event() {
		this.handlers = [];
	}

	// Registers an event handler to this event. This function specified in the
	// first argument is the handler to be called.
	Event.prototype.register = function (func) {
		this.handlers.push(func);
	};

	Event.prototype.emit = function () {
		for (var i = 0; i < this.handlers.length; ++i) {
			this.handlers[i]();
		}
	};

	return Event;

});