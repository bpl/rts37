// Firing Solution  //
// Client Main File //

/////////////////
// MyViewport //
///////////////

inherits(MyViewport, Viewport);
function MyViewport(client, opt /* x, y, width, height */) {
	Viewport.call(this, client, opt);
}

MyViewport.prototype.draw = function (ctx, uiCtx) {
	ctx.save();
	ctx.translate(this.x, this.y);
	// Set clipping area and clear the background
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(this.width, 0);
	ctx.lineTo(this.width, this.height);
	ctx.lineTo(0, this.height);
	ctx.clip();
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, this.width, this.height);
	ctx.scale(1 / this.viewZoom, 1 / this.viewZoom);
	ctx.lineWidth = (this.viewZoom > 1 ? this.viewZoom : 1);
	ctx.translate(-this.viewX + this.width / 2 * this.viewZoom,
			-this.viewY + this.height / 2 * this.viewZoom);
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
	// Draw radar spheres
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
	// Draw the boundaries of the playfield
	ctx.strokeStyle = '#fff';
	ctx.strokeRect(0, 0, this.game.fieldWidth, this.game.fieldHeight);
	// Draw map tiles
	this.game.map.draw(ctx, uiCtx, this.game.factor);
	// Draw everything else
	for (var idx in this.game.actors) {
		this.game.actors[idx].draw(ctx, uiCtx, this.game.factor);
	}
	ctx.restore();
};

MyViewport.prototype.handleKeyPress = function (key) {
	switch (key) {
		case 'x':
			this.fireWithSelected();
			break;
		default:
			Viewport.prototype.handleKeyPress.call(this, key);
			break;
	}
};

MyViewport.prototype.fireWithSelected = function () {
	for (var idx in this.client.uiContext.selectedActors) {
		var actor = this.client.uiContext.selectedActors[idx];
		if (actor.player == this.game.localPlayer
				&& instanceOf(actor, Ship)) {
			actor.issueFireAtPos(this.lastMouseX, this.lastMouseY);
		}
	}
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
	game.setTicksPerSecond(5);
	game.setCappedToFps(30);
	var uiContext = new UIContext(game);
	var client = new Client(game, canvas, uiContext);

	var viewport = new MyViewport(client, {
		'x': 0, 'y': 0,
		'width': 500, 'height': 500
	});
	client.add(viewport);

	client.add(new PerformanceIndicator(client));

	var testButton = new Button(client, {
		'width': 40, 'height': 40,
		'caption': 'Test',
		'callback': function () {
			alert('Leave me alone!');
		}
	});
	client.add(testButton);

	client.onresizewindow = function (evt) {
		var nw = window.innerWidth;
		var nh = window.innerHeight;
		canvas.width = nw;
		canvas.height = nh;
		viewport.resize(nw, nh);
		testButton.move(10, nh - testButton.height - 10);
	};
	client.onresizewindow();

	return game;
}

function createRemoteGame() {
	var state = document.getElementById('f-create-state').value,
		gameId = document.getElementById('f-create-gameId').value,
		playerId = document.getElementById('f-create-playerId').value,
		game = initGame(false),
		connection = new Connection(game, 'ws://localhost:8000/?game=' + escape(gameId) + '&player=' + escape(playerId) + '&state=' + escape(state));
	connection.setLogging(true);
	game.setConnection(connection);
}

function joinRemoteGame() {
	var gameId = document.getElementById('f-join-gameId').value,
		playerId = document.getElementById('f-join-playerId').value,
		game = initGame(false),
		connection = new Connection(game, 'ws://localhost:8000/?game=' + escape(gameId) + '&player=' + escape(playerId));
	connection.setLogging(true);
	game.setConnection(connection);
}

function localGame() {
	var state = document.getElementById('f-local-state').value,
		playerId = document.getElementById('f-local-playerId').value;
	try {
		state = stateSpecToArray(state);
	} catch (e) {
		alert('Parse error in initial game state. Check console for details.');
		throw e;
	}
	var game = initGame(true);
	for (var i = 0; i < state.length; ++i) {
		var msg = state[i],
			parts = ['0'];
		for (var j = 0; j < msg.length; ++j) {
			parts.push(JSON.stringify(msg[j]));
		}
		game.handleMessageString(parts.join(','));
	}
	var player = game.playerWithPlayerId(playerId);
	if (!player) {
		alert('Incorrect player ID');
		return;
	}
	game.handleMessage([0, 'youAre', player.id]);
	game.setRunning(true);
}

//////////////////////////////
// User interface controls //
////////////////////////////

window.addEventListener('load', function () {
	function hasClass(elm, className) {
		var parts = elm.className.split(' ');
		for (var i = 0; i < parts.length; ++i) {
			if (parts[i] == className) {
				return true;
			}
		}
		return false;
	}

	function addClass(elm, className) {
		var parts = elm.className.split(' ');
		for (var i = 0; i < parts.length; ++i) {
			if (parts[i] == className) {
				return;
			}
		}
		parts.push(className);
		elm.className = parts.join(' ');
	}

	function removeClass(elm, className) {
		var parts = elm.className.split(' ');
		for (var i = 0; i < parts.length; ++i) {
			if (parts[i] == className) {
				parts.splice(i, 1);
				elm.className = parts.join(' ');
				return;
			}
		}
	}

	function getParentWithClassName(elm, className) {
		while (elm) {
			if (hasClass(elm, className)) {
				return elm;
			}
			elm = elm.parentNode;
		}
		return null;
	}

	var splash = document.getElementById('splash');

	splash.addEventListener('click', function (evt) {
		if (evt.target.tagName.toLowerCase() == 'a') {
			var parentList = getParentWithClassName(evt.target, 'tabs');
			if (!parentList) {
				return;
			}
			evt.preventDefault();
			if (hasClass(evt.target, 'selected')) {
				return;
			}
			var tabs = parentList.getElementsByTagName('li');
			for (var i = 0; i < tabs.length; ++i) {
				var tab = tabs[i],
					sheet = document.getElementById(tab.firstChild.href.match(/#(.*)$/)[1]);
				if (sheet) {
					if (tab.firstChild == evt.target) {
						addClass(tab, 'selected');
						removeClass(sheet, 'hidden');
					} else {
						removeClass(tab, 'selected');
						addClass(sheet, 'hidden');
					}
				}
			}
		}
	});
});