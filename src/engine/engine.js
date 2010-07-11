// Firing Solution           //
// Core generic game objects //

////////////
// Actor //
//////////

function Actor(x, y) {
	this.game = null;
	this.id = null;
	this.x = x;
	this.y = y;
	// Delta from last. This should be positive if the value has increased since last tick and
	// negative if the value has decreased since last tick. It will be multiplied with
	// the interpolation factor and *substracted* from the current value (yes, the interpolation
	// factor is a bit backwards, but removes one calculation step).
	this.dflX = 0;
	this.dflY = 0;
}

Actor.prototype.setGame = function (game) {
	assert(instanceOf(game, Game), 'Actor.setGame: game must be a Game');
	assert(this.game === null, 'Actor.setGame: must not set game twice');
	this.game = game;
};

Actor.prototype.afterRemove = function () {
	// this function intentionally left blank
};

Actor.prototype.tick = function () {
	// This function intentionally left blank
};

Actor.prototype.draw = function (ctx, uiCtx, factor) {
	// This function intentionally left blank
};

Actor.prototype.clickTest = function (x, y, factor) {
	return false;
};

/////////////
// Player //
///////////

inherits(Player, Actor);
function Player(opt /* id, playerId */) {
	assert(typeof opt.id == 'number', 'Player: id must be a number');
	assert(typeof opt.playerId == 'string', 'Player: playerId must be a string');
	Actor.call(this, 0, 0);
	this.id = opt.id;
	this.playerId = opt.playerId;
}

/////////////////////
// CollisionBound //
///////////////////

function CollisionBound(x, y, radius, isLow, actor) {
	this.isLow = isLow;
	this.radius = radius;
	this.x = x + (this.isLow ? -this.radius : this.radius);
	this.y = y;
	this.actor = actor;
	this.next = null;
	this.prev = null;
}

CollisionBound.prototype.addBefore = function (bound) {
	if (bound.prev) {
		bound.prev.next = this;
	}
	this.prev = bound.prev;
	this.next = bound;
	bound.prev = this;
};

CollisionBound.prototype.addAfter = function (bound) {
	if (bound.next) {
		bound.next.prev = this;
	}
	this.next = bound.next;
	this.prev = bound;
	bound.next = this;
};

CollisionBound.prototype.remove = function () {
	if (this.next) {
		this.next.prev = this.prev;
	}
	if (this.prev) {
		this.prev.next = this.next;
	}
	this.next = null;
	this.prev = null;
};

CollisionBound.prototype.setRadius = function (radius) {
	this.radius = radius;
};

CollisionBound.prototype.setPosition = function (x, y) {
	x = x + (this.isLow ? -this.radius : this.radius);
	this.x = x;
	this.y = y;
	while (this.prev && x < this.prev.x) {
		var prev = this.prev;
		if (this.next) {
			this.next.prev = prev; 
		}
		if (prev.prev) {
			prev.prev.next = this;
		}
		prev.next = this.next;
		this.prev = prev.prev;
		prev.prev = this;
		this.next = prev;
	}
	while (this.next && x > this.next.x) {
		var next = this.next;
		if (this.prev) {
			this.prev.next = next; 
		}
		if (next.next) {
			next.next.prev = this;
		}
		next.prev = this.prev;
		this.next = next.next;
		next.next = this;
		this.prev = next;
	}
};

///////////////////////
// CollisionContext //
/////////////////////

function CollisionContext(game) {
	assert(instanceOf(game, Game), 'CollisionContext: game must be a Game');
	this.lowSentinel = new CollisionBound(-Infinity, 0, 0, true, null);
	this.highSentinel = new CollisionBound(Infinity, 0, 0, false, null);
	this.highSentinel.addAfter(this.lowSentinel);
	game.addManager(this);
}

CollisionContext.prototype.getLowBound = function (actor, radius) {
	var bound = new CollisionBound(0, 0, radius, true, actor);
	bound.addAfter(this.lowSentinel);
	bound.setPosition(actor.x, actor.y);
	return bound;
};

CollisionContext.prototype.getHighBound = function (actor, radius) {
	var bound = new CollisionBound(0, 0, radius, false, actor);
	bound.addAfter(this.lowSentinel);
	bound.setPosition(actor.x, actor.y);
	return bound;
};

