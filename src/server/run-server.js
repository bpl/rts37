// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

// Configuration for a simple test server

var sys = require('sys');
var net = require('net');
var repl = require('repl');
var Server = require('./Server');

var options = {
	// The TCP port this server will listen to for HTTP and WebSocket
	// connections. Must be greater than zero.
	listenPort: 8000,
	// The TCP port this server will listen to for REPL session connections
	// (use netcat to connect and issue commands). Set to zero to disable REPL
	// access. Disabling REPL is pretty much mandatory for *all* public
	// installations, as currently no authentication or encryption is provided
	// at all.
	replPort: 8001,
	// The document root for HTTP requests
	documentRoot: '../',
	// File extension to MIME type associations
	mimeTypes: {
		'html': 'text/html; charset=utf-8',
		'css': 'text/css',
		'js': 'text/javascript'
	},
	// How long can a client keep missing tick processing acknowledgements
	// before it is considered lagging.
	acceptedLagMsecs: 5000
};

var serverInstance = new Server(options);

serverInstance.listen();

// REPL server, a lightweight alternative to a remote debugger
if (options.replPort > 0) {
	// Node.js makes this almost too easy. Copied pretty much in verbatim from
	// the documentation of the REPL module.
	net.createServer(function (socket) {
		var instance = repl.start('repl> ', socket);
		// Expose the server state to the REPL instance
		instance.context.Manager = server.Manager;
		instance.context.Game = server.Game;
		instance.context.Player = server.Player;
		instance.context.Server = server.Server;
		instance.context.server = serverInstance;
		instance.context.manager = serverInstance.manager;
		instance.context.games = serverInstance.manager.games;
		sys.log('REPL session started with ' + socket.remoteAddress);
	}).listen(options.replPort);
	sys.log('Warning: REPL active on port ' + options.replPort);
}