/////////////////
// MyViewport //
///////////////

define(['dep/glmatrix/glmatrix', 'engine/client/Viewport'], function (glmatrix, Viewport) {

	inherits(MyViewport, Viewport);
	function MyViewport(client, opt /* x, y, width, height */) {
		Viewport.call(this, client, opt);
		this.worldToClip = glmatrix.Mat4.identity(glmatrix.Mat4.create());
	}

	MyViewport.prototype.draw = function (gl, uiCtx) {
		// M_model->screen =
		//    M_ndc->screen * M_projection * M_world->view * M_model->world

		var wtc = this.worldToClip;

		gl.viewport(this.x, this.y, this.width, this.height);

		wtc[0] = 1 / this.width;     // X scale
		wtc[5] = -1 / this.height;   // Y scale
//		wtc[12] = -this.game.fieldWidth / this.width / 2;    // X translation
//		wtc[13] = this.game.fieldHeight / this.height / 2;   // Y translation

		for (var idx in this.game.actors) {
			// FIXME: Pass the matrix in some other way
			this.game.actors[idx].draw(gl, uiCtx, this.game.factor, wtc);
		}

		/*
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
		*/
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
					&& 'issueFireAtPos' in actor) {
				actor.issueFireAtPos(this.lastMouseX, this.lastMouseY);
			}
		}
	};

	return MyViewport;

});