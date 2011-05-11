// Firing Solution     //
// Generic server core //

var sys = require('sys'),
	fs = require('fs'),
	path = require('path'),
	url = require('url'),
	http = require('http'),
	ws = require('./lib/ws'),
	util = require('./serverutil'),
	eutil = require('../engine/util'),
	assert = eutil.assert;

//////////////
// Manager //
////////////

// Keeps track of active games on this server and when they need to be woken up
// to do whatever periodical processing they need to do.
function Manager() {
	// Games by game ID
	this.games = {};
	// Games sorted from the first to wake up to the last to wake up as a
	// delayed shift priority queue.
	this.wakeQueue = [];
	// The number of empty items at the start of the queue
	this.emptySpace = 0;
}

// Returns the active game with the specified id, or null, if no such game
// exists on this server.
Manager.prototype.gameWithId = function (id) {
	if (this.games.hasOwnProperty(id)) {
		return this.games[id] || null;
	}
	return null;
};

// Adds a game to the list of active games and enqueues it to wake up when it
// wants.
Manager.prototype.add = function (game) {
	assert(!this.games.hasOwnProperty(game.id), 'Manager.add: duplicate game ID');
	this.games[game.id] = game;
	this.enqueue(game);
};

// Enqueues a game to the wake queue, a priority queue of games sorted by the
// time they want to wake up the next time, starting from the earliest.
Manager.prototype.enqueue = function (game) {
	if (game.wakeAt > 0) {
		for (var i = this.wakeQueue.length - 1; i >= this.emptySpace; --i) {
			if (this.wakeQueue[i].wakeAt <= game.wakeAt) {
				this.wakeQueue.splice(i + 1, 0, game);
				return;
			}
		}
		// The game will be inserted at the beginning of the queue, so fall through
	}
	if (this.emptySpace > 0) {
		this.wakeQueue[--this.emptySpace] = game;
	} else {
		this.wakeQueue.unshift(game);
	}
};

// If there are one or more games that want to wake up at or after the current
// time (passed in as the 'now' parameter), returns the first such game.
// Otherwise, returns null.
Manager.prototype.tryDequeue = function (now) {
	if (this.emptySpace >= this.wakeQueue.length ||
			this.wakeQueue[this.emptySpace].wakeAt > now) {
		return null;
	}
	if (this.emptySpace * 2 < this.wakeQueue.length) {
		return this.wakeQueue[this.emptySpace++];
	}
	var result = this.wakeQueue[this.emptySpace];
	this.wakeQueue = this.wakeQueue.slice(this.emptySpace + 1);
	this.emptySpace = 0;
	return result;
};

// Current plan for tick (turn) handling
//
// If we had a perfectly reliable network, the server would:
// 1. Start with currentTick at 0
// 2. Receive client commands and broadcast server commands
// 3. When an interval fires, send TICK_ADVANCE(currentTick) message to all players
// 4. Increment the value of currentTick
// 5. Repeat from step 2
//
// And the client would:
// 1. Start with currentTick at 0
// 2. Handle user interface events and send client commands
// 3. Receive server commands and process them
// 4. When TICK_ADVANCE(currentTick) message is received, perform the tick actions
// 5. Increment the value of currentTick
// 6. Repeat from step 2
//
// This is just straight lock-step evaluation, so it will appear very jumpy when
// played on the Internet. However, it is probably best to start simple.

///////////
// Game //
/////////

