// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/mathlib', 'engine/util/gllib', 'engine/client/UIRenderer', 'engine/util/Event'], function (mathlib, gllib, UIRenderer, Event) {

	const MOUSE_IDLE = 0;
	const MOUSE_CLICK_OR_DRAG = 1;
	const MOUSE_DRAG = 2;

	const MOUSE_DRAG_THRESHOLD = 5;

	function Client(game, canvas) {
		var self = this;
		assert(game && typeof game === 'object', 'Client: game must be an object');
		assert(canvas, 'Client: canvas is required');
		this.game = game;
		this.canvas = canvas;
		this.gl = null;
		this.widgets = [];
		this.uiRenderer = new UIRenderer();
		this.onresizewindow = null;
		this.onDraw = new Event();
		//
		// Input handling state
		//
		this._mouseCaptureWidget = null;
		this._mouseDownX = 0;
		this._mouseDownY = 0;
		this._mouseMode = MOUSE_IDLE;
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

		this.canvas.addEventListener('mousedown', function (evt) {
			self.handleMouseDown(evt);
		});

		this.canvas.addEventListener('mousemove', function (evt) {
			self.handleMouseMove(evt);
		}, false);

		this.canvas.addEventListener('mouseup', function (evt) {
			self.handleMouseUp(evt);
		});

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
		gllib.provideContext(gl);

		// Enable depth buffering
		// Defaults to depth mask enabled and depth range of 0 to 1
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.depthMask(true);   // It's already the default, though

		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		gl.clearDepth(1.0);

		gl.enable(gl.CULL_FACE);
		gl.frontFace(gl.CW);   // Notice that this is NOT the default
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
		return {
			'x': evt.clientX - bounds.left,
			'y': evt.clientY - bounds.top
		};
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
	};

	Client.prototype.handleMouseDown = function (evt) {
		evt.preventDefault();
		var offset = this.normalizedOffset(evt);
		var x = offset.x;
		var y = offset.y;

		this._mouseDownX = x;
		this._mouseDownY = y;
		this._mouseMode = MOUSE_CLICK_OR_DRAG;

		if (this._mouseCaptureWidget) {
			var widget = this._mouseCaptureWidget;
			widget.handleMouseDown(x - widget.x, y - widget.y);
		} else {
			for (var i = this.widgets.length - 1; i >= 0; --i) {
				var widget = this.widgets[i];
				if (widget.hitTest(x, y)) {
					if (widget.handleMouseDown(offset.x - widget.x, offset.y - widget.y) !== false) {
						this._mouseCaptureWidget = widget;
						break;
					}
				}
			}
		}
	};

	Client.prototype.handleMouseMove = function (evt) {
		evt.preventDefault();
		var offset = this.normalizedOffset(evt);
		var x = offset.x;
		var y = offset.y;

		switch (this._mouseMode) {
			case MOUSE_IDLE:
				if (this._mouseCaptureWidget) {
					var widget = this._mouseCaptureWidget;
					if (!widget.hitTest(x, y)) {
						widget.handleMouseOut();
						this._mouseCaptureWidget = null;
					} else {
						widget.handleMouseMove(x - widget.x, y - widget.y);
					}
				} else {
					for (var i = this.widgets.length - 1; i >= 0; --i) {
						var widget = this.widgets[i];
						if (widget.hitTest(x, y)) {
							if (widget.handleMouseMove(x - widget.x, y - widget.y) !== false) {
								this._mouseCaptureWidget = widget;
								break;
							}
						}
					}
				}
			break;
			case MOUSE_CLICK_OR_DRAG:
				if (Math.abs(this._mouseDownX - x) > MOUSE_DRAG_THRESHOLD ||
						Math.abs(this._mouseDownY - y) > MOUSE_DRAG_THRESHOLD) {
					this._mouseMode = MOUSE_DRAG;

					if (this._mouseCaptureWidget) {
						var widget = this._mouseCaptureWidget;
						widget.handleDragStart(this._mouseDownX - widget.x, this._mouseDownY - widget.y);
						widget.handleDragMove(x - widget.x, y - widget.y);
					} else {
						for (var i = this.widgets.length - 1; i >= 0; --i) {
							var widget = this.widgets[i];
							if (widget.hitTest(x, y)) {
								if (widget.handleDragStart(this._mouseDownX - widget.x, this._mouseDownY - widget.y) !== false) {
									widget.handleDragMove(x - widget.x, y - widget.y);
									this._mouseCaptureWidget = widget;
									break;
								}
							}
						}
					}
				}
			break;
			case MOUSE_DRAG:
				if (this._mouseCaptureWidget) {
					this._mouseCaptureWidget.handleDragMove(x, y);
				}
			break;
		}
	};

	Client.prototype.handleMouseUp = function (evt) {
		evt.preventDefault();
		var offset = this.normalizedOffset(evt);
		var x = offset.x;
		var y = offset.y;

		switch (this._mouseMode) {
			case MOUSE_CLICK_OR_DRAG:
				this._mouseMode = MOUSE_IDLE;
				if (this._mouseCaptureWidget) {
					var widget = this._mouseCaptureWidget;
					widget.handleClick(x - widget.x, y - widget.y);
					this._mouseCaptureWidget = null;
				} else {
					for (var i = this.widgets.length - 1; i >= 0; --i) {
						var widget = this.widgets[i];
						if (widget.hitTest(x, y)) {
							if (widget.handleClick(x - widget.x, y - widget.y) !== false) {
								break;
							}
						}
					}
				}
			break;
			case MOUSE_DRAG:
				this._mouseMode = MOUSE_IDLE;
				if (this._mouseCaptureWidget) {
					var widget = this._mouseCaptureWidget;
					widget.handleDragDone(x - widget.x, y - widget.y);
					this._mouseCaptureWidget = null;
				}
			break;
		}
	};

	Client.prototype.handleMouseOut = function (evt) {
		evt.preventDefault();

		if (this._mouseMode === MOUSE_IDLE && this._mouseCaptureWidget) {
			this._mouseCaptureWidget.handleMouseOut();
			this._mouseCaptureWidget = null;
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