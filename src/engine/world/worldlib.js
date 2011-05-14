define(
	[
		'engine/world/Actor',
		'engine/world/CollisionBound',
		'engine/world/CollisionContext',
		'engine/world/Event',
		'engine/world/Game',
		'engine/world/Player'
	],
	function (
		Actor,
		CollisionBound,
		CollisionContext,
		Event,
		Game,
		Player
	) {
		return {
			'Actor': Actor,
			'CollisionBound': CollisionBound,
			'CollisionContext': CollisionContext,
			'Event': Event,
			'Game': Game,
			'Player': Player
		};
	}
);