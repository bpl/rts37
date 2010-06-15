// Firing Solution  //
// Client Main File //

///////////////
// Viewport //
/////////////

function Viewport(game, canvas, uiContext) {
	assert(instanceOf(game, Game), 'Viewport: game must be a game');
	assert(canvas, 'Viewport: canvas is required');
	assert(instanceOf(uiContext, UIContext), 'Viewport: uiContext must be an UIContext');
	this.game = game;
	this.canvas = canvas;
	this.uiContext = uiContext;
	this.viewportX = 0;
	this.viewportY = 0;
	this.viewportWidth = 800;
	this.viewportHeight = 600;
	this.autoScrollRegion = 100;
	this.autoScrollMultiplier = 0.5;
	this.viewX = this.game.fieldWidth / 2;
	this.viewY = this.game.fieldHeight / 2;
	this.viewZoom = 1;
	this.lastMouseX = 0;
	this.lastMouseY = 0;
	this.autoScrollX = 0;
	this.autoScrollY = 0;
};

Viewport.prototype.tick = function () {
	if (this.autoScrollX != 0 || this.autoScrollY != 0) {
		this.translate(this.autoScrollX, this.autoScrollY);
	}
};

Viewport.prototype.draw = function () {
	var ctx = this.canvas.getContext('2d');
	ctx.save();
	ctx.translate(this.viewportX, this.viewportY);
	// Set clipping area and clear the background
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(this.viewportWidth, 0);
	ctx.lineTo(this.viewportWidth, this.viewportHeight);
	ctx.lineTo(0, this.viewportHeight);
	ctx.clip();
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
	ctx.scale(1 / this.viewZoom, 1 / this.viewZoom);
	ctx.lineWidth = (this.viewZoom > 1 ? this.viewZoom : 1);
	ctx.translate(-this.viewX + this.viewportWidth / 2 * this.viewZoom,
			-this.viewY + this.viewportHeight / 2 * this.viewZoom);
	// Draw firing range spheres
	ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
	ctx.beginPath();
	for (var idx in this.game.actors) {
		if (typeof this.game.actors[idx].addFiringArc == 'function') {
			this.game.actors[idx].addFiringArc(ctx, 0, this.game.factor);
			ctx.closePath();
		}
	}
	ctx.fill();
	ctx.fillStyle = '#000';
	ctx.beginPath();
	for (var idx in this.game.actors) {
		if (typeof this.game.actors[idx].addFiringArc == 'function') {
			this.game.actors[idx].addFiringArc(ctx, -1, this.game.factor);
			ctx.closePath();
		}
	}
	ctx.fill();
	// Draw radar spheres or wedges
	if (this.game.showRadarAsSpinning) {
		ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
		ctx.beginPath();
		for (var idx in this.game.actors) {
			if (typeof this.game.actors[idx].addRadarArc == 'function') {
				this.game.actors[idx].addRadarArc(ctx, 0, this.game.factor);
			}
		}
		ctx.fill();
	} else {
		ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
		ctx.beginPath();
		for (var idx in this.game.actors) {
			if (typeof this.game.actors[idx].addRadarArc == 'function') {
				this.game.actors[idx].addRadarArc(ctx, 0, this.game.factor);
				ctx.closePath();
			}
		}
		ctx.fill();
		ctx.fillStyle = '#000';
		ctx.beginPath();
		for (var idx in this.game.actors) {
			if (typeof this.game.actors[idx].addRadarArc == 'function') {
				this.game.actors[idx].addRadarArc(ctx, -1, this.game.factor);
				ctx.closePath();
			}
		}
		ctx.fill();
	}
	// Draw the boundaries of the playfield
	ctx.strokeStyle = '#fff';
	ctx.strokeRect(0, 0, this.game.fieldWidth, this.game.fieldHeight);
	// Draw everything else
	for (var idx in this.game.actors) {
		this.game.actors[idx].draw(ctx, this.uiContext, this.game.factor);
	}
	ctx.restore();
};

Viewport.prototype.viewToWorld = function (x, y) {
	return [(x - this.viewportX) * this.viewZoom + this.viewX - this.viewportWidth / 2 * this.viewZoom << 10,
			(y - this.viewportY) * this.viewZoom + this.viewY - this.viewportHeight / 2 * this.viewZoom << 10];
};

