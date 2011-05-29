////////////////
// Commander //
//////////////

define(['engine/world/Player', 'engine/util/Color'], function (Player, Color) {

	register('Commander', Commander);
	inherits(Commander, Player);
	function Commander(opt /* id, playerId, color */) {
		Player.call(this, opt);
		this.color = Color.require(opt.color);
	}

	return Commander;

});