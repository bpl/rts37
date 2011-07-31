// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(
	[
		'engine/world/Actor',
		'engine/world/Game',
		'engine/world/Player'
	],
	function (
		Actor,
		Game,
		Player
	) {
		return {
			'Actor': Actor,
			'Game': Game,
			'Player': Player
		};
	}
);