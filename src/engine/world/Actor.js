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

define(['engine/util'], function (util) {

	function Actor(opt /* game, x, y */) {
		util.assert(opt['game'] && typeof opt['game'] === 'object', 'Actor: game must be an object');
		this.game = opt['game'];
		this.id = null;
		this.batchName = '';
		this.x = util.required(opt.x);
		this.y = util.required(opt.y);
		// Delta from last. This should be positive if the value has increased since last tick and
		// negative if the value has decreased since last tick. It will be multiplied with
		// the interpolation factor and *substracted* from the current value (yes, the interpolation
		// factor is a bit backwards, but removes one calculation step).
		// TODO: Premature and unnecessary optimization. Use saner approach.
		this.dflX = 0;
		this.dflY = 0;
	}

	Actor.prototype.afterRemove = function () {
		// this function intentionally left blank
	};

	Actor.prototype.tick = function () {
		// This function intentionally left blank
	};

	Actor.prototype.draw = function (gl, client, viewport) {
		// Provided here for documentation purposes
	};

	Actor.prototype.clickTest = function (x, y, client) {
		return false;
	};

	// Returns true if this actor is selectable by the local player
	Actor.prototype.isSelectable = function () {
		return false;
	};

	return Actor;

});