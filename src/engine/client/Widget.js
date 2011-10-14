// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util'], function (util) {

	// The order of mouse events is:
	//
	// MouseMove --> MouseOut
	//           --> MouseDown --> Click
	//                         --> DragStart --> DragMove --> DragDone

	function Widget(client, opt /* x, y, width, height */) {
		if (!opt) {
			opt = {};
		}
		util.assert(typeof client === 'object', 'Viewport: client must be an object');
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

	/**
	 * Returns true if mouse pointer residing at the specified parent
	 * coordinates should count as being over this widget.
	 * @param {number} parentX
	 * @param {number} parentY
	 * @returns {boolean}
	 */
	Widget.prototype.hitTest = function (parentX, parentY) {
		return (parentX >= this.x && parentX < this.x + this.width &&
				parentY >= this.y && parentY < this.y + this.height);
	};

	// Called by client when the widget needs to be drawn on the canvas
	Widget.prototype.draw = function (gl) {
		// Provided here for documentation purposes
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

	/**
	 * Called by client when a mouse button is pressed down while the pointer is
	 * inside the area of the widget. Return false to indicate that this widget
	 * did not process the event and that the next event handler should be
	 * called instead.
	 * @param {number} x
	 * @param {number} y
	 * @returns {boolean}
	 */
	Widget.prototype.handleMouseDown = function (x, y) {
		return false;
	};

	// Called by client when a click is registered on the area of the widget.
	// Return false to indicate that this widget did not process the event and that
	// the next event handler should be called instead.
	Widget.prototype.handleClick = function (x, y) {
		return false;
	};

	/**
	 * Called by client when a drag starts within the area of the widget. Return
	 * false to indicate that this widget did not process the event and that the
	 * next event handler should be called instead.
	 * @param {number} x
	 * @param {number} y
	 * @returns {boolean}
	 */
	Widget.prototype.handleDragStart = function (x, y) {
	    return false;
	};

	/**
	 * Called by client when the mouse is being moved while a drag previously
	 * accepted by this widget is in progress.
	 * @param {number} x
	 * @param {number} y
	 */
	Widget.prototype.handleDragMove = function (x, y) {
		// By default, do nothing
	};

	/**
	 * Called by client when a drag previously accepted by this widget ends.
	 * @param {number} x
	 * @param {number} y
	 */
	Widget.prototype.handleDragDone = function (x, y) {
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