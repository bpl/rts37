// Firing Solution     //
// Generic server core //

var sys = require('sys'),
	fs = require('fs'),
	path = require('path'),
	url = require('url'),
	http = require('http'),
	ws = require('./lib/ws'),
	util = require('./serverutil');

var options = {
	// The TCP port this server will listen to
	listenPort: 8000,
	// The document root for HTTP requests
	documentRoot: '../',
	// File extension to MIME type associations
	mimeTypes: {
		'html': 'text/html; charset=utf-8',
		'css': 'text/css',
		'js': 'text/javascript'
	}
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

function Game(id) {
	this.id = id;
	this.players = {};
	this.currentTick = 0;
	this.initialStateQueue = [];
}

Game.prototype.getOrCreatePlayer = function (id) {
	if (this.players.hasOwnProperty(id)) {
		return this.players[id];
	}
	var player = new Player(this, id);
	this.players[id] = player;
	return player;
};

// Guaranteed delivery of message to all players
Game.prototype.deliverAll = function (msg) {
	for (var id in this.players) {
		this.players[id].deliver(msg);
	}
};

// Guaranteed delivery of message to all players, including players who have not
// joined yet.
Game.prototype.deliverInitialState = function (msg) {
	this.initialStateQueue.push(msg);
	this.deliverAll(msg);
};

/////////////
// Player //
///////////

function Player(game, id) {
	this.game = game;
	this.id = id;
	this.connection = null;
	this.currentDeliveryTag = 0;
	this.deliveryQueue = [];
}

Player.prototype.setConnection = function (connection) {
	this.connection = connection;
};

// Guaranteed delivery of message to this player. Each message gets a delivery tag,
// a monotonically incrementing integer. The client will periodically echo the most
// recent tag received back to the server, so that the server knows which messages
// are safe to discard from the queue.
Player.prototype.deliver = function (msg) {
	var deliveryTag = this.currentDeliveryTag++;
	this.deliveryQueue.push([deliveryTag, msg]);
	// FIXME: Better check for the vitality of the connection
	if (this.connection) {
		this.connection.write(deliveryTag + ',' + msg);
	}
};

// Let the player know that there is a problem
Player.prototype.deliverError = function (text) {
	this.deliver('A,' + JSON.stringify({'$': 'SE', 'msg': text}));
};

// Handle a message received from the player
Player.prototype.handleMessage = function (msg) {
	if (msg.length <= 0) {
		this.deliverError('Empty message');
		return;
	}
	switch (msg[0]) {
		case 'A':
			// Player to server communication
			// The server should parse the rest of the message as JSON and act
			// upon it.
			var payload = JSON.parse(msg.substr(1));
			switch (payload['$'] || null) {
				case 'bail':
					// FIXME: Gracefully exit the game
					break;
				case 'stateReady':
					// FIXME: Game state has been received successfully
					break;
				case 'tickReady':
					// FIXME: Tick has been processed successfully
					break;
				case 'ack':
					// Message delivery acknowledgement. Parameters:
					// tag: Delivery tag of the last message received
					if (typeof payload['tag'] != 'number') {
						this.deliverError('Invalid acknowledgement tag ' + (payload['tag'] || '!MISSING'));
						break;
					}
					while (this.deliveryQueue.length > 0 && this.deliveryQueue[0][0] <= payload['tag']) {
						this.deliveryQueue.shift();
					}
					break;
				default:
					this.deliverError('Unknown message type ' + (payload['$'] || '!MISSING'));
					break;
			}
			break;
		case 'B':
			// Player to player broadcast
			// The server should forward the rest of the message to all players
			this.game.deliverAll('B,' + this.id + ',' + msg);
			break;
		default:
			// Unknown message format
			this.deliverError('Unknown message format ' + msg[0]);
			break;
	}
};

// The WebSocket server code

var server = ws.createServer(),
	games = {};

server.addListener('error', function (exception) {
	sys.log('Server error ' + sys.inspect(exception));
});

// This gets called for example when the request listener throws an exception.
// It is shared by WebSocket and HTTP listeners.
server.addListener('clientError', function (exception) {
	sys.log('Server client error ' + exception.stack);
});

server.addListener('listening', function () {
	sys.log('Listening for connections');
});

// WebSocket request handling
server.addListener('connection', function (conn) {
	sys.log('<' + conn._id + '> connected');
	// FIXME: Access to a private member, not good but currently required to gain
	// access to the query string.
	var requestUrl = url.parse(conn._req.url, true),
		gameId = (requestUrl.query || [])['game'] || '',
		playerId = (requestUrl.query || [])['player'] || '',
		requestUrl = null;
		
	// FIXME: Fire a request to validate gameId and playerId. For now we'll just
	// create them if they don't exist.
	var game = games.hasOwnProperty(gameId) ? games[gameId] : new Game(gameId),
		player = game.getOrCreatePlayer(playerId);
		
	player.setConnection(conn);
		
	sys.log('<' + conn._id + '> logged in to game ' + game.id + ' as player ' + player.id);
	
	conn.addListener('close', function () {
		sys.log('<' + conn._id + '> disconnected');
		if (player.connection == conn) {
			player.setConnection(null);
		}
	});
	
	conn.addListener('message', function (msg) {
		sys.log('<' + conn._id + '> says ' + msg);
		player.handleMessage(msg);
	});
});

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
server.addListener('request', function (request, response) {

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
	sys.log('[HTTP] Request ' + requestPath);
	// FIXME: Requests to hidden files should give an error
	var requestFile = path.join(options.documentRoot, util.cleanPath(requestPath));
	
	fs.stat(requestFile, function (err, stats) {
		if (err) {
			sys.log('[HTTP] Stat failure ' + err + ' for ' + requestPath);
			sendErrorWithErr(response, err);
			return;
		}
		sys.log('[HTTP] Stat success for ' + requestPath);
		if (!stats.isFile()) {
			sendError(response, 403, 'The requested URL ' + requestPath + ' is not a file.');
			return;
		}
		var stream = fs.createReadStream(requestFile),
			headerWritten = false;
		stream.addListener('data', function (data) {
			sys.log('[HTTP] Sending ' + data.length + ' bytes for ' + requestPath);
			if (!headerWritten) {
				var extname = util.removePrefix('.', path.extname(path.basename(requestFile)));
				response.writeHead(200, {
					'Content-Type': (options.mimeTypes.hasOwnProperty(extname) ? options.mimeTypes[extname] : 'text/plain'),
					'Content-Length': stats.size
				});
				headerWritten = true;
			}
			response.write(data);
		});
		stream.addListener('end', function (data) {
			sys.log('[HTTP] End for ' + requestPath);
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
});

server.listen(options.listenPort);