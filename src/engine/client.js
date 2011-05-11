// Firing Solution                //
// Generic user interface objects //

/////////////
// Widget //
///////////

function Widget(client, opt /* x, y, width, height */) {
	if (!opt) {
		opt = {};
	}
	assert(instanceOf(client, Client), 'Viewport: client must be a Client');
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

// Called by client when a key is pressed. Return false to indicate that this
// widget did not process the event and that the next event handler should be
// called instead.
Widget.prototype.handleKeyPress = function (key) {
	return false;
};

///////////////
// Viewport //
/////////////

inherits(Viewport, Widget);
function Viewport(client, opt /* x, y, width, height */) {
	Widget.call(this, client, opt);
	this.game = this.client.game;
	this.autoScrollRegion = 100;
	this.autoScrollMultiplier = 0.5;
	this.viewX = this.game.fieldWidth / 2;
	this.viewY = this.game.fieldHeight / 2;
	this.viewZoom = 1;
	this.lastMouseX = 0;
	this.lastMouseY = 0;
	this.autoScrollX = 0;
	this.autoScrollY = 0;

	var self = this;
	this.game.onTick.register(function () {
		self.tick();
	});
};

Viewport.prototype.tick = function () {
	if (this.autoScrollX != 0 || this.autoScrollY != 0) {
		this.translate(this.autoScrollX, this.autoScrollY);
	}
};

Viewport.prototype.draw = function (ctx, uiCtx) {
	// To be overridden in a subclass
};

Viewport.prototype.viewToWorld = function (x, y) {
	return [(x - this.x) * this.viewZoom + this.viewX - this.width / 2 * this.viewZoom << 10,
			(y - this.y) * this.viewZoom + this.viewY - this.height / 2 * this.viewZoom << 10];
};

Viewport.prototype._autoScrollDimension = function (mousePos, viewportPos, viewportSize) {
	if (mousePos > viewportPos && mousePos < viewportPos + this.autoScrollRegion) {
		return (mousePos - viewportPos - this.autoScrollRegion) * this.autoScrollMultiplier;
	} else if (mousePos > viewportPos + viewportSize - this.autoScrollRegion
			&& mousePos < viewportPos + viewportSize) {
		return (mousePos - viewportPos - viewportSize + this.autoScrollRegion) * this.autoScrollMultiplier;
	} else {
		return 0;
	}
};

Viewport.prototype.handleClick = function (x, y) {
	var target = this.viewToWorld(x, y);
	for (var idx in this.game.actors) {
		var actor = this.game.actors[idx];
		if (actor.isSelectable() && actor.clickTest(target[0], target[1], this.game.factor)) {
			this.client.uiContext.setSelection([actor]);
			return;
		}
	}
	for (var idx in this.client.uiContext.selectedActors) {
		var actor = this.client.uiContext.selectedActors[idx];
		if (actor.validateMove && actor.validateMove(target[0], target[1])) {
			actor.issueMove(target[0], target[1]);
		}
	}
};

Viewport.prototype.handleMouseMove = function (x, y) {
	// Save the most recent position of the mouse to use in firing etc.
	// FIXME: Handle changes to this when zooming or scrolling. Maybe do the
	// conversion right before the value needs to be used.
	var target = this.viewToWorld(x, y);
	this.lastMouseX = target[0];
	this.lastMouseY = target[1];
	// If the mouse pointer is near the boundary of the viewport, scroll
	// the viewport automatically.
	if (this.autoScrollRegion > 0) {
		this.autoScrollX = this._autoScrollDimension(x, this.x, this.width);
		this.autoScrollY = this._autoScrollDimension(y, this.y, this.height);
	}
};

Viewport.prototype.handleKeyPress = function (key) {
	switch (key) {
		case 'e':
			this.zoomBy(0.5);
			break;
		case 'f':
			this.zoomBy(2);
			break;
		case 'w':
			this.translate(0, -50);
			break;
		case 's':
			this.translate(0, 50);
			break;
		case 'a':
			this.translate(-50, 0);
			break;
		case 'd':
			this.translate(50, 0);
			break;
		default:
			return false;
	}
};

Viewport.prototype._constrainDimension = function (value, viewport, field) {
	if (viewport >= field) {
		return field / 2;
	} else if (value < viewport / 2) {
		return viewport / 2;
	} else if (value > field - viewport / 2) {
		return field - viewport / 2;
	} else {
		return value;
	}
};

Viewport.prototype.translate = function (x, y) {
	this.viewX = this._constrainDimension(this.viewX + x * this.viewZoom,
			this.width * this.viewZoom, this.game.fieldWidth);
	this.viewY = this._constrainDimension(this.viewY + y * this.viewZoom,
			this.height * this.viewZoom, this.game.fieldHeight);
};

Viewport.prototype.zoomBy = function (factor) {
	this.viewZoom *= factor;
	this.translate(0, 0);
};

/////////////
// Button //
///////////

inherits(Button, Widget);
function Button(client, opt /* x, y, width, height, caption, callback */) {
	Widget.call(this, client, opt);
	this.caption = opt.caption || '';
	this.onClick = new Event();
	if (opt.callback) {
		this.onClick.register(opt.callback);
	}
}

Button.prototype.handleClick = function (x, y) {
	this.onClick.emit();
};

Button.prototype.draw = function (ctx, uiCtx) {
	ctx.save();
	if (uiCtx.buttonFillStyle) {
		ctx.fillStyle = uiCtx.buttonFillStyle;
		ctx.fillRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);
	}
	if (uiCtx.buttonBorderStyle) {
		ctx.strokeStyle = uiCtx.buttonBorderStyle;
		ctx.strokeRect(this.x, this.y, this.width, this.height);
	}
	if (this.caption && uiCtx.buttonTextStyle) {
		ctx.fillStyle = uiCtx.buttonTextStyle;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(this.caption, this.x + this.width / 2, this.y + this.height / 2, this.width);
	}
	ctx.restore();
};