Viewport.prototype.handleClick = function (x, y) {
	var target = this.viewToWorld(x, y);
	for (var idx in this.game.actors) {
		var actor = this.game.actors[idx];
		if (actor.player == this.game.localPlayer && instanceOf(actor, Ship)
				&& actor.clickTest(target[0], target[1], this.game.factor)) {
			this.uiContext.setSelection([actor]);
			return;
		}
	}
	for (var idx in this.uiContext.selectedActors) {
		var actor = this.uiContext.selectedActors[idx];
		this.game.issueCommand(actor.player, ['GO', actor.id, target[0], target[1]]);
	}
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
		case 'x':
			this.fireWithSelected();
			break;
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

Viewport.prototype.fireWithSelected = function () {
	for (var idx in this.uiContext.selectedActors) {
		var actor = this.uiContext.selectedActors[idx];
		if (actor.player == this.game.localPlayer
				&& instanceOf(actor, Ship)) {
			actor.fireAtPos(this.lastMouseX, this.lastMouseY);
		}
	}
};

/////////////////////////
// WebSocket handling //
///////////////////////

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

Connection.prototype.setLogging = function (value) {
	this.logging = value && typeof console != 'undefined';
};

Connection.prototype.handleOpen = function () {
};

Connection.prototype.handleMessage = function (evt) {
	if (this.logging) {
		console.info('Received: ' + evt.data);
	}
	this.game.handleMessageString(evt.data);
};

Connection.prototype.send = function (data) {
	if (this.logging) {
		console.info('Sent: ' + data);
	}
	this.socket.send(data);
};

////////////////
// Bootstrap //
//////////////

function initGame(isLocal) {
	var splash = document.getElementById('splash');
	splash.parentNode.removeChild(splash);
	var canvas = document.getElementById('screen');
	assert(canvas, 'initGame: canvas not found');
	var game = new MyGame(isLocal);
	var uiContext = new UIContext(game);
	var viewport = new Viewport(game, canvas, uiContext);
	game.setTicksPerSecond(5);
	window.setInterval(game.getGameLoop(
		function () {
			viewport.tick();
		},
		function () {
			uiContext.update();
			viewport.draw();
		}),
		10
	);
	canvas.addEventListener('click', function (evt) {
		evt.preventDefault();
		viewport.handleClick(evt.clientX - canvas.offsetLeft, evt.clientY - canvas.offsetTop);
	}, false);
	canvas.addEventListener('mousemove', function (evt) {
		evt.preventDefault();
		viewport.handleMouseMove(evt.clientX - canvas.offsetLeft, evt.clientY - canvas.offsetTop);
	}, false);
	document.addEventListener('keypress', function (evt) {
		evt.preventDefault();
		var code = evt.keyCode || evt.charCode;
		if (code >= 65 && code <= 90) {
			viewport.handleKeyPress(String.fromCharCode(code + 32));
		} else if (code >= 97 && code <= 122) {
			viewport.handleKeyPress(String.fromCharCode(code));
		}
	}, false);
	if (isLocal) {
		// Set up a test enviroment
		var humanPlayer = game.createActor(Commander, {
			'id': game.nextId(),
			'playerId': 'p1',
			'color': '#ff0000'
		});
		game.handleMessage([0, 'youAre', humanPlayer]);
		var dummyPlayer = game.createActor(Commander, {
			'id': game.nextId(),
			'playerId': 'p2',
			'color': '#0000ff'
		});
		game.createActor(Ship, {
			'id': game.nextId(),
			'player': humanPlayer,
			'x': 100 << 10, 'y': 100 << 10
		});
		game.createActor(Ship, {
			'id': game.nextId(),
			'player': humanPlayer,
			'x': 200 << 10, 'y': 100 << 10
		});
		game.createActor(AIShip, {
			'id': game.nextId(),
			'player': dummyPlayer,
			'x': 200 << 10, 'y': 200 << 10,
			'waypoints': [[100 << 10, 500 << 10], [700 << 10, 550 << 10]]
		});
		game.setRunning(true);
	} else {
		// Connect to server
		var connection = new Connection(game, 'ws://localhost:8000/?game=A&player=p1');
		connection.setLogging(true);
		game.setConnection(connection);
		// FIXME: Load initial game state from the server
	}
}