CollisionContext.prototype.getCollisions = function () {
	var collided = {},
		bound = this.lowSentinel.next;
	if (bound == this.highSentinel) {
		return;
	}
	while (bound) {
		var bound2 = bound.next;
		while (bound2.actor != bound.actor) {
			if (bound2.isLow) {
				var dist = bound.y - bound2.y;
				if ((dist > 0 ? dist : -dist) < bound.radius + bound2.radius) {
					if (Math.pow(bound.actor.x - bound2.actor.x, 2) + Math.pow(bound.actor.y - bound2.actor.y, 2) < Math.pow(bound.radius + bound2.radius, 2)) {
						collided[bound.actor.id] = true;
						collided[bound2.actor.id] = true;
					}
				}
			}
			bound2 = bound2.next;
		}
		do {
			bound = bound.next;
		} while (bound && !bound.isLow);
	}
	return collided;
};

CollisionContext.prototype.tick = function () {
	var collisions = [],
		bound = this.lowSentinel.next;
	if (bound == this.highSentinel) {
		return;
	}
	while (bound) {
		var bound2 = bound.next;
		while (bound2.actor != bound.actor) {
			if (bound2.isLow) {
				var dist = bound.y - bound2.y;
				if ((dist > 0 ? dist : -dist) < bound.radius + bound2.radius) {
					if (Math.pow(bound.actor.x - bound2.actor.x, 2) + Math.pow(bound.actor.y - bound2.actor.y, 2) < Math.pow(bound.radius + bound2.radius, 2)) {
						collisions.push([bound.actor, bound2.actor]);
					}
				}
			}
			bound2 = bound2.next;
		}
		do {
			bound = bound.next;
		} while (bound && !bound.isLow);
	}
	for (var i = 0; i < collisions.length; ++i) {
		var collision = collisions[i];
		collision[0].afterCollision(this, collision[1]);
		collision[1].afterCollision(this, collision[0]);
	}
};

///////////
// Game //
/////////

function Game(isLocal) {
	this.localPlayer = null;
	this.managers = [];
	// Actor handling
	this.actors = [];
	this.additionQueue = [];
	this.deletionQueue = [];
	this.actorByIdHash = {};
	// FIXME: Use some other method to create unique IDs
	this.previousId = 10000;
	// Interpolation factor. Value 0 means that the frame that is being rendered or that
	// has been rendered reflects the current simulation state. Value -1 means that the frame
	// that is being rendered or has been rendered reflects the previous simulation state.
	this.factor = 0;
	// Pacing information
	this.running = false;
	this.lastProcessedTick = 0;
	this.lastPermittedTick = 0;
	this.ticksPerSecond = 0;
	this.msecsPerTick = 0;
	this.msecsSinceDrawn = 0;
	this.setTicksPerSecond(30);
	// Server communication
	this.isLocal = isLocal;
	this.lastTagReceived = 0;
	// The last item is an array (queue) of commands to process at the next tick.
	// The commands received during this turn are pushed to item 0.
	this.commandQueues = [[]];
	this.acknowledgeAt = 0;
	this.connection = null;
	this.decoder = Activator.getDecoder(this);
}

Game.prototype.setLocalPlayer = function (player) {
	this.localPlayer = player;
};

Game.prototype.setConnection = function (connection) {
	assert(typeof connection == 'object', 'Game.setConnection: connection is not an object');
	assert(connection === null || typeof connection.send == 'function', 'Game.setConnection: connection.send is not a function');
	this.connection = connection;
};

Game.prototype.addManager = function (manager) {
	this.managers.push(manager);
};

Game.prototype.setTicksPerSecond = function (value) {
	this.ticksPerSecond = value;
	this.msecsPerTick = 1000 / value;
};

Game.prototype.setRunning = function (value) {
	this.running = value;
};

Game.prototype.tick = function () {
	while (this.additionQueue.length > 0) {
		this.actors.push(this.additionQueue.shift());
	}
	for (var i = 0; i < this.actors.length; ++i) {
		this.actors[i].tick();
	}
	for (var i = 0; i < this.managers.length; ++i) {
		this.managers[i].tick();
	}
	while (this.deletionQueue.length > 0) {
		var actor = this.deletionQueue.shift();
		this.actors.splice(this.actors.indexOf(actor), 1);
		actor.afterRemove();
	}
};

Game.prototype.nextId = function () {
	return ++this.previousId;
};

