////////////
// Actor //
//////////

define(function () {

	function Actor(x, y) {
		this.game = null;
		this.id = null;
		this.x = x;
		this.y = y;
		// Delta from last. This should be positive if the value has increased since last tick and
		// negative if the value has decreased since last tick. It will be multiplied with
		// the interpolation factor and *substracted* from the current value (yes, the interpolation
		// factor is a bit backwards, but removes one calculation step).
		this.dflX = 0;
		this.dflY = 0;
	}

	Actor.prototype.setGame = function (game) {
		assert(game && typeof game === 'object', 'Actor.setGame: game must be an object');
		assert(this.game === null, 'Actor.setGame: must not set game twice');
		this.game = game;
	};

	Actor.prototype.afterRemove = function () {
		// this function intentionally left blank
	};

	Actor.prototype.tick = function () {
		// This function intentionally left blank
	};

	Actor.prototype.draw = function (gl, uiCtx, factor) {
		// This function intentionally left blank
	};

	Actor.prototype.clickTest = function (x, y, factor) {
		return false;
	};

	// Returns true if this actor is selectable by the local player
	Actor.prototype.isSelectable = function () {
		return false;
	};

	return Actor;

});