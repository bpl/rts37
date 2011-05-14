/////////////
// Client //
///////////

define(function () {

	function Client(game, canvas, uiContext) {
		var self = this;
		assert(game && typeof game === 'object', 'Client: game must be an object');
		assert(canvas, 'Client: canvas is required');
		assert(uiContext, 'Client: uiContext is required');
		this.game = game;
		this.canvas = canvas;
		this.context = this.canvas.getContext('2d');
		this.uiContext = uiContext;
		this.widgets = [];
		this.onresizewindow = null;

		// Acquire drawing context
		/*
		this.gl = null;
		try {
			this.gl = this.canvas.getContext('webgl');
			if (!this.gl) {
				this.gl = this.canvas.getContext('experimental-webgl');
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
		*/

		// If contexts are available, set up event handlers

		this.game.onDraw.register(function () {
			self.handleDraw();
		});

		window.setInterval(function () {
			self.game.process();
		}, 10);

		this.canvas.addEventListener('click', function (evt) {
			self.handleClick(evt);
		}, false);

		this.canvas.addEventListener('mousemove', function (evt) {
			self.handleMouseMove(evt);
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
	}

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
		return new Vec(
			evt.clientX - this.canvas.offsetLeft + document.body.scrollLeft,
			evt.clientY - this.canvas.offsetTop + document.body.scrollTop
		);
	};

	Client.prototype.handleDraw = function () {
		this.uiContext.update();
		this.context.save();
		try {
			for (var i = 0; i < this.widgets.length; ++i) {
				this.widgets[i].draw(this.context, this.uiContext);
			}
		} finally {
			this.context.restore();
		}
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
				if (widget.handleClick(offset.x, offset.y) !== false) {
					return;
				}
			}
		}
	};

	Client.prototype.handleMouseMove = function (evt) {
		evt.preventDefault();
		var offset = this.normalizedOffset(evt);
		for (var i = this.widgets.length - 1; i >= 0; --i) {
			var widget = this.widgets[i];
			if (offset.x >= widget.x
					&& offset.x < widget.x + widget.width
					&& offset.y >= widget.y
					&& offset.y < widget.y + widget.height) {
				if (widget.handleMouseMove(offset.x, offset.y) !== false) {
					return;
				}
			}
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