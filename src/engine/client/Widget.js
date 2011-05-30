// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(function () {

	function Widget(client, opt /* x, y, width, height */) {
		if (!opt) {
			opt = {};
		}
		assert(typeof client === 'object', 'Viewport: client must be an object');
		this.client = client;
		this.x = opt.x || 0;
		this.y = opt.y || 0;
		this.width = opt.width || 0;
		this.height = opt.height || 0;
	}

	// Move the widget to the specified location
	Widget.prototype.move = function (x, y) {
		this.x = x;
		this.y = y;
	};

	// Resize the widget to the specified size
	Widget.prototype.resize = function (width, height) {
		this.width = width;
		this.height = height;
	};

	// Called by client when the widget needs to be drawn on the canvas
	Widget.prototype.draw = function (gl) {
		// Provided here for documentation purposes
	};

	// Called by client when a click is registered on the area of the widget.
	// Return false to indicate that this widget did not process the event and that
	// the next event handler should be called instead.
	Widget.prototype.handleClick = function (x, y) {
		return false;
	};

	// Called by client when the mouse pointer is repositioned over the area of the
	// widget. Return false to indicate that this widget did not process the event
	// and that the next event handler should be called instead.
	Widget.prototype.handleMouseMove = function (x, y) {
		return false;
	};

	// Called by client when the mouse pointer is moved outside the area of the
	// widget.
	Widget.prototype.handleMouseOut = function () {
		// By default, do nothing
	};

	// Called by client when a key is pressed. Return false to indicate that this
	// widget did not process the event and that the next event handler should be
	// called instead.
	Widget.prototype.handleKeyPress = function (key) {
		return false;
	};

	return Widget;

});