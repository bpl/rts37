/////////////
// Player //
///////////

define(['engine/world/Actor'], function (Actor) {

	inherits(Player, Actor);
	function Player(opt /* id, playerId */) {
		assert(typeof opt.id === 'number', 'Player: id must be a number');
		assert(typeof opt.playerId === 'string', 'Player: playerId must be a string');
		Actor.call(this, 0, 0);
		this.id = opt.id;
		this.playerId = opt.playerId;
	}

	return Player;

});