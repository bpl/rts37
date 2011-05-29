///////////
// Game //
/////////

define(['engine/world/Event', 'engine/world/Player'], function (Event, Player) {

	function Game(isLocal) {
		this.localPlayer = null;
		//
		// Actor handling
		//
		this.actors = [];
		this.additionQueue = [];
		this.deletionQueue = [];
		this.actorByIdHash = {};
		// FIXME: Use some other method to create unique IDs
		this.previousId = 10000;
		//
		// Pacing information
		//
		// Should the game be running, according to the server or the user
		this.running = false;
		// Is the game really running (it might not be, even if it should, if
		// somebody is lagging).
		this.reallyRunning = false;
		this.lastProcessedTick = 0;
		this.lastPermittedTick = 0;
		this.ticksPerSecond = 0;
		this.msecsPerTick = 0;
		this.cappedToFps = 0;
		// How far into the current tick we are
		this.msecsSinceTick = 0;
		this.lastConsideredTick = 0;
		this.lastTickAt = 0;
		this.setTicksPerSecond(5);
		//
		// Server communication
		//
		this.isLocal = isLocal;
		this.lastTagReceived = 0;
		// The last item is an array (queue) of commands to process at the next tick.
		// The commands received during this turn are pushed to item 0.
		this.commandQueues = [[]];
		this.acknowledgeAt = 0;
		this.connection = null;
		this.decoder = Activator.getDecoder(this);
		//
		// Events
		//
		// Emitted after a tick has been processed
		this.onTick = new Event();
	}

	Game.prototype.setLocalPlayer = function (player) {
		this.localPlayer = player;
	};

	Game.prototype.setConnection = function (connection) {
		assert(typeof connection == 'object', 'Game.setConnection: connection is not an object');
		assert(connection === null || typeof connection.send == 'function', 'Game.setConnection: connection.send is not a function');
		this.connection = connection;
	};

	Game.prototype.setTicksPerSecond = function (value) {
		this.ticksPerSecond = value;
		this.msecsPerTick = 1000 / value;
	};

	Game.prototype.setCappedToFps = function (value) {
		this.cappedToFps = value;
	};

	Game.prototype.setRunning = function (value) {
		this.running = value;
		if (!value) {
			this.reallyRunning = false;
		}
	};

	Game.prototype.tick = function () {
		while (this.additionQueue.length > 0) {
			this.actors.push(this.additionQueue.shift());
		}
		for (var i = 0; i < this.actors.length; ++i) {
			this.actors[i].tick();
		}
		while (this.deletionQueue.length > 0) {
			var actor = this.deletionQueue.shift();
			this.actors.splice(this.actors.indexOf(actor), 1);
			actor.afterRemove();
		}
		this.onTick.emit();
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

	// The main game loop. This should be called repeatedly from a timer.
	Game.prototype.gameLoop = function () {
		// FIXME: Handle client lagging behind the server. Temporarily reduce
		// tick duration to catch up discreetly.
		// FIXME: Soft adjustment for situations where the client has a tendency to
		// speed past the server.
		//
		// Acknowledgement handling. Send acknowledgement 100 msecs after receiving
		// a message that has not been acknowledgement yet, and after processing a
		// new tick.
		if (!this.isLocal) {
			if (this.acknowledgeAt > 0 && this.acknowledgeAt <= (new Date()).getTime()) {
				this.acknowledgeAt = 0;
				this.notifyServer(['ack', this.lastTagReceived, this.lastProcessedTick]);
			}
		}
		// If the game loop is not running, check if we can start or resume it
		if (!this.reallyRunning) {
			if (this.running && (this.isLocal || this.lastPermittedTick > this.lastProcessedTick)) {
				this.lastConsideredTick = (new Date()).getTime();
				this.msecsSinceTick = 0;
				this.reallyRunning = true;
			}
		}
		// If the game loop is running, check if the projected time for the next
		// tick has elapsed. If so, advance.
		if (this.reallyRunning) {
			var timeNow = (new Date()).getTime();
			var elapsedMsecs = timeNow - this.lastConsideredTick;
			this.msecsSinceTick += elapsedMsecs;
			this.lastConsideredTick = timeNow;
			// If this a local game and we have been paused for a long time,
			// don't do any catchup.
			if (this.isLocal && this.msecsSinceTick > 500) {
				this.msecsSinceTick = this.msecsPerTick;
			}
			// Only process a certain number of ticks per invocation to avoid
			// locking up the browser after the script has been paused for a
			// long time and then resumed.
			var catchupTicks = 10;
			while (this.msecsSinceTick >= this.msecsPerTick && catchupTicks > 0) {
				if (this.isLocal || this.lastPermittedTick > this.lastProcessedTick) {
					// We have a clearance to process the next tick, so process it
					if (!this.isLocal) {
						this.processCommandQueue();
					}
					// Then handle the tick
					this.tick();
					this.lastProcessedTick++;
					if (!this.isLocal) {
						this.queueAcknowledgement();
					}
					this.msecsSinceTick -= this.msecsPerTick;
					this.lastTickAt = timeNow;
					catchupTicks--;
				} else {
					// The scheduled time to process the next tick has passed, but
					// we are missing the clearance to process it. We need to
					// resynchronize the game.
					// FIXME: Currently this causes an irritating jab when the game
					// resynchronizes while an unit is moving. It would probably be
					// a good idea to keep the interpolation factor at 0 while
					// resynchronizing or reset all the delta values when it becomes
					// clear that we must resynchronize.
					this.reallyRunning = false;
					catchupTicks = 0;
				}
			}
		}
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

	return Game;

});