// Copyright © 2012 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

define(['engine/util', 'engine/util/Event', 'engine/util/Channel', 'engine/world/Scenario', 'engine/util/TiledCollisionContext'], function (util, Event, Channel, Scenario, TiledCollisionContext) {

	function Game(isLocal) {
		this.localPlayer = null;
		//
		// Actor handling
		//
		this.actors = [];
		this.additionQueue = [];
		this.deletionQueue = [];
		this._actorsById = new util.Map();
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
		// Scenario information
		//
		this.scenario = null;
		this.players = [];   // FIXME: [] or {}?
		this.map = null;
		this.fieldWidth = 0;
		this.fieldHeight = 0;
		this.unitTypes = new util.Map();
		this.collisionData = null;
		//
		// Server communication
		//
		this.isLocal = isLocal;
		this.channel = new Channel();
		this.channel.didReceiveMessage.register(this.handleMessage, this);
		this.channel.didEncounterError.register(this._channelDidEncounterError, this);
		// The last item is an array (queue) of commands to process at the next tick.
		// The commands received during this turn are pushed to item 0.
		this.commandQueues = [[]];
		this.acknowledgeAt = 0;
		this.notifyAssetReadyAt = 0;
		//
		// Events
		//
		// Emitted after a tick has been processed
		this.onTick = new Event();
	}

	Game.prototype._channelDidEncounterError = function (errorString) {
		console.error('Channel error: ' + errorString);
	};

	/**
	 * Loads scenario information and starts the game when everything is ready.
	 * @param {object} gameSpec
	 * @param {number} localPlayerId
	 */
	Game.prototype.loadScenario = function (gameSpec, localPlayerId) {
		this.scenario = new Scenario(this);
		this.scenario.didLoadAsset.register(this._didLoadAsset, this);
		this.scenario.didLoadAllAssets.register(this._didLoadAllAssets, this);
		this.scenario.load(gameSpec, localPlayerId);
	};

	/**
	 * Called by the scenario object when an asset has finished loading.
	 * @param {string} assetName
	 * @param {number} queued The number of assets queued so far
	 * @param {number} loaded The number of assets loaded so far
	 */
	Game.prototype._didLoadAsset = function (assetName, queued, loaded) {
		if (!this.isLocal) {
			// Send acknowledgement at most every 1000 milliseconds
			if (this.notifyAssetReadyAt <= 0) {
				// FIXME: Last of these has to be a guaranteed message
				this.notifyAssetReadyAt = (new Date()).getTime() + 1000;
			}
		}
	};

	/**
	 * Called by the scenario object when all assets have finished loading.
	 * @param {number} loaded Total number of loaded assets
	 */
	Game.prototype._didLoadAllAssets = function (loaded) {
		if (this.isLocal) {
			this.setRunning(true);
		}
	};

	/**
	 * Adds a player to the list of players. Typically call by the scenario
	 * object in the course of loading the scenario.
	 * @param {Player} player
	 */
	Game.prototype.addPlayer = function (player) {
		this.players[player.publicId] = player;
	};

	/**
	 * Sets the current map. Typically called by the scenario object in the
	 * course of loading the scenario.
	 * @param {Map} map
	 */
	Game.prototype.setMap = function (map) {
		this.map = map;
		this.fieldWidth = map.width * map.tileSize;
		this.fieldHeight = map.height * map.tileSize;

		var cc = new TiledCollisionContext(this.fieldWidth, this.fieldHeight, 64, 64, 1000);
		this.collisionData = {
			collisionUnits: this.actors,
			collisionContext: cc,
			collisionArray: cc.createCollisionArray(16),
			indexArray: cc.createIndexArray()
		};
	};

	/**
	 * Adds an unit type to the list of unit types. Typically called by the
	 * scenario object in the course of loading the scenario.
	 * @param {string} unitTypeName
	 * @param {object} unitType
	 */
	Game.prototype.addUnitType = function (unitTypeName, unitType) {
		util.assert(!this.unitTypes.has(unitTypeName), 'Game.addUnitType: unit type with name ' + unitTypeName + ' already exists');
		this.unitTypes.set(unitTypeName, unitType);
	};

	/**
	 * Sets the local player. Typically called by the scenario object in the
	 * course of loading the scenario.
	 * @param {number} publicId
	 */
	Game.prototype.setLocalPlayerId = function (publicId) {
		util.assert(!this.localPlayer, 'Game.setLocalPlayerId: local player is already set');
		var player = this.playerWithPublicId(publicId);
		util.assert(player, 'Game.setLocalPlayerId: player not found');
		this.localPlayer = player;
	};

	Game.prototype.setConnection = function (connection) {
		util.assert(typeof connection === 'object', 'Game.setConnection: connection is not an object');
		util.assert(connection && typeof connection.send === 'function', 'Game.setConnection: connection.send is not a function');
		this.channel.setConnection(connection);
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
		var actors = this.actors;

		while (this.additionQueue.length > 0) {
			actors.push(this.additionQueue.shift());
		}

		//             ___________________
		//            /  \       \        \
		//           /    v       v        v
		// Collisions    Unit -> Order -> Movement
		//                   \           ^
		//                    \_________/

		// Collision detection

		var cd = this.collisionData;
		var cc = cd.collisionContext;

		cc.sortIntoTiles(actors, actors.length);
		cc.getCollisionsAndIndices(cd.collisionArray, cd.indexArray);

		// Unit, command and movement handling

		for (var i = 0; i < actors.length; ++i) {
			actors[i].tick(i);
		}

		// Finish by cleaning up the actor array

		while (this.deletionQueue.length > 0) {
			var actor = this.deletionQueue.shift();
			actors.splice(actors.indexOf(actor), 1);
			actor.afterRemove();
		}
		this.onTick.emit();
	};

	Game.prototype.nextId = function () {
		return ++this.previousId;
	};

	Game.prototype.addActor = function (actor) {
		if (this.running) {
			this.additionQueue.push(actor);
		} else {
			this.actors.push(actor);
		}
		if (actor.id !== null) {
			this._actorsById.set(actor.id, actor);
		}
		return actor;
	};

	Game.prototype.createActor = function (type, opt) {
		var newOpt = {};
		for (var key in opt) {
			newOpt[key] = opt[key];
		}
		newOpt['game'] = this;
		this.addActor(new type(newOpt));
	};

	Game.prototype.createUnit = function (unitType, opt) {
		var newOpt = {};
		for (var key in opt) {
			newOpt[key] = opt[key];
		}
		newOpt['game'] = this;
		newOpt['unitType'] = unitType;
		this.addActor(new (unitType.unitClass)(newOpt));
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
			this._actorsById['delete'](actor.id);
		}
	};

	Game.prototype.actorWithId = function (id) {
		return this._actorsById.get(id) || null;
	};

	Game.prototype.resolveId = Game.prototype.actorWithId;

	/**
	 * Returns the player that has the specified public player ID.
	 * @param {number} publicId
	 * @returns {Player} Player object or null
	 */
	Game.prototype.playerWithPublicId = function (publicId) {
		var player = this.players[publicId];
		return (player && typeof player === 'object' ? player : null);
	};

	/**
	 * Returns the unit type with the specified name or null if it hasn't been
	 * added.
	 * @param {string} unitTypeName
	 * @returns {object} unit type object or null
	 */
	Game.prototype.getUnitType = function (unitTypeName) {
		return this.unitTypes.get(unitTypeName) || null;
	};

	// The main game loop. This should be called repeatedly from a timer.
	Game.prototype.gameLoop = function () {
		// FIXME: Handle client lagging behind the server. Temporarily reduce
		// tick duration to catch up discreetly.
		// FIXME: Soft adjustment for situations where the client has a tendency to
		// speed past the server.
		//
		// Acknowledgement handling. Send general acknowledgement after
		// processing a new tick. Send asset loading acknowledgement one second
		// after a new asset has been loaded.
		if (!this.isLocal) {
			if (this.acknowledgeAt > 0 && this.acknowledgeAt <= (new Date()).getTime()) {
				this.acknowledgeAt = 0;
				this.notifyServer('ack', this.lastProcessedTick);
			}
			if (this.notifyAssetReadyAt > 0 && this.notifyAssetReadyAt <= (new Date()).getTime()) {
				this.notifyAssetReadyAt = 0;
				this.notifyServer('assetReady', this.scenario.assetsLoaded, this.scenario.assetsQueued, this.scenario.everythingLoaded);
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

	Game.prototype.handleCommand = function (player, cmd) {
		// The command is a JavaScript array, where cmd[0] is a string indicating
		// the type of the command. Commands may need to be validated because the server
		// echoes command from the clients without parsing them.
		util.assert(false, 'Game.handleCommand: unknown command "' + cmd + '"');
	};

	Game.prototype.handleMessage = function (msg) {
		// The message is a JavaScript array where msg[0] indicates the type of
		// the message and the rest of the items are message-specific
		// parameters. Not much validation is necessary for messages, because
		// they are issued by the server.
		util.assert(typeof msg[0] == 'string', 'Game.handleMessage: message type is not a string');
		switch (msg[0]) {
			case 'C':
				// Command
				// [1] is the public ID of the player the command is from
				// [2] is the properties of the command
				var player = this.playerWithPublicId(msg[1]);
				util.assert(player, 'Game.handleMessage: player not found for C');
				this.commandQueues[0].push([player, msg[2]]);
				break;
			case 'tick':
				// Tick permitted
				// [1] is the number of the tick we are now permitted to process
				// FIXME: Should we handle here returning to a paused game
				var tick = msg[1];
				util.assert(typeof tick == 'number', 'Game.handleMessage: tick must be a number');
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
			case 'scenario':
				// Received scenario information from server
				// [1] is the public ID of the current player
				// [2] is the scenario specification object
				// FIXME: Change one or another so that these will have the same order
				this.loadScenario(msg[2], msg[1]);
				break;
			case 'hello':
				// Server hello
				// Send the last tick processed in response
				this.notifyServer('ack', this.lastProcessedTick);
				break;
			case 'error':
				// Error
				// [1] is the error object
				// [1]['msg'] is a textual description of the error
				if (typeof console != 'undefined') {
					console.log('Server error: ' + msg[1]['msg']);
				}
				break;
			default:
				util.assert(false, 'Game.handleMessage: unrecognized message type "' + msg[0] + '"');
				break;
		}
	};

	Game.prototype.issueCommand = function (cmd) {
		if (this.isLocal) {
			this.handleCommand(this.localPlayer, cmd);
		} else {
			this.channel.deliver(cmd);
		}
	};

	// Guaranteed delivery of a message to the server
	Game.prototype.deliverServer = function (/* ...arguments */) {
		this.channel.deliver.apply(this.channel, arguments);
	};

	// Non-guaranteed delivery of a message to the server
	Game.prototype.notifyServer = function (/* ...arguments */) {
		util.assert(!this.isLocal, 'Game.notifyServer: cannot send because the game is local');
		this.channel.notify.apply(this.channel, arguments);
	};

	// Send acknowledgement to server after at most 100 milliseconds
	Game.prototype.queueAcknowledgement = function () {
		if (this.acknowledgeAt <= 0) {
			this.acknowledgeAt = (new Date()).getTime() + 100;
		}
	};

	return Game;

});