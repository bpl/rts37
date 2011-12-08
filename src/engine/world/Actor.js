// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

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