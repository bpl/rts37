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