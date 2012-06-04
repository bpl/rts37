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

var Channel = require('../engine/util/Channel');

function ServerPlayer(opt /* game, secretId, publicId */) {
	this.game = opt.game;
	this.secretId = opt.secretId;
	this.publicId = opt.publicId;

	this.assetsQueued = 0;
	this.assetsLoaded = 0;
	this.allAssetsLoaded = false;
	this.lastProcessedTick = 0;

	this.channel = new Channel();
	this.channel.didReceiveMessage.register(this._channelDidReceiveMessage, this);
	this.channel.didEncounterError.register(this.notifyError, this);
}

ServerPlayer.prototype.setConnection = function (connection) {
	this.channel.setConnection(connection);
};

// Guaranteed delivery of a message to this player, with the message given as a
// single string containing JSON notation fragment. Each message gets a delivery
// tag, a monotonically incrementing integer. The client will periodically echo
// the most recent tag received back to the server, so that the server knows
// which messages are safe to discard from the queue.
ServerPlayer.prototype.deliverRaw = function (messageString) {
	this.channel.deliverRaw(messageString);
};

// Guaranteed delivery of a message to this player, with the parts of the
// message given as parameters. The parameters will be converted into JSON
// format. See ServerGame.deliverAll for more information.
ServerPlayer.prototype.deliver = function (/* ...arguments */) {
	this.channel.deliver.apply(this.channel, arguments);
};

// Let the player know that there is a problem
// This will also be called in response to an event from channel
ServerPlayer.prototype.notifyError = function (text) {
	this.channel.notify('error', {'msg': text});
};

// Let the player know that there is a problem (with guaranteed delivery)
ServerPlayer.prototype.deliverError = function (text) {
	this.channel.deliver('error', {'msg': text});
};

// Handle a message received from the player
ServerPlayer.prototype._channelDidReceiveMessage = function (payload) {
	if (payload.length <= 0) {
		this.deliverError('Empty message payload');
		return;
	}
	if (typeof payload[0] === 'string') {
		// Player to server communication
		// The server should parse the rest of the message as JSON and act
		// upon it.
		switch (payload[0] || null) {
			case 'bail':
				// FIXME: Gracefully exit the game
				break;
			case 'ack':
				// Tick processing acknowledgement.
				// Parameters:
				// [1]: Tick number of the last tick processed
				if (typeof payload[1] != 'number') {
					this.notifyError('Invalid tick number ' + (payload[1] || '!MISSING'));
					break;
				}
				if (this.lastProcessedTick < payload[1]) {
					this.lastProcessedTick = payload[1];
				}
				break;
			case 'assetReady':
				// Acknowledgement that some assets have finished loading.
				// Parameters:
				// [1]: The number of assets that have finished loading
				// [2]: Total number of assets the client knows it needs
				// [3]: True if all assets have been loaded
				if (typeof payload[1] != 'number') {
					this.notifyError('Invalid number of loaded assets ' + (payload[1] || '!MISSING'));
					break;
				} else if (payload[1] < this.assetsLoaded) {
					this.notifyError('Client reduced the number of loaded assets');
					break;
				}
				if (typeof payload[2] != 'number') {
					this.notifyError('Invalid number of known assets ' + (payload[2] || '!MISSING'));
					break;
				} else if (payload[2] < this.assetsQueued) {
					this.notifyError('Client reduced the number of queued assets');
					break;
				}
				if (typeof payload[3] != 'boolean') {
					this.notifyError('Invalid state of all assets having been loaded ' + (payload[3] || '!MISSING'));
					break;
				} else if (!payload[3] && this.allAssetsLoaded) {
					this.notifyError('Client changed the state of all assets being loaded from true to false');
					break;
				}
				this.assetsLoaded = payload[1];
				this.assetsQueued = payload[2];
				this.allAssetsLoaded = payload[3];
				break;
			default:
				this.notifyError('Unknown message type ' + (payload[0] || '!MISSING'));
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

module.exports = ServerPlayer;