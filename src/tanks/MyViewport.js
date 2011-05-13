/////////////////
// MyViewport //
///////////////

define(['engine/client/Viewport'], function (Viewport) {

	inherits(MyViewport, Viewport);
	function MyViewport(client, opt /* x, y, width, height */) {
		Viewport.call(this, client, opt);
	}

	MyViewport.prototype.draw = function (ctx, uiCtx) {
		ctx.save();
		ctx.translate(this.x, this.y);
		// Set clipping area and clear the background
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(this.width, 0);
		ctx.lineTo(this.width, this.height);
		ctx.lineTo(0, this.height);
		ctx.clip();
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.scale(1 / this.viewZoom, 1 / this.viewZoom);
		ctx.lineWidth = (this.viewZoom > 1 ? this.viewZoom : 1);
		ctx.translate(-this.viewX + this.width / 2 * this.viewZoom,
				-this.viewY + this.height / 2 * this.viewZoom);
		// Draw firing range spheres
		ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
		ctx.beginPath();
		for (var idx in this.game.actors) {
			if (typeof this.game.actors[idx].addFiringArc == 'function') {
				this.game.actors[idx].addFiringArc(ctx, 0, this.game.factor);
				ctx.closePath();
			}
		}
		ctx.fill();
		ctx.fillStyle = '#000';
		ctx.beginPath();
		for (var idx in this.game.actors) {
			if (typeof this.game.actors[idx].addFiringArc == 'function') {
				this.game.actors[idx].addFiringArc(ctx, -1, this.game.factor);
				ctx.closePath();
			}
		}
		ctx.fill();
		// Draw radar spheres
		ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
		ctx.beginPath();
		for (var idx in this.game.actors) {
			if (typeof this.game.actors[idx].addRadarArc == 'function') {
				this.game.actors[idx].addRadarArc(ctx, 0, this.game.factor);
				ctx.closePath();
			}
		}
		ctx.fill();
		ctx.fillStyle = '#000';
		ctx.beginPath();
		for (var idx in this.game.actors) {
			if (typeof this.game.actors[idx].addRadarArc == 'function') {
				this.game.actors[idx].addRadarArc(ctx, -1, this.game.factor);
				ctx.closePath();
			}
		}
		ctx.fill();
		// Draw the boundaries of the playfield
		ctx.strokeStyle = '#fff';
		ctx.strokeRect(0, 0, this.game.fieldWidth, this.game.fieldHeight);
		// Draw map tiles
		this.game.map.draw(ctx, uiCtx, this.game.factor);
		// Draw everything else
		for (var idx in this.game.actors) {
			this.game.actors[idx].draw(ctx, uiCtx, this.game.factor);
		}
		ctx.restore();
	};

	MyViewport.prototype.handleKeyPress = function (key) {
		switch (key) {
			case 'x':
				this.fireWithSelected();
				break;
			default:
				Viewport.prototype.handleKeyPress.call(this, key);
				break;
		}
	};

	MyViewport.prototype.fireWithSelected = function () {
		for (var idx in this.client.uiContext.selectedActors) {
			var actor = this.client.uiContext.selectedActors[idx];
			if (actor.player == this.game.localPlayer
					&& instanceOf(actor, Vehicle)) {
				actor.issueFireAtPos(this.lastMouseX, this.lastMouseY);
			}
		}
	};

	return MyViewport;

});