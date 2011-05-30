// Connection (WebSocket handling)

define(function () {

	var INCOMING_LOG_FILTER = /^\d+,"tick",\d+$/;

	var OUTGOING_LOG_FILTER = /^\d+,"ack",\d+,\d+$/;

	function Connection(game, url) {
		var self = this;
		this.game = game;
		this.logging = false;
		this.socket = new WebSocket(url);
		this.socket.onopen = function () {
			self.handleOpen();
		};
		this.socket.onmessage = function (evt) {
			self.handleMessage(evt);
		};
	}

	Connection.prototype.setLogging = function (value) {
		this.logging = value && typeof console != 'undefined';
	};

	Connection.prototype.handleOpen = function () {
	};

	Connection.prototype.handleMessage = function (evt) {
		if (this.logging && !evt.data.match(INCOMING_LOG_FILTER)) {
			console.info('Received: ' + evt.data);
		}
		if (evt.data) {
			this.game.handleMessageString(evt.data);
		}
	};

	Connection.prototype.send = function (data) {
		if (this.logging && !data.match(OUTGOING_LOG_FILTER)) {
			console.info('Sent: ' + data);
		}
		this.socket.send(data);
	};

	return Connection;

});