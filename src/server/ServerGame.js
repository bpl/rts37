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

var ServerPlayer = require('./ServerPlayer');
var util = require('../engine/util');

function ServerGame(opt /* id, ticksPerSecond, acceptedLagMsecs, gameSpec */) {
	//
	// Properties with static default values
	//
	this.currentTick = 0;
	this.running = false;
	this.wakeAt = 0;
	//
	// Properties that depend on game options
	//
	util.assert(typeof opt['id'] === 'string', 'ServerGame: id is not a string');
	util.assert(opt['ticksPerSecond'] > 0, 'ServerGame: ticksPerSecond is not a positive number');
	util.assert(typeof opt['gameSpec'] === 'object', 'ServerGame: gameSpec is not an object');
	var gameSpec = opt['gameSpec'];
	util.assert(gameSpec['players'].length > 0, 'ServerGame: No players specified');
	this.id = opt['id'];
	this.ticksPerSecond = opt['ticksPerSecond'];
	this.msecsPerTick = 1000 / this.ticksPerSecond;
	this.acceptedLagMsecs = opt['acceptedLagMsecs'];
	this.gameSpec = gameSpec;
	this.players = new util.Map();
	for (var i = 0; i < gameSpec['players'].length; ++i) {
		var playerData = gameSpec['players'][i];
		var player = new ServerPlayer({
			'game': this,
			'secretId': playerData['secretId'],
			'publicId': playerData['publicId']
		});
		this.players.set(player.secretId, player);
	}
}

ServerGame.prototype.playerWithSecretId = function (secretId) {
	return this.players.get(secretId) || null;
};

// Guaranteed delivery of a message to all players. This version of this
// function accepts a single parameter, containing the message as a
// JSON-formatted string.
ServerGame.prototype.deliverAllRaw = function (msg) {
	this.players.forEach(function (player) {
		player.deliverRaw(msg);
	}, this);
};

// Guaranteed delivery of a message to all players. This version of this
// function accepts the parts of the message as arguments.
ServerGame.prototype.deliverAll = function () {
	var parts = [];
	for (var i = 0; i < arguments.length; ++i) {
		parts.push(JSON.stringify(arguments[i]));
	}
	this.deliverAllRaw(parts.join(','));
};

/**
 * Send the appropriate scenario declaration to all players, including players
 * who have not joined yet. This must be called exactly once, after all player
 * objects have been added to the game.
 */
ServerGame.prototype.deliverScenario = function () {
	// FIXME: Make sure that secret player IDs don't accidentally get sent to other players
	this.players.forEach(function (player) {
		player.deliver('scenario', player.publicId, this.gameSpec);
	}, this);
};

// Called by the server when the current server clock exceeds time specified in
// wakeAt property.
ServerGame.prototype.wake = function (now) {
	// TODO: Is it necessary to try to prevent bunching here to keep the server
	// load stable?
	//
	// If we overslept i.e. the server temporarily froze for some reason,
	// do not try to catch up, and just process the next tick one tick length
	// from now. If we are on time, wake up the next time one tick length from
	// the exact moment we were supposed to wake up this time to keep the pace
	// as constant as possible.
	if (now - this.wakeAt > this.msecsPerTick * 1.5) {
		this.wakeAt = now + this.msecsPerTick;
	} else {
		this.wakeAt += this.msecsPerTick;
	}
	if (this.running) {
		// Check that no player is lagging
		// FIXME: Only restart when the lagging player has catched up fully
		// FIXME: Let other players know about the lag
		if (this.players.some(function (player) {
			return player.lastProcessedTick < this.currentTick - this.acceptedLagMsecs / this.msecsPerTick;
		}, this)) {
			return;
		}
		// Nobody is lagging, so we are cleared to advance
		this.deliverAll('tick', this.currentTick++);
		return;
	}
	// Start the game when all players have confirmed that all assets have been
	// loaded.
	if (this.players.some(function (player) {
		return !player.allAssetsLoaded;
	}, this)) {
		return;
	}
	// FIXME: Do this also if one of the players has failed to appear
	this.running = true;
};

module.exports = ServerGame;