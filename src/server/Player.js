// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

function Player(opt /* game, secretId, publicId */) {
	this.game = opt.game;
	this.secretId = opt.secretId;
	this.publicId = opt.publicId;
	this.connection = null;
	this.lastDeliveryTag = 0;
	this.assetsQueued = 0;
	this.assetsLoaded = 0;
	this.allAssetsLoaded = false;
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
					// [4]: True if all assets have been loaded
					if (typeof payload[2] != 'number') {
						this.notifyError('Invalid number of loaded assets ' + (payload[2] || '!MISSING'));
						break;
					} else if (payload[2] < this.assetsLoaded) {
						this.notifyError('Client reduced the number of loaded assets');
						break;
					}
					if (typeof payload[3] != 'number') {
						this.notifyError('Invalid number of known assets ' + (payload[3] || '!MISSING'));
						break;
					} else if (payload[3] < this.assetsQueued) {
						this.notifyError('Client reduced the number of queued assets');
						break;
					}
					if (typeof payload[4] != 'boolean') {
						this.notifyError('Invalid state of all assets having been loaded ' + (payload[4] || '!MISSING'));
						break;
					} else if (!payload[4] && this.allAssetsLoaded) {
						this.notifyError('Client changed the state of all assets being loaded from true to false');
						break;
					}
					this.assetsLoaded = payload[2];
					this.assetsQueued = payload[3];
					this.allAssetsLoaded = payload[4];
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
			this.game.deliverAllRaw('"C",' + this.publicId + ',' + msg.substr(1));
			break;
		default:
			// Unknown message format
			this.notifyError('Unknown message format ' + msg[0]);
			break;
	}
};

exports.Player = Player;