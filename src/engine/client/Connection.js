// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

// Connection (WebSocket handling)

define(function () {

	var INCOMING_LOG_FILTER = /^\d+,\d+,"tick",\d+$/;

	var OUTGOING_LOG_FILTER = /^\d+,\d+,"ack",\d+$/;

	function Connection(url) {
		this.logging = false;

		this.onopen = null;
		this.onmessage = null;

		// TODO: Firefox should drop the Moz prefix soon. This can then be removed.
		if (typeof WebSocket !== 'undefined') {
			this.socket = new WebSocket(url);
		} else if (typeof MozWebSocket !== 'undefined') {
			this.socket = new MozWebSocket(url);
		} else {
			throw new Error('Neither WebSocker nor MozWebSocket global was found');
		}

		this.socket.onopen = this._handleOpen.bind(this);
		this.socket.onmessage = this._handleMessage.bind(this);
	}

	Connection.prototype.setLogging = function (value) {
		this.logging = value && typeof console != 'undefined';
	};

	Connection.prototype._handleOpen = function () {
		if (this.logging) {
			console.info('WebSocket connected');
		}
		if (this.onopen) {
			this.onopen();
		}
	};

	Connection.prototype._handleMessage = function (evt) {
		if (this.logging && !evt.data.match(INCOMING_LOG_FILTER)) {
			console.info('Received: ' + evt.data);
		}
		if (this.onmessage) {
			this.onmessage(evt);
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