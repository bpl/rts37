// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

var assert = require('../engine/util').assert;

// Keeps track of active games on this server and when they need to be woken up
// to do whatever periodical processing they need to do.

function Manager() {
	// Games by game ID
	this.games = {};
	// Games sorted from the first to wake up to the last to wake up as a
	// delayed shift priority queue.
	this.wakeQueue = [];
	// The number of empty items at the start of the queue
	this.emptySpace = 0;
}

// Returns the active game with the specified id, or null, if no such game
// exists on this server.
Manager.prototype.gameWithId = function (id) {
	if (this.games.hasOwnProperty(id)) {
		return this.games[id] || null;
	}
	return null;
};

// Adds a game to the list of active games and enqueues it to wake up when it
// wants.
Manager.prototype.add = function (game) {
	assert(!this.games.hasOwnProperty(game.id), 'Manager.add: duplicate game ID');
	this.games[game.id] = game;
	this.enqueue(game);
};

// Enqueues a game to the wake queue, a priority queue of games sorted by the
// time they want to wake up the next time, starting from the earliest.
Manager.prototype.enqueue = function (game) {
	if (game.wakeAt > 0) {
		for (var i = this.wakeQueue.length - 1; i >= this.emptySpace; --i) {
			if (this.wakeQueue[i].wakeAt <= game.wakeAt) {
				this.wakeQueue.splice(i + 1, 0, game);
				return;
			}
		}
		// The game will be inserted at the beginning of the queue, so fall through
	}
	if (this.emptySpace > 0) {
		this.wakeQueue[--this.emptySpace] = game;
	} else {
		this.wakeQueue.unshift(game);
	}
};

// If there are one or more games that want to wake up at or after the current
// time (passed in as the 'now' parameter), returns the first such game.
// Otherwise, returns null.
Manager.prototype.tryDequeue = function (now) {
	if (this.emptySpace >= this.wakeQueue.length ||
			this.wakeQueue[this.emptySpace].wakeAt > now) {
		return null;
	}
	if (this.emptySpace * 2 < this.wakeQueue.length) {
		return this.wakeQueue[this.emptySpace++];
	}
	var result = this.wakeQueue[this.emptySpace];
	this.wakeQueue = this.wakeQueue.slice(this.emptySpace + 1);
	this.emptySpace = 0;
	return result;
};

exports.Manager = Manager;