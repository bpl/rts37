// Firing Solution                //
// Generic user interface objects //

/////////////
// Widget //
///////////

function Widget(client) {
	assert(instanceOf(client, Client), 'Viewport: client must be a Client');
	this.client = client;
	this.viewportX = 0;
	this.viewportY = 0;
	this.viewportWidth = 800;
	this.viewportHeight = 600;
}

Widget.prototype.handleClick = function (x, y) {
	// By default, do nothing
};

Widget.prototype.handleMouseMove = function (x, y) {
	// By default, do nothing
};

Widget.prototype.handleKeyPress = function (key) {
	// By default, do nothing
};

///////////////
// Viewport //
/////////////

inherits(Viewport, Widget);
function Viewport(client) {
	Widget.call(this, client);
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

Viewport.prototype.viewToWorld = function (x, y) {
	return [(x - this.viewportX) * this.viewZoom + this.viewX - this.viewportWidth / 2 * this.viewZoom << 10,
			(y - this.viewportY) * this.viewZoom + this.viewY - this.viewportHeight / 2 * this.viewZoom << 10];
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
		this.autoScrollX = this._autoScrollDimension(x, this.viewportX, this.viewportWidth);
		this.autoScrollY = this._autoScrollDimension(y, this.viewportY, this.viewportHeight);
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
			this.viewportWidth * this.viewZoom, this.game.fieldWidth);
	this.viewY = this._constrainDimension(this.viewY + y * this.viewZoom,
			this.viewportHeight * this.viewZoom, this.game.fieldHeight);
};

Viewport.prototype.zoomBy = function (factor) {
	this.viewZoom *= factor;
	this.translate(0, 0);
};

///////////////////////////
// PerformanceIndicator //
/////////////////////////

inherits(PerformanceIndicator, Widget);
function PerformanceIndicator(client) {
	Widget.call(this, client);
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

	this.canvas.addEventListener('keypress', function (evt) {
		self.handleKeyPress(evt);
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
		if (offset.x >= widget.viewportX
				&& offset.x < widget.viewportX + widget.viewportWidth
				&& offset.y >= widget.viewportY
				&& offset.y < widget.viewportY + widget.viewportHeight) {
			widget.handleClick(offset.x, offset.y);
		}
	}
};

Client.prototype.handleMouseMove = function (evt) {
	evt.preventDefault();
	var offset = this.normalizedOffset(evt);
	for (var i = this.widgets.length - 1; i >= 0; --i) {
		var widget = this.widgets[i];
		if (offset.x >= widget.viewportX
				&& offset.x < widget.viewportX + widget.viewportWidth
				&& offset.y >= widget.viewportY
				&& offset.y < widget.viewportY + widget.viewportHeight) {
			widget.handleMouseMove(offset.x, offset.y);
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
		this.widgets[i].handleKeyPress(letter);
	}
};