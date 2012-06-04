// Copyright © 2012 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

define(['engine/util', 'engine/world/Game'], function (util, Game) {

	util.inherits(MyGame, Game);
	function MyGame(isLocal) {
		Game.prototype.constructor.call(this, isLocal);
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
				util.assert(actor.player === player, 'MyGame.handleCommand: player mismatch');
				actor.fireAtPos(cmd[2], cmd[3]);
				break;
			case 'AC':
				// Add unit to game (from parameters)
				// [1]['$type'] is the type of the unit to add
				// [1] is the parameter object passed to the constructor
				// FIXME: This is totally for debugging only
				var unitType = this.getUnitType(cmd[1]['$type']);
				this.createUnit(unitType, cmd[1]);
				break;
			default:
				Game.prototype.handleCommand.call(this, player, cmd);
				break;
		}
	};

	return MyGame;

});