Game.prototype.addActor = function (actor /* or: type, opt */) {
	if (arguments.length == 2) {
		actor = new arguments[0](arguments[1]);
	}
	if (this.running) {
		this.additionQueue.push(actor);
	} else {
		this.actors.push(actor);
	}
	if (actor.id !== null) {
		this.actorByIdHash[actor.id] = actor;
	}
	actor.setGame(this);
	return actor;
};

Game.prototype.removeActor = function (actor) {
	var idx = this.actors.indexOf(actor);
	if (idx >= 0 && this.deletionQueue.indexOf(actor) < 0) {
		if (this.running) {
			this.deletionQueue.push(actor);
		} else {
			this.actors.splice(idx, 1);
			actor.afterRemove();
		}
	}
	if (actor.id !== null) {
		delete this.actorByIdHash[actor.id];
	}
};

Game.prototype.actorWithId = function (id) {
	return this.actorByIdHash[id];
};

Game.prototype.resolveId = Game.prototype.actorWithId;

Game.prototype.playerWithPlayerId = function (playerId) {
	for (var i = 0; i < this.actors.length; ++i) {
		var actor = this.actors[i];
		if (instanceOf(actor, Player)) {
			if (actor.playerId == playerId) {
				return actor;
			}
		}
	}
	return null;
};

Game.prototype.getGameLoop = function (tickFunc, drawFunc) {
	// FIXME: Handle client lagging behind the server
	// FIXME: Soft adjustment for situations where the client has a tendency to
	// speed past the server.
	var self = this;
	// How much into the current tick we are
	var sinceTickMsecs = 0;
	var timeLast = 0;
	var lastDrawn = new Date();
	var loopRunning = false;
	return function () {
		// Acknowledgement handling. Send acknowledgement 100 msecs after
		// receiving a message that has not been acknowledgement yet, and after
		// processing a new tick.
		if (!self.isLocal) {
			if (self.acknowledgeAt > 0 && self.acknowledgeAt <= (new Date()).getTime()) {
				self.acknowledgeAt = 0;
				self.notifyServer(['ack', self.lastTagReceived, self.lastProcessedTick]);
			}
		}
		// If the game loop is not running, check if we can start or resume it
		if (!loopRunning) {
			if (self.running && (self.isLocal || self.lastPermittedTick > self.lastProcessedTick)) {
				timeLast = new Date();
				sinceTickMsecs = 0;
				loopRunning = true;
			}
		}
		// If the game loop is running, check if the projected time for the next
		// tick has elapsed. If so, advance.
		if (loopRunning) {
			var timeNow = new Date();
			var elapsedMsecs = timeNow.getTime() - timeLast.getTime();
			sinceTickMsecs += elapsedMsecs;
			timeLast = timeNow;
			if (sinceTickMsecs >= self.msecsPerTick) {
				if (self.isLocal || self.lastPermittedTick > self.lastProcessedTick) {
					// We have a clearance to process the next tick, so process it
					if (!self.isLocal) {
						self.processCommandQueue();
					}
					// Then handle the tick
					self.tick();
					tickFunc();
					self.lastProcessedTick++;
					if (!self.isLocal) {
						self.queueAcknowledgement();
					}
					sinceTickMsecs -= self.msecsPerTick;
				} else {
					// The scheduled time to process the next tick has passed,
					// but we are missing the clearance to process it. We need
					// to resynchronize the game.
					loopRunning = false;
				}
			}
		}
		// Finally, do drawing
		if (loopRunning) {
			self.factor = 1 - sinceTickMsecs / self.msecsPerTick;
			if (self.factor < 0) {
				self.factor = 0;
			}
		} else {
			self.factor = 0;
		}
		var timeNow = new Date();
		self.msecsSinceDrawn = timeNow.getTime() - lastDrawn.getTime();
		lastDrawn = timeNow;
		drawFunc();
	};
};

Game.prototype.processCommandQueue = function () {
	var tickCommands = this.commandQueues.pop();
	this.commandQueues.unshift([]);
	for (var i = 0; i < tickCommands.length; ++i) {
		var command = tickCommands[i];
		this.handleCommand(command[0], command[1]);
	}
};

// Decodes the specified message string and handles the individual messages contained there
Game.prototype.handleMessageString = function (str) {
	var msg = JSON.parse('{"d":[' + str + ']}', this.decoder)['d'];
	// [0] is the delivery tag
	// [1] is the type of the message
	this.handleMessage(msg);
};

