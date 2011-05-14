////////////////
// Commander //
//////////////

define(['engine/world/Player'], function (Player) {

	register('Commander', Commander);
	inherits(Commander, Player);
	function Commander(opt /* id, playerId, color */) {
		Player.call(this, opt);
		this.color = Color.require(opt.color);
	}

	return Commander;

});