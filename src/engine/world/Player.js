define(['engine/world/Actor', 'engine/util/Color'], function (Actor, Color) {

	register('Player', Player);
	inherits(Player, Actor);
	function Player(opt /* id, playerId, color */) {
		assert(typeof opt.id === 'number', 'Player: id must be a number');
		assert(typeof opt.playerId === 'string', 'Player: playerId must be a string');
		Actor.call(this, 0, 0);
		this.id = opt.id;
		this.playerId = opt.playerId;
		this.color = Color.require(opt.color);
	}

	return Player;

});