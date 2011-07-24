// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/world/Game', 'engine/world/CollisionContext', 'engine/world/Map', 'engine/util/Image!tanks/images/map.png', 'engine/util/Image!tanks/textures/dim_grass2.jpg'], function (Game, CollisionContext, Map, mapImage, groundTextureImage) {

	inherits(MyGame, Game);
	function MyGame(isLocal) {
		Game.prototype.constructor.call(this, isLocal);
		// FIXME: Location of map image is hardcoded
		// FIXME: Map should probably reside in Game instead of MyGame
		this.map = new Map(mapImage, groundTextureImage);
		this.fieldWidth = this.map.width * this.map.tileSize;
		this.fieldHeight = this.map.height * this.map.tileSize;
		this.surfaceContext = new CollisionContext(this);
	}

	MyGame.prototype.handleCommand = function (player, cmd) {
		// The command is a JavaScript array, where cmd[0] is a string indicating
		// the type of the command. Commands may need to be validated because the server
		// echoes command from the clients without parsing them.
		switch (cmd[0]) {
			case 'GO':
				// Movement order
				// [1] is the actor the order was issued to
				// [2] is the target X coordinate
				// [3] is the target Y coordinate
				var actor = this.actorWithId(cmd[1]);
				if (actor.validateMove && actor.validateMove(player, cmd[2], cmd[3])) {
					actor.performMove(cmd[2], cmd[3]);
				}
				break;
			case 'FR':
				// Fire order
				// [1] is the actor the order was issued to
				// [2] is the target X coordinate
				// [3] is the target Y coordinate
				var actor = this.actorWithId(cmd[1]);
				assert(actor.player === player, 'MyGame.handleCommand: player mismatch');
				actor.fireAtPos(cmd[2], cmd[3]);
				break;
			default:
				Game.prototype.handleCommand.call(this, player, cmd);
				break;
		}
	};

	return MyGame;

});