Game.prototype.handleCommand = function (player, cmd) {
	// The command is a JavaScript array, where cmd[0] is a string indicating
	// the type of the command. Commands may need to be validated because the server
	// echoes command from the clients without parsing them.
	assert(false, 'Game.handleCommand: unknown command "' + cmd + '"');
};

Game.prototype.handleMessage = function (msg) {
	// The message is a JavaScript array where msg[0] is the delivery tag of the
	// message, msg[1] indicates the type of the message and the rest of the items
	// are message-specific parameters. Not much validation is necessary for
	// messages, because they are issued by the server.
	//
	// Delivery tag handling
	assert(typeof msg[0] == 'number', 'Game.handleMessage: message has no delivery tag');
	if (msg[0] > 0) {
		// If the message has been handled already, there is no need to handle it
		// again.
		if (msg[0] <= this.lastTagReceived) {
			return;
		}
		this.lastTagReceived = msg[0];
		this.queueAcknowledgement();
	}
	// Message type switch
	assert(typeof msg[1] == 'string', 'Game.handleMessage: message type is not a string');
	switch (msg[1]) {
		case 'C':
			// Command
			// [2] is the actor id of the player the command is from
			// [3] is the properties of the command
			var player = this.actorWithId(msg[2]);
			assert(instanceOf(player, Player), 'Game.handleMessage: player of C must be a Player');
			this.commandQueues[0].push([player, msg[3]]);
			break;
		case 'tick':
			// Tick permitted
			// [2] is the number of the tick we are now permitted to process
			// FIXME: Should we handle here returning to a paused game
			var tick = msg[2];
			assert(typeof tick == 'number', 'Game.handleMessage: tick must be a number');
			if (tick == this.lastPermittedTick + 1) {
				// Increase the last permitted tick to let the game loop proceed
				this.lastPermittedTick++;
			} else if (tick == 0 && this.lastPermittedTick == 0) {
				// Signal the start of the game
				this.running = true;
			} else {
				// Error, log it
				if (typeof console != 'undefined') {
					console.log('Error: Tick numbers out of sequence. Server told the next would be ' + tick + ', but the current is ' + this.lastPermittedTick);
				}
			}
			break;
		case 'AC':
			// Add actor to game (from parameters)
			// [2]['$type'] is the type of the actor to add
			// [2] is the parameters passed to the constructor
			var type = Activator.getType(msg[2]['$type']);
			this.addActor(new type(msg[2]));
			break;
		case 'youAre':
			// Set the local player
			// [2] is the actor id of the local player
			assert(!this.localPlayer, 'Game.handleMessage: local player is already set');
			var player = this.actorWithId(msg[2]);
			assert(instanceOf(player, Player), 'Game.handleMessage: player of youAre must be a Player');
			this.setLocalPlayer(player);
			break;
		case 'hello':
			// Server hello
			// Send the last delivery tag received and last tick processed in
			// response.
			this.notifyServer(['ack', this.lastTagReceived, this.lastProcessedTick]);
			break;
		case 'error':
			// Error
			// [2] is the error object
			// [2]['msg'] is a textual description of the error
			if (typeof console != 'undefined') {
				console.log('Server error: ' + msg[2]['msg']);
			}
			break;
		default:
			assert(false, 'Game.handleMessage: unrecognized message type "' + msg[1] + '"');
			break;
	}
};

Game.prototype.issueCommand = function (cmd) {
	if (this.isLocal) {
		this.handleCommand(this.localPlayer, cmd);
	} else {
		this.connection.send('2' + JSON.stringify(cmd));
	}
};

// Guaranteed delivery of a message to the server
Game.prototype.issueMessage = function (msg) {
	// FIXME: Make this actually work. The server doesn't currently expect the
	// client to send a message tag.
};

// Non-guaranteed delivery of a message to the server
Game.prototype.notifyServer = function (msg) {
	assert(!this.isLocal, 'Game.notifyServer: can\'t send because the game is local');
	if (this.connection) {
		var parts = ['1'];
		for (var i = 0; i < msg.length; ++i) {
			parts.push(JSON.stringify(msg[i]));
		}
		this.connection.send(parts.join(','));
	}
};

// Send acknowledgement to server after at most 100 milliseconds
Game.prototype.queueAcknowledgement = function () {
	if (this.acknowledgeAt <= 0) {
		this.acknowledgeAt = (new Date()).getTime() + 100;
	}
};

// Convenience function for setting up local games
Game.prototype.createActor = function (type, opt) {
	return this.addActor(new type(opt));
};