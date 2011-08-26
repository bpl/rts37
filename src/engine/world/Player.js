// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/Color'], function (Color) {

	function Player(opt /* publicId, color */) {
		assert(typeof opt.publicId === 'number', 'Player: publicId must be a number');
		this.publicId = opt['publicId'];
		this.color = Color.require(opt['color']);
	}

	return Player;

});