function Game(opt /* id, ticksPerSecond, acceptedLagMsecs, playerIds */) {
	//
	// Properties with static default values
	//
	this.currentTick = 0;
	this.running = false;
	this.wakeAt = 0;
	// The number of assets that the players have been asked to load
	this.assetsSent = 0;
	// Do we know everything that comprises the initial game state (essentially
	// object creation and asset loading messages)
	this.initialStateKnown = false;
	//
	// Properties that depend on game options
	//
	assert(typeof opt.id == 'string', 'Game: id is not a string');
	assert(opt.playerIds instanceof Array, 'Game: playerIds is not an array');
	assert(opt.playerIds.length > 0, 'Game: playerIds is empty');
	assert(opt.ticksPerSecond > 0, 'Game: ticksPerSecond is not a positive number');
	this.id = opt.id;
	this.ticksPerSecond = opt.ticksPerSecond;
	this.msecsPerTick = 1000 / this.ticksPerSecond;
	this.acceptedLagMsecs = opt.acceptedLagMsecs;
	this.players = {};
	for (var i = 0; i < opt.playerIds.length; ++i) {
		var player = new Player({
			'game': this,
			'id': opt.playerIds[i],
			'actorId': i + 1
		});
		this.players[player.id] = player;
	}
}

Game.prototype.getPlayer = function (id) {
	if (this.players.hasOwnProperty(id)) {
		return this.players[id];
	}
	return null;
};

// Guaranteed delivery of a message to all players. This version of this
// function accepts a single parameter, containing the message as a
// JSON-formatted string.
Game.prototype.deliverAllRaw = function (msg) {
	for (var id in this.players) {
		this.players[id].deliverRaw(msg);
	}
};

// Guaranteed delivery of a message to all players. This version of this
// function accepts the parts of the message as arguments.
Game.prototype.deliverAll = function () {
	var parts = [];
	for (var i = 0; i < arguments.length; ++i) {
		parts.push(JSON.stringify(arguments[i]));
	}
	this.deliverAllRaw(parts.join(','));
};

// Guaranteed delivery of a set of messages to all players, including players
// who have not joined yet. Messages with the type of 'loadAsset' are
// special-cased, incrementing the assets sent counter.
Game.prototype.deliverInitialState = function (msgs) {
	for (var i = 0; i < msgs.length; ++i) {
		var msg = msgs[i];
		if (msg[0] == 'loadAsset') {
			this.assetsSent++;
		}
		for (var id in this.players) {
			var player = this.players[id];
			player.deliver.apply(player, msg);
		}
	}
};

// Lets every player know what the actor id of their Player object is. This must
// be called exactly once, after all the player objects have been queued for
// delivery to the players.
Game.prototype.deliverWhoIsWho = function () {
	for (var id in this.players) {
		this.players[id].deliver('youAre', this.players[id].actorId);
	}
};

// Indicates that all initial game state has been queued for sending
Game.prototype.endInitialState = function () {
	assert(!this.initialStateKnown, 'Game.endInitialState: initial state is already marked as known');
	this.initialStateKnown = true;
	for (var id in this.players) {
		this.players[id].endInitialState();
	}
};

// Called by the server when the current server clock exceeds time specified in
// wakeAt property.
Game.prototype.wake = function (now) {
	// TODO: Is it necessary to try to prevent bunching here to keep the server
	// load stable?
	//
	// If we overslept i.e. the server temporarily froze for some reason,
	// do not try to catch up, and just process the next tick one tick length
	// from now. If we are on time, wake up the next time one tick length from
	// the exact moment we were supposed to wake up this time to keep the pace
	// as constant as possible.
	if (now - this.wakeAt > this.msecsPerTick * 1.5) {
		this.wakeAt = now + this.msecsPerTick;
	} else {
		this.wakeAt += this.msecsPerTick;
	}
	if (this.running) {
		// Check that no player is lagging
		// FIXME: Only restart when the lagging player has catched up fully
		// FIXME: Let other players know about the lag
		for (var id in this.players) {
			if (this.players[id].lastProcessedTick < this.currentTick - this.acceptedLagMsecs / this.msecsPerTick) {
				return;
			}
		}
		// Nobody is lagging, so we are cleared to advance
		this.deliverAll('tick', this.currentTick++);
		return;
	}
	// Start the game when all players have received the initial state
	if (this.initialStateKnown) {
		for (var id in this.players) {
			if (!this.players[id].initialStateComplete()) {
				return;
			}
		}
	}
	// FIXME: Do this also if one of the players has failed to appear
	this.running = true;
};