///////////////////////////
// PerformanceIndicator //
/////////////////////////

inherits(PerformanceIndicator, Widget);
function PerformanceIndicator(client, opt) {
	Widget.call(this, client, opt);
}

PerformanceIndicator.prototype.draw = function (ctx, uiCtx) {
	var game = this.client.game;
	ctx.fillStyle = '#fff';
	ctx.fillText(
		'permitted ' + game.lastPermittedTick +
			', processed ' + game.lastProcessedTick +
			', sinceTick ' + padToThree(game.msecsSinceTick) +
			', sinceDrawn ' + padToThree(game.msecsSinceDrawn),
		10, 10
	);

};

///////////////////////////////////////
// Connection (Web Socket handling) //
/////////////////////////////////////

function Connection(game, url) {
	var self = this;
	this.game = game;
	this.logging = false;
	this.socket = new WebSocket(url);
	this.socket.onopen = function () {
		self.handleOpen();
	};
	this.socket.onmessage = function (evt) {
		self.handleMessage(evt);
	};
}

Connection.INCOMING_LOG_FILTER = /^\d+,"tick",\d+$/;

Connection.OUTGOING_LOG_FILTER = /^\d+,"ack",\d+,\d+$/;

Connection.prototype.setLogging = function (value) {
	this.logging = value && typeof console != 'undefined';
};

Connection.prototype.handleOpen = function () {
};

Connection.prototype.handleMessage = function (evt) {
	if (this.logging && !evt.data.match(Connection.INCOMING_LOG_FILTER)) {
		console.info('Received: ' + evt.data);
	}
	if (evt.data) {
		this.game.handleMessageString(evt.data);
	}
};

Connection.prototype.send = function (data) {
	if (this.logging && !data.match(Connection.OUTGOING_LOG_FILTER)) {
		console.info('Sent: ' + data);
	}
	this.socket.send(data);
};

/////////////
// Client //
///////////

function Client(game, canvas, uiContext) {
	var self = this;
	assert(instanceOf(game, Game), 'Client: game must be a Game');
	assert(canvas, 'Client: canvas is required');
	assert(uiContext, 'Client: uiContext is required');
	this.game = game;
	this.canvas = canvas;
	this.context = this.canvas.getContext('2d');
	this.uiContext = uiContext;
	this.widgets = [];
	this.onresizewindow = null;

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
	assert(instanceOf(widget, Widget), 'Client.add: widget must be a Widget');
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