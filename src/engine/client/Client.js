// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/mathlib', 'engine/client/UIRenderer', 'engine/util/Event'], function (mathlib, UIRenderer, Event) {

	function Client(game, canvas) {
		var self = this;
		assert(game && typeof game === 'object', 'Client: game must be an object');
		assert(canvas, 'Client: canvas is required');
		this.game = game;
		this.canvas = canvas;
		this.gl = null;
		this.widgets = [];
		this.mouseOverWidget = null;
		this.uiRenderer = new UIRenderer();
		this.onresizewindow = null;
		this.onDraw = new Event();
		//
		// User interface state
		//
		this.selectedActors = [];
		//
		// Pacing information
		//
		// Interpolation factor. Value 0 means that the frame that is being rendered
		// or that has been rendered reflects the current simulation state. Value -1
		// means that the frame that is being rendered or has been rendered reflects
		// the previous simulation state.
		this.factor = 0;
		this.lastDrawn = 0;
		this.msecsSinceDrawn = 0;

		// Acquire drawing context

		var glOptions = {
		};

		try {
			this.gl = this.canvas.getContext('webgl', glOptions);
			if (!this.gl) {
				this.gl = this.canvas.getContext('experimental-webgl', glOptions);
			}
		} catch (e) {
			// TODO: Better error message
			alert('Got exception ' + e + ' when attempting to initialize WebGL context.');
			return;
		}
		if (!this.gl) {
			// TODO: Better error message
			alert('Could not initialize WebGL context. Try a better browser?');
			return;
		}

		// requestAnimationFrame is still under development, so try various
		// vendor-prefixed versions.
		var requestAnimationFrame =
				window.requestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				function (callback, elm) {
					setTimeout(callback, 10);
				};

		// If contexts are available, set up event handlers

		window.setInterval(function () {
			self.game.gameLoop();
		}, 10);

		requestAnimationFrame.call(window, function handleAnimationFrame() {
			requestAnimationFrame.call(window, handleAnimationFrame, canvas);
			self.drawLoop();
		}, canvas);

		this.canvas.addEventListener('click', function (evt) {
			self.handleClick(evt);
		}, false);

		this.canvas.addEventListener('mousemove', function (evt) {
			self.handleMouseMove(evt);
		}, false);

		this.canvas.addEventListener('mouseout', function (evt) {
			self.handleMouseOut(evt);
		}, false);

		document.addEventListener('keypress', function (evt) {
			self.handleKeyPress(evt);
		}, false);

		window.addEventListener('resize', function (evt) {
			var func = self.onresizewindow;
			if (func) {
				func.call(self, evt);
			}
		}, false);

		// WebGL context initialization
		// FIXME: Must be done again if the context is lost and restored

		var gl = this.gl;
		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		gl.clearDepth(1.0);
	}

	// Set the currently selected actors to certain array
	Client.prototype.setSelection = function (arr) {
		this.selectedActors = arr;
	};

	Client.prototype.add = function (widget) {
		assert(
			widget.handleClick && widget.handleMouseMove && widget.handleKeyPress,
			'Client.add: widget must handle clicks, mouse moves and key presses'
		);
		this.widgets.push(widget);
	};

	Client.prototype.remove = function (widget) {
		var index = this.widgets.indexOf(widget);
		if (index >= 0) {
			this.widgets.splice(index, 1);
		}
	};

	Client.prototype.normalizedOffset = function (evt) {
		var bounds = this.canvas.getBoundingClientRect();
		return new mathlib.Vec(
			evt.clientX - bounds.left,
			evt.clientY - bounds.top
		);
	};

	// Drawing loop. This should be called repeatedly, preferably using
	// requestAnimationFrame to remove unnecessary updates.
	Client.prototype.drawLoop = function () {
		var timeNow = (new Date()).getTime();
		if (this.game.reallyRunning) {
			this.factor = 1 - (timeNow - this.game.lastTickAt) / this.game.msecsPerTick;
			if (this.factor < 0) {
				this.factor = 0;
			}
		} else {
			this.factor = 0;
		}
		if (this.lastDrawn) {
			var sinceDrawn = timeNow - this.lastDrawn;
			if (this.game.cappedToFps > 0 && sinceDrawn < 1000 / this.game.cappedToFps) {
				return;
			}
			this.msecsSinceDrawn = sinceDrawn;
		} else {
			this.msecsSinceDrawn = 0;
		}
		this.lastDrawn = timeNow;

		// Do the actual drawing

		var gl = this.gl;
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		for (var i = 0; i < this.widgets.length; ++i) {
			this.widgets[i].draw(gl);
		}
		this.uiRenderer.draw(gl);
		this.onDraw.emit();
	};

	Client.prototype.handleClick = function (evt) {
		evt.preventDefault();
		var offset = this.normalizedOffset(evt);
		for (var i = this.widgets.length - 1; i >= 0; --i) {
			var widget = this.widgets[i];
			if (offset.x >= widget.x
					&& offset.x < widget.x + widget.width
					&& offset.y >= widget.y
					&& offset.y < widget.y + widget.height) {
				if (widget.handleClick(offset.x - widget.x, offset.y - widget.y) !== false) {
					return;
				}
			}
		}
	};

	Client.prototype.handleMouseMove = function (evt) {
		evt.preventDefault();
		var offset = this.normalizedOffset(evt);
		if (this.mouseOverWidget) {
			var widget = this.mouseOverWidget;
			if (offset.x < widget.x
					|| offset.x >= widget.x + widget.width
					|| offset.y < widget.y
					|| offset.y >= widget.y + widget.height) {
				widget.handleMouseOut();
				this.mouseOverWidget = null;
			}
		}
		for (var i = this.widgets.length - 1; i >= 0; --i) {
			var widget = this.widgets[i];
			if (offset.x >= widget.x
					&& offset.x < widget.x + widget.width
					&& offset.y >= widget.y
					&& offset.y < widget.y + widget.height) {
				if (widget.handleMouseMove(offset.x - widget.x, offset.y - widget.y) !== false) {
					this.mouseOverWidget = widget;
					return;
				}
			}
		}
	};

	Client.prototype.handleMouseOut = function (evt) {
		evt.preventDefault();
		if (this.mouseOverWidget) {
			this.mouseOverWidget.handleMouseOut();
			this.mouseOverWidget = null;
		}
	};

	Client.prototype.handleKeyPress = function (evt) {
		evt.preventDefault();
		var code = evt.keyCode || evt.charCode;
		if (code >= 65 && code <= 90) {
			var letter = String.fromCharCode(code + 32);
		} else if (code >= 97 && code <= 122) {
			var letter = String.fromCharCode(code);
		} else {
			return;
		}
		for (var i = this.widgets.length - 1; i >= 0; --i) {
			if (this.widgets[i].handleKeyPress(letter) !== false) {
				return;
			}
		}
	};

	return Client;

});