/////////////
// Player //
///////////

function Player(opt /* game, id, actorId */) {
	this.game = opt.game;
	this.id = opt.id;
	this.actorId = opt.actorId;
	this.connection = null;
	this.lastDeliveryTag = 0;
	this.initialStateLastTag = -1;
	this.assetsLoaded = 0;
	this.lastProcessedTick = 0;
	this.deliveryQueue = [];
	this.connectionState = Player.CONNECTION_STATE.INITIAL;
}

Player.CONNECTION_STATE = {
	// Initial state, connection has not yet been established
	INITIAL: 0,
	// Connection established, server hello sent
	HELLO_SENT: 1,
	// The client has replied with the initial acknowledgement
	CONNECTED: 2
};

Player.prototype.setConnection = function (connection) {
	this.connection = connection;
};

// Indicates that all initial game state has been queued for sending
Player.prototype.endInitialState = function () {
	this.initialStateLastTag = this.lastDeliveryTag;
};

// Returns true if the initial state been sent and acknowledged, and have all
// the assets requested by the server have been loaded.
Player.prototype.initialStateComplete = function () {
	return this.initialStateLastTag >= 0 &&
			(this.deliveryQueue.length <= 0 || this.deliveryQueue[0][0] > this.initialStateLastTag) &&
			(this.game.assetsSent <= this.assetsLoaded);
};

// Non-guaranteed delivery of a message to the player. The first argument is the
// connection the notification is to be sent to. The rest of the arguments
// make up the parts of the message. Implemented as a class function because we
// want to be able to send notifications connections with whom we have not
// associated a Player object.
Player.notify = function (connection) {
	// FIXME: Better check for the vitality of the connection (if possible)
	if (connection) {
		// 0 = delivery tag indicating a notification
		var parts = [0];
		for (var i = 1; i < arguments.length; ++i) {
			parts.push(JSON.stringify(arguments[i]));
		}
		connection.write(parts.join(','));
	}
};

// Guaranteed delivery of a message to this player, with the message given as a
// single string containing JSON notation fragment. Each message gets a delivery
// tag, a monotonically incrementing integer. The client will periodically echo
// the most recent tag received back to the server, so that the server knows
// which messages are safe to discard from the queue.
Player.prototype.deliverRaw = function (msg) {
	var deliveryTag = ++this.lastDeliveryTag;
	this.deliveryQueue.push([deliveryTag, msg]);
	// FIXME: Better check for the vitality of the connection (if possible)
	if (this.connection) {
		this.connection.write(deliveryTag + ',' + msg);
	}
};

// Guaranteed delivery of a message to this player, with the parts of the
// message given as parameters. The parameters will be converted into JSON
// format. See Game.deliverAll for more information.
Player.prototype.deliver = function () {
	var parts = [];
	for (var i = 0; i < arguments.length; ++i) {
		parts.push(JSON.stringify(arguments[i]));
	}
	this.deliverRaw(parts.join(','));
};

// Let the player know that there is a problem
Player.notifyError = function (connection, text) {
	this.notify(connection, 'error', {'msg': text});
};

// Let the player know that there is a problem
Player.prototype.notifyError = function (text) {
	Player.notifyError(this.connection, text);
};

// Let the player know that there is a problem (with guaranteed delivery)
Player.prototype.deliverError = function (text) {
	this.deliver('error', {'msg': text});
};

// Send the server hello to the player
Player.prototype.serverHello = function () {
	this.connectionState = Player.CONNECTION_STATE.HELLO_SENT;
	Player.notify(this.connection, 'hello');
};

