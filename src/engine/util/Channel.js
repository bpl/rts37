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

// Bi-directional communication channel that supports sending and receiving
// guaranteed and non-guaranteed messages.

// AMD support in Node.js only comes in two flavours, nonexistent (pre-0.5) and
// completely borken (0.5), so we need this shim.
(function (injects, callback) {
	if (typeof module === 'object' && 'exports' in module) {
		module.exports = callback(require('./Event'));
	} else if (typeof define === 'function') {
		define(injects, callback);
	} else {
		throw new Error('Both Require.js and Node.js globals missing');
	}
})(['engine/util/Event'], function (Event) {

	// The format of messages exchanged will be:
	//
	// deliveryTag,acknowledgementTag,[...message]
	//
	// deliveryTag:
	//     >0  This is a guaranteed message, with the specified delivery tag
	//      0  This is a non-guaranteed message
	//     -1  This is a request for recap
	//
	// acknowledgementTag: The delivery tag of the last guaranteed message
	//     received by this party.

	function Channel() {
		this.sendPingIfIdleMsecs = 1000;

		// Sending side
		this.lastSentAt = 0;
		this.lastSentTag = 0;
		this.deliveryQueue = [];

		// Receiving side
		this.lastReceivedTag = 0;

		this.connection = null;

		this.didReceiveMessage = new Event();
		this.didEncounterError = new Event();
	}

	/**
	 * Non-guaranteed delivery of a message to a connection without a channel.
	 * @param {object} connection WebSocket or an other object with a send
	 * method.
	 */
	Channel.notify = function (connection /* ...arguments */) {
		if (connection) {
			var parts = [0, 0];
			for (var i = 1; i < arguments.length; ++i) {
				parts.push(JSON.stringify(arguments[i]));
			}
			connection.send(parts.join(','));
		}
	};

	/**
	 * Sets the currently active connection of this channel. This channel will
	 * set the onopen and onmessage properties of the connection to handlers and
	 * call the send method when a message needs to be sent.
	 * @param {object} connection WebSocket or an other object providing members
	 * onopen, onmessage and send.
	 */
	Channel.prototype.setConnection = function (connection) {
		this.connection = connection;
		if (connection) {
			connection.onopen = this._didConnect.bind(this);
			connection.onmessage = this._didReceiveRawMessage.bind(this);
		}
	};

	/**
	 * Will be wired to be called whenever the connection connects (opens).
	 */
	Channel.prototype._didConnect = function () {
		// Let the other end know the latest message received by this end so
		// that it can recap if necessary.
		this._write(-1);
	};

	/**
	 * Will be wired to be called whenever a raw message has been received by
	 * the connection.
	 * @param {string|object} inMessage
	 */
	Channel.prototype._didReceiveRawMessage = function (inMessage) {
		var rawMessage;
		if (typeof inMessage === 'string') {
			rawMessage = inMessage;
		} else if (typeof inMessage === 'object' && typeof inMessage.data === 'string') {
			rawMessage = inMessage.data;
		} else {
			this.didEncounterError.emit('Parameter to _didReceiveRawMessage was not a string or an object containing a data string');
			return;
		}

		try {
			var parsedMessage = JSON.parse('{"d":[' + rawMessage + ']}')['d'];
		} catch (e) {
			this.didEncounterError.emit('JSON parsing failed: ' + e);
			return;
		}

		if (!parsedMessage || parsedMessage.length < 2) {
			this.didEncounterError.emit('Message was too sort');
			return;
		}

		var deliveryTag = parsedMessage[0];
		var acknowledgementTag = parsedMessage[1];

		if (typeof deliveryTag !== 'number' || typeof acknowledgementTag !== 'number') {
			this.didEncounterError.emit('Delivery or acknowledgement tag was not a number');
			return;
		}

		// Remove the messages that have been received successfully by the other end
		while (this.deliveryQueue.length > 0 && this.deliveryQueue[0][0] <= acknowledgementTag) {
			this.deliveryQueue.shift();
		}

		if (deliveryTag === -1) {
			// Recap if necessary
			for (var i = 0; i < this.deliveryQueue.length; ++i) {
				var item = this.deliveryQueue[i];
				this._write(item[0], item[1]);
			}
		} else {
			var process = false;

			if (deliveryTag === 0) {
				// Process notifications (non-guaranteed delivery messages)
				// always, because they won't be recapped.
				process = true;
			} else if (deliveryTag > this.lastReceivedTag) {
				// Process guaranteed delivery messages only if we have not
				// processed them already. (Already recapped messages shouldn't
				// get recapped though, because we let the server know the last
				// message we have processed when we reconnect.)
				this.lastReceivedTag = deliveryTag;
				process = true;
			}

			if (process & parsedMessage.length > 2) {
				parsedMessage.splice(0, 2);
				this.didReceiveMessage.emit(parsedMessage);
			}
		}
	};

	/**
	 * Send an empty message (ping) if it's time to send one.
	 */
	Channel.prototype.sendPingIfNecessary = function () {
		if (this.lastSentAt > 0
				&& this.lastSentAt + this.sendPingIfIdleMsecs < (new Date()).getTime()) {
			this._write(0);
		}
	};

	/**
	 * Non-guaranteed delivery of a message. Stringified arguments make up the
	 * message.
	 */
	Channel.prototype.notify = function (/* ...arguments */) {
		var parts = [];
		for (var i = 0; i < arguments.length; ++i) {
			parts.push(JSON.stringify(arguments[i]));
		}
		this._write(0, parts.join(','));
	};

	/**
	 * Guaranteed delivery of a message.
	 * @param {string} messageString JSON fragment to deliver.
	 */
	Channel.prototype.deliverRaw = function (messageString) {
		this._write(this.lastSentTag + 1, messageString);
	};

	/**
	 * Guaranteed delivery of a message. Stringified arguments make up the
	 * message.
	 */
	Channel.prototype.deliver = function (/* ...arguments */) {
		var parts = [];
		for (var i = 0; i < arguments.length; ++i) {
			parts.push(JSON.stringify(arguments[i]));
		}
		this._write(this.lastSentTag + 1, parts.join(','));
	};

	/**
	 * Sends the data, adds non-recap messages to the delivery queue and updates
	 * the ping timer.
	 * @param {number} deliveryTag
	 * @param {string} data
	 */
	Channel.prototype._write = function (deliveryTag, data) {
		if (deliveryTag > this.lastSentTag) {
			this.deliveryQueue.push([deliveryTag, data]);
			this.lastSentTag = deliveryTag;
		}
		// FIXME: Check the vitality of connection somewhere
		if (this.connection) {
			this.connection.send(
				deliveryTag +
				',' + this.lastReceivedTag +
				(typeof data !== 'undefined' ? ',' + data : '')
			);
		}
		this.lastSentAt = (new Date()).getTime();
	};

	return Channel;

});