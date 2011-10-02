// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

var ServerPlayer = require('./ServerPlayer');
var assert = require('../engine/util').assert;

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
	assert(typeof opt['id'] === 'string', 'ServerGame: id is not a string');
	assert(opt['ticksPerSecond'] > 0, 'ServerGame: ticksPerSecond is not a positive number');
	assert(typeof opt['gameSpec'] === 'object', 'ServerGame: gameSpec is not an object');
	var gameSpec = opt['gameSpec'];
	assert(gameSpec['players'].length > 0, 'ServerGame: No players specified');
	this.id = opt['id'];
	this.ticksPerSecond = opt['ticksPerSecond'];
	this.msecsPerTick = 1000 / this.ticksPerSecond;
	this.acceptedLagMsecs = opt['acceptedLagMsecs'];
	this.gameSpec = gameSpec;
	this.players = {};
	for (var i = 0; i < gameSpec['players'].length; ++i) {
		var playerData = gameSpec['players'][i];
		var player = new ServerPlayer({
			'game': this,
			'secretId': playerData['secretId'],
			'publicId': playerData['publicId']
		});
		this.players[player.secretId] = player;
	}
}

ServerGame.prototype.playerWithSecretId = function (secretId) {
	if (Object.prototype.hasOwnProperty.call(this.players, secretId)) {
		return this.players[secretId];
	}
	return null;
};

// Guaranteed delivery of a message to all players. This version of this
// function accepts a single parameter, containing the message as a
// JSON-formatted string.
ServerGame.prototype.deliverAllRaw = function (msg) {
	for (var id in this.players) {
		this.players[id].deliverRaw(msg);
	}
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
	for (var id in this.players) {
		var player = this.players[id];
		player.deliver('scenario', player.publicId, this.gameSpec);
	}
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
		for (var id in this.players) {
			if (this.players[id].lastProcessedTick < this.currentTick - this.acceptedLagMsecs / this.msecsPerTick) {
				return;
			}
		}
		// Nobody is lagging, so we are cleared to advance
		this.deliverAll('tick', this.currentTick++);
		return;
	}
	// Start the game when all players have confirmed that all assets have been
	// loaded.
	for (var id in this.players) {
		if (!this.players[id].allAssetsLoaded) {
			return;
		}
	}
	// FIXME: Do this also if one of the players has failed to appear
	this.running = true;
};

module.exports = ServerGame;