// Handle a message received from the player
Player.prototype.handleMessage = function (msg) {
	if (msg.length <= 0) {
		this.deliverError('Empty message');
		return;
	}
	switch (this.connectionState) {
		case Player.CONNECTION_STATE.CONNECTED:
			// Fall through to the next switch statement
			break;
		case Player.CONNECTION_STATE.INITIAL:
			this.notifyError('The client must wait for server hello');
			// FIXME: Disconnect
			return;
		case Player.CONNECTION_STATE.HELLO_SENT:
			// We should get an acknowledgement from the client
			if (msg[0] != '1') {
				this.notifyError('The client must start with acknowledgement, but started instead with message of category "' + msg[0] + '"');
				return;
			}
			var payload = JSON.parse('{"d":[' + msg + ']}')['d'];
			if (!payload || payload[1] != 'ack') {
				this.notifyError('The client must start with acknowledgement, but started instead with message of type "' + msg[1] + '"');
				return;
			}
			if (typeof payload[2] != 'number') {
				this.notifyError('Invalid acknowledgement tag ' + (payload[2] || '!MISSING'));
				return;
			}
			this.connectionState = Player.CONNECTION_STATE.CONNECTED;
			// Remove the messages that have been sent correctly
			while (this.deliveryQueue.length > 0 && this.deliveryQueue[0][0] <= payload[2]) {
				this.deliveryQueue.shift();
			}
			// Recap messages that were not sent correctly and/or initial game state
			// when connecting for the first time.
			// FIXME: Do not overstuff the socket
			for (var i = 0; i < this.deliveryQueue.length; ++i) {
				var recap = this.deliveryQueue[i];
				this.connection.write(recap[0] + ',' + recap[1]);
			}
			return;
		default:
			this.notifyError('Internal Server Error: Unknown connection state');
			return;
	}
	switch (msg[0]) {
		case '1':
			// Player to server communication
			// The server should parse the rest of the message as JSON and act
			// upon it.
			var payload = JSON.parse('{"d":[' + msg + ']}')['d'];
			switch (payload[1] || null) {
				case 'bail':
					// FIXME: Gracefully exit the game
					break;
				case 'ack':
					// Message delivery and tick processing acknowledgement.
					// Parameters:
					// [2]: Delivery tag of the last message received
					// [3]: Tick number of the last tick processed
					if (typeof payload[2] != 'number') {
						this.notifyError('Invalid acknowledgement tag ' + (payload[2] || '!MISSING'));
						break;
					}
					if (typeof payload[3] != 'number') {
						this.notifyError('Invalid tick number ' + (payload[3] || '!MISSING'));
						break;
					}
					while (this.deliveryQueue.length > 0 && this.deliveryQueue[0][0] <= payload[2]) {
						this.deliveryQueue.shift();
					}
					if (this.lastProcessedTick < payload[3]) {
						this.lastProcessedTick = payload[3];
					}
					break;
				case 'assetReady':
					// Acknowledgement that some assets have finished loading.
					// Parameters:
					// [2]: The number of assets that have finished loading
					// [3]: Total number of assets the client knows it needs
					if (typeof payload[2] != 'number') {
						this.notifyError('Invalid number of loaded assets ' + (payload[2] || '!MISSING'));
						break;
					}
					if (typeof payload[3] != 'number') {
						this.notifyError('Invalid number of known assets ' + (payload[3] || '!MISSING'));
						break;
					}
					if (this.assetsLoaded < payload[2]) {
						this.assetsLoaded = payload[2];
					} else if (this.assetsLoaded > payload[2]) {
						this.notifyError('The client is notifying about assets it has already notified about, ' + payload[2] + ' vs. ' + this.assetsLoaded);
					}
					if (this.game.assetsSend > payload[3]) {
						this.notifyError('The client knows too many assets ' + payload[3] + ' vs. ' + this.game.assetsSent);
					}
					break;
				default:
					this.notifyError('Unknown message type ' + (payload[1] || '!MISSING'));
					break;
			}
			break;
		case '2':
			// Player to player broadcast
			// The server should forward the rest of the message to all players
			// FIXME: Proper escaping for id
			this.game.deliverAllRaw('"C",' + this.actorId + ',' + msg.substr(1));
			break;
		default:
			// Unknown message format
			this.notifyError('Unknown message format ' + msg[0]);
			break;
	}
};

