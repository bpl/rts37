// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

// Generic lock-step execution multiplayer server core

var sys = require('sys');
var fs = require('fs');
var path = require('path');
var url = require('url');
var http = require('http');
var ws = require('../dep/node-websocket-server/ws');
var util = require('./serverutil');
var assert = require('../engine/util').assert;
var Manager = require('./Manager');
var Game = require('./Game');
var Player = require('./Player');

// FIXME: Currently the server exits if a connection is interrupted while
// connecting. Do something about this. An 'error' event no getting handled
// somewhere?

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
	var query = url.parse(conn._req.url, true).query || {};
	var gameId = query['game'] || '';
	var playerId = query['player'] || '';
	var gameSpecString = query['spec'] || '';

	if (!gameId) {
		Player.notifyError(conn, 'Game ID was not specified');
		conn.close();
		return;
	}
	if (!playerId) {
		Player.notifyError(conn, 'Player ID was not specified');
		conn.close();
		return;
	}

	// FIXME: Fire a request to validate gameId and playerId. For now we'll just
	// create them if they don't exist.
	var game = this.manager.gameWithId(gameId);
	if (!game) {
		// FIXME: The game state should be valided somehow and it probably
		// should be loaded from somewhere. For now we'll just use the game
		// state sent by the client.
		if (!gameSpecString) {
			Player.notifyError(conn, 'No game specification specified');
			conn.close();
			return;
		}
		try {
			var gameSpec = JSON.parse(gameSpecString);
		} catch (e) {
			Player.notifyError(conn, 'Error was encountered while parsing the game specification: ' + sys.inspect(e));
			conn.close();
			return;
		}
		// FIXME: Hard-coded game options
		game = new Game({
			'id': gameId,
			'ticksPerSecond': 5,
			'acceptedLagMsecs': this.options.acceptedLagMsecs,
			'gameSpec': gameSpec,
			'playerIds': ['p1', 'p2']
		});
		this.manager.add(game);
		game.deliverScenario();
	}

	var player = game.playerWithSecretId(playerId);
	if (!player) {
		// The doesn't appear to exist a player with this player id, so we just send
		// an error message and sever the connection.
		Player.notifyError(conn, 'Unknown player secret ID "' + playerId + '"');
		conn.close();
		return;
	}

	// Extend connection with onopen and onmessage properties to make it more
	// similar to WebSocket. Connection already has a send method.
	assert(!conn.onopen && !conn.onmessage, 'Server.handleConnection: Connection now has onopen and onmessage properties');
	conn.onopen = null;
	conn.onmessage = null;

	player.setConnection(conn);
	conn.onopen();

	sys.log('<' + conn.id + '> logged in to game ' + game.id + ' as player ' + player.secretId);

	conn.addListener('message', conn.onmessage.bind(conn));

	conn.addListener('close', function () {
		sys.log('<' + conn.id + '> disconnected');
		if (player.connection === conn) {
			player.setConnection(null);
		}
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

module.exports = Server;