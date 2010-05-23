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
	
var server = ws.createServer();

server.addListener('error', function (exception) {
	sys.log('Server error ' + exception);
});

// This gets called for example when the request listener throws an exception.
// It is shared by WebSocket and HTTP listeners.
server.addListener('clientError', function (exception) {
	sys.log('Server client error ' + exception);
});

server.addListener('listening', function () {
	sys.log('Listening for connections');
});

// WebSocket request handling
server.addListener('connection', function (conn) {
	sys.log('<' + conn._id + '> connected');
	
	conn.addListener('close', function () {
		sys.log('<' + conn._id + '> disconnected');
	});
	
	conn.addListener('message', function (msg) {
		sys.log('<' + conn._id + '> says ' + msg);
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