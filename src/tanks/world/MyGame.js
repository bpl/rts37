/////////////
// MyGame //
///////////

define(['engine/world/Game', 'engine/world/CollisionContext'], function (Game, CollisionContext) {

	inherits(MyGame, Game);
	function MyGame(isLocal) {
		Game.prototype.constructor.call(this, isLocal);
		this.map = new Map(50, 37, 16);
		// FIXME: Hardcoded map content
		this.map.setTile(30, 20, 1);
		this.map.setTile(30, 21, 1);
		this.map.setTile(30, 22, 1);
		this.map.setTile(31, 22, 1);
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
				if (actor.validateMove && actor.validateMove(cmd[2], cmd[3])) {
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