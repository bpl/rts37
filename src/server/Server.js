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

// Generic lock-step execution multiplayer server core

var sys = require('util');
var fs = require('fs');
var path = require('path');
var url = require('url');
var http = require('http');

var WebSocketServer = require('../dep/WebSocket-Node').server;

var util = require('./serverutil');
var assert = require('../engine/util').assert;
var hop = require('../engine/util').hop;

var ServerManager = require('./ServerManager');
var ServerGame = require('./ServerGame');

// FIXME: Currently the server exits if a connection is interrupted while
// connecting. Do something about this. An 'error' event not getting handled
// in the connection?

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
	// Holds a list of games
	this.manager = new ServerManager();

	// HTTP server configuration

	this.httpServer = http.createServer();

	this.httpServer
		.on('listening', this.handleListening.bind(this))
		.on('request', this.handleRequest.bind(this))
		.on('error', this.handleError.bind(this))
		.on('clientError', this.handleClientError.bind(this));

	// WebSocket server configuration

	this.server = new WebSocketServer({
		httpServer: this.httpServer,
		keepalive: false,   // We'll implement our own at application level
		// Default, show here just for documentation
		disableNagleAlgorithm: true,
		autoAcceptConnections: false
	});

	this.server.on('request', this.handleWebSocketRequest.bind(this));
}

Server.prototype.listen = function () {
	this.httpServer.listen(this.options.listenPort);
	// Send the notifications for ticks having ended etc.
	setInterval(function () {
		var now = (new Date()).getTime();
		var game;
		while (game = this.manager.tryDequeue(now)) {
			// FIXME: What if there is an exception?
			game.wake(now);
			this.manager.enqueue(game);
		}
	}.bind(this), 10);
};

Server.prototype.handleError = function (exception) {
	sys.log('Server error ' + sys.inspect(exception));
};

// This gets called if a client connection emits an 'error' event
Server.prototype.handleClientError = function (exception) {
	sys.log('Client error ' + (exception.stack || exception));
};

Server.prototype.handleListening = function () {
	sys.log('Listening for connections on port ' + this.options.listenPort);
};

// WebSocket request handling. WebSocket-Node contains no way to get a reference
// to the initial HTTP request from connection, so the connection needs to be
// validated here.
Server.prototype.handleWebSocketRequest = function (req) {
	var clientId = req.remoteAddress;

	sys.log('<' + clientId + '> request');
	var query = url.parse(req.httpRequest.url, true).query || {};
	var gameId = query['game'] || '';
	var playerId = query['player'] || '';
	var gameSpecString = query['spec'] || '';

	// FIXME: Check origin (important to stop people from misusing resources)
	// FIXME: Better rejection status codes
	// FIXME: Remove static notifyError (and other statics?) from ServerPlayer and
	// Channel because we shouldn't need them any longer.

	if (!gameId) {
		req.reject(500, 'Game ID was not specified');
		return;
	}
	if (!playerId) {
		req.reject(500, 'Player ID was not specified');
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
			req.reject(500, 'No game specification specified');
			return;
		}
		try {
			var gameSpec = JSON.parse(gameSpecString);
		} catch (e) {
			req.reject(500, 'Error was encountered while parsing the game specification: ' + sys.inspect(e));
			return;
		}
		// FIXME: Hard-coded game options
		game = new ServerGame({
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
		req.reject(500, 'Unknown player secret ID "' + playerId + '"');
		return;
	}

	// Everything checks out, so accept the request and create a wrapper for the
	// connection to make it look more like browser WebSocket.

	req.on('requestAccepted', function (conn) {
		sys.log('<' + clientId + '> connected to game ' + game.id + ' as player ' + player.secretId);

		var wrapper = {
			send: conn.sendUTF.bind(conn),
			onopen: null,
			onmessage: null
		};

		player.setConnection(wrapper);

		conn.on('message', function (message) {
			wrapper.onmessage(message.utf8Data);
		});

		conn.on('close', function () {
			sys.log('<' + clientId + '> disconnected');
			if (player.connection === wrapper) {
				player.setConnection(null);
			}
		});

		wrapper.onopen();
	});

	req.accept(null, req.origin);
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
					'Content-Type': (hop(self.options.mimeTypes, extname) ? self.options.mimeTypes[extname] : 'text/plain'),
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