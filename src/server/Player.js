// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

var Channel = require('../engine/util/Channel');

function Player(opt /* game, secretId, publicId */) {
	this.game = opt.game;
	this.secretId = opt.secretId;
	this.publicId = opt.publicId;

	this.assetsQueued = 0;
	this.assetsLoaded = 0;
	this.allAssetsLoaded = false;
	this.lastProcessedTick = 0;

	this.connection = null;   // FIXME: Remove, held by channel

	this.channel = new Channel();
	this.channel.didReceiveMessage.register(this._channelDidReceiveMessage, this);
	this.channel.didEncounterError.register(this.notifyError, this);
}

Player.prototype.setConnection = function (connection) {
	this.channel.setConnection(connection);
};

// Non-guaranteed delivery of a message to the player. The first argument is the
// connection the notification is to be sent to. The rest of the arguments
// make up the parts of the message. Implemented as a class function because we
// want to be able to send notifications connections with whom we have not
// associated a Player object.
Player.notify = Channel.notify.bind(Channel);

// Let the player know that there is a problem
Player.notifyError = function (connection, text) {
	this.notify(connection, 'error', {'msg': text});
};

// Guaranteed delivery of a message to this player, with the message given as a
// single string containing JSON notation fragment. Each message gets a delivery
// tag, a monotonically incrementing integer. The client will periodically echo
// the most recent tag received back to the server, so that the server knows
// which messages are safe to discard from the queue.
Player.prototype.deliverRaw = function (messageString) {
	this.channel.deliverRaw(messageString);
};

// Guaranteed delivery of a message to this player, with the parts of the
// message given as parameters. The parameters will be converted into JSON
// format. See Game.deliverAll for more information.
Player.prototype.deliver = function (/* ...arguments */) {
	this.channel.deliver.apply(this.channel, arguments);
};

// Let the player know that there is a problem
// This will also be called in response to an event from channel
Player.prototype.notifyError = function (text) {
	// FIXME: Use channel
	Player.notifyError(this.connection, text);
};

// Let the player know that there is a problem (with guaranteed delivery)
Player.prototype.deliverError = function (text) {
	this.channel.deliver('error', {'msg': text});
};

// Handle a message received from the player
Player.prototype._channelDidReceiveMessage = function (payload) {
	if (payload.length <= 0) {
		this.deliverError('Empty message payload');
		return;
	}
	if (typeof payload[0] === 'string') {
		// Player to server communication
		// The server should parse the rest of the message as JSON and act
		// upon it.
		switch (payload[1] || null) {
			case 'bail':
				// FIXME: Gracefully exit the game
				break;
			case 'ack':
				// Tick processing acknowledgement.
				// Parameters:
				// [2]: Tick number of the last tick processed
				if (typeof payload[2] != 'number') {
					this.notifyError('Invalid tick number ' + (payload[2] || '!MISSING'));
					break;
				}
				if (this.lastProcessedTick < payload[2]) {
					this.lastProcessedTick = payload[2];
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
	} else if (typeof payload[0] === 'object') {
		// Player to player broadcast
		// The server should forward the rest of the message to all players
		// FIXME: Proper escaping for id
		this.game.deliverAllRaw('"C",' + this.publicId + ',' + JSON.stringify(payload[0]));
	} else {
		// Unknown message format
		this.notifyError('Unknown message format ' + payload[0]);
	}
};

module.exports = Player;