// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util', 'engine/util/Color'], function (util, Color) {

	function Player(opt /* publicId, color */) {
		util.assert(typeof opt.publicId === 'number', 'Player: publicId must be a number');
		this.publicId = opt['publicId'];
		this.color = Color.require(opt['color']);
	}

	return Player;

});