/////////////
// Server //
///////////

function Server(opt) {
	// Please see runserver.js for a list of options
	this.options = opt;
	// The WebSocket server we will be using
	this.server = ws.createServer();
	// Holds a list of games
	this.manager = new Manager();

	var self = this;

	this.server.addListener('error', function (exception) {
		self.handleError(exception);
	});

	this.server.addListener('clientError', function (exception) {
		self.handleClientError(exception);
	});

	this.server.addListener('listening', function () {
		self.handleListening();
	});

	this.server.addListener('connection', function (conn) {
		self.handleConnection(conn);
	});

	this.server.addListener('request', function (request, response) {
		self.handleRequest(request, response);
	});
}

Server.prototype.listen = function () {
	this.server.listen(this.options.listenPort);
	// Send the notifications for ticks having ended etc.
	var self = this;
	setInterval(function () {
		var now = (new Date()).getTime();
		var game;
		while (game = self.manager.tryDequeue(now)) {
			// FIXME: What if there is an exception?
			game.wake(now);
			self.manager.enqueue(game);
		}
	}, 10);
};

Server.prototype.handleError = function (exception) {
	sys.log('Server error ' + sys.inspect(exception));
};

// This gets called for example when the request listener throws an exception.
// It is shared by WebSocket and HTTP listeners.
Server.prototype.handleClientError = function (exception) {
	sys.log('Client error ' + (exception.stack || exception));
};

Server.prototype.handleListening = function () {
	sys.log('Listening for connections on port ' + this.options.listenPort);
};

// WebSocket request handling
Server.prototype.handleConnection = function (conn) {
	sys.log('<' + conn.id + '> connected');
	// FIXME: Access to a private member, not good but currently required to gain
	// access to the query string.
	var requestUrl = url.parse(conn._req.url, true),
		gameId = (requestUrl.query || {})['game'] || '',
		playerId = (requestUrl.query || {})['player'] || '',
		state = (requestUrl.query || {})['state'] || '',
		requestUrl = null;

	// FIXME: Fire a request to validate gameId and playerId. For now we'll just
	// create them if they don't exist.
	var game = this.manager.gameWithId(gameId);
	if (!game) {
		// FIXME: The game state should be valided somehow and it probably
		// should be loaded from somewhere. For now we'll just use the game
		// state sent by the client.
		if (!state) {
			Player.notifyError(conn, 'No initial game state specified');
			conn.close();
			return;
		}
		try {
			state = eutil.stateSpecToArray(state);
		} catch (e) {
			Player.notifyError(conn, 'Error was encountered while parsing the initial game state: ' + sys.inspect(e));
			conn.close();
			return;
		}
		// FIXME: Hard-coded game options
		game = new Game({
			'id': gameId,
			'ticksPerSecond': 5,
			'acceptedLagMsecs': this.options.acceptedLagMsecs,
			'playerIds': ['p1']
		});
		this.manager.add(game);
		game.deliverInitialState(state);
		game.deliverWhoIsWho();
		game.endInitialState();
	}

	var player = game.getPlayer(playerId);
	if (!player) {
		// The doesn't appear to exist a player with this player id, so we just send
		// an error message and sever the connection.
		Player.notifyError(conn, 'Unknown player id "' + playerId + '"');
		conn.close();
		return;
	}

	player.setConnection(conn);
	player.serverHello();

	sys.log('<' + conn.id + '> logged in to game ' + game.id + ' as player ' + player.id);

	conn.addListener('close', function () {
		sys.log('<' + conn.id + '> disconnected');
		if (player.connection == conn) {
			player.setConnection(null);
		}
	});

	conn.addListener('message', function (msg) {
		player.handleMessage(msg);
	});
};

