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

var util = require('../engine/util');

// Keeps track of active games on this server and when they need to be woken up
// to do whatever periodical processing they need to do.

function ServerManager() {
	// Games by game ID
	this.games = new util.Map();
	// Games sorted from the first to wake up to the last to wake up as a
	// delayed shift priority queue.
	this.wakeQueue = [];
	// The number of empty items at the start of the queue
	this.emptySpace = 0;
}

// Returns the active game with the specified id, or null, if no such game
// exists on this server.
ServerManager.prototype.gameWithId = function (id) {
	return this.games.get(id) || null;
};

// Adds a game to the list of active games and enqueues it to wake up when it
// wants.
ServerManager.prototype.add = function (game) {
	util.assert(!this.games.has(game.id), 'ServerManager.add: duplicate game ID');
	this.games.set(game.id, game);
	this.enqueue(game);
};

// Enqueues a game to the wake queue, a priority queue of games sorted by the
// time they want to wake up the next time, starting from the earliest.
ServerManager.prototype.enqueue = function (game) {
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
ServerManager.prototype.tryDequeue = function (now) {
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

module.exports = ServerManager;