// HTTP request handling
//
// The Node.js HTTP server contains some built-in logic pertaining to the following
// headers: Connection, Content-Length and Transfer-Encoding. Specifically:
//
// - The server will automatically detect if the client wants keep-alive and will
//   automatically send either Connection: keep-alive or Connection: close depending
//   on whether the client wanted keep-alive. You can override this decision by
//   writing the appropriate header yourself. If you send Connection: close header,
//   the connection will be closed when you call response.end().
//
// - If you do not manually send either Content-Length header or Transfer-Encoding
//   header, the server will automatically send Transfer-Encoding: chunked header
//   and add the chunk headers for you with each call to response.write() if the
//   HTTP version indicated in the request is HTTP/1.1. You can force the automatic
//   sending of chunk header by adding Transfer-Encoding: chunked header yourself.
//
// This logic can be found in function OutgoingMessage.prototype.sendHeaderLines
// in file /lib/http.js. Anyway, what this means in practice is that you will write
// response body by simply calling response.write(data) for each chunk of data and
// finish with response.end() regardless of whether you choose to let the browser
// know how much data you will be sending by setting the Content-Length header in
// your response.writeHead call. You do not need to (and should not) worry about
// Connection and Transfer-Encoding headers yourself.
//
// - If you know the length of the response body in advance, add the proper
//   Content-Length header in the response.
Server.prototype.handleRequest = function (request, response) {

	// FIXME: Escaping for the explanation
	function sendError(response, statusCode, explanation) {
		var body = '<!DOCTYPE HTML><html><head><title>' +
				statusCode + ' ' + http.STATUS_CODES[statusCode] +
				'</title></head><body><h1>' +
				statusCode + ' ' + http.STATUS_CODES[statusCode] +
				'</h1>' +
				(explanation ? '<p>' + explanation + '</p>' : '') +
				'</body></html>';
		response.writeHead(404, {
			'Content-Length': body.length,
			'Content-Type': 'text/html; charset=utf-8'
		});
		response.write(body, 'utf8');
		response.end();
	}

	function sendErrorWithErr(response, err) {
		switch (err.errno) {
			case process.EACCES:
				sendError(response, 403, 'The requested URL ' + requestPath + ' is not accessible to this server.');
				break;
			case process.ENOENT:
				sendError(response, 404, 'The requested URL ' + requestPath + ' was not found on this server.');
				break;
			default:
				sendError(response, 500, 'An unspecified error occurred while attempting to access the requested URL ' + requestPath + ' on this server.');
				break;
		}
	}

	var requestPath = url.parse(request.url).pathname;
	// FIXME: Requests to hidden files should give an error
	var requestFile = path.join(this.options.documentRoot, util.cleanPath(requestPath));
	var self = this;

	fs.stat(requestFile, function (err, stats) {
		if (err) {
			sys.log('[HTTP] Stat failure ' + err + ' for ' + requestPath);
			sendErrorWithErr(response, err);
			return;
		}
		if (!stats.isFile()) {
			sendError(response, 403, 'The requested URL ' + requestPath + ' is not a file.');
			return;
		}
		var stream = fs.createReadStream(requestFile),
			headerWritten = false;
		stream.addListener('data', function (data) {
			if (!headerWritten) {
				var extname = util.removePrefix('.', path.extname(path.basename(requestFile)));
				response.writeHead(200, {
					'Content-Type': (self.options.mimeTypes.hasOwnProperty(extname) ? self.options.mimeTypes[extname] : 'text/plain'),
					'Content-Length': stats.size
				});
				headerWritten = true;
			}
			response.write(data);
		});
		stream.addListener('end', function (data) {
			sys.log('[HTTP] Served ' + requestPath);
			response.end();
		});
		stream.addListener('error', function (exception) {
			sys.log('[HTTP] Error ' + exception + ' for ' + requestPath);
			if (headerWritten) {
				// FIXME: If keep-alive is on, close the connection
				response.end();
			} else {
				sendErrorWithErr(response, exception);
			}
		});
	});
};

// To maintain consistency with other Node.js modules
function createServer(opt) {
	return new Server(opt);
}

// Exports
exports.Manager = Manager;
exports.Game = Game;
exports.Player = Player;
exports.Server = Server;
exports.createServer = createServer;