/////////////////
// MyViewport //
///////////////

define(['dep/glmatrix/glmatrix', 'engine/client/Viewport'], function (glmatrix, Viewport) {

	inherits(MyViewport, Viewport);
	function MyViewport(client, opt /* x, y, width, height */) {
		Viewport.call(this, client, opt);
		this.worldToClip = glmatrix.Mat4.identity(glmatrix.Mat4.create());
	}

	MyViewport.prototype.draw = function (gl) {
		// M_model->screen =
		//    M_ndc->screen * M_projection * M_world->view * M_model->world

		var wtc = this.worldToClip;
		var client = this.client;

		gl.viewport(this.x, this.y, this.width, this.height);

		wtc[0] = 2 / this.width;     // X scale
		wtc[5] = -2 / this.height;   // Y scale
		wtc[12] = -this.viewX / this.width * 2;    // X translation
		wtc[13] = this.viewY / this.height * 2;   // Y translation

		for (var idx in this.game.actors) {
			// FIXME: Pass the matrix in some other way
			this.game.actors[idx].draw(gl, client, this);
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
		for (var idx in this.client.selectedActors) {
			var actor = this.client.selectedActors[idx];
			if (actor.player == this.game.localPlayer
					&& 'issueFireAtPos' in actor) {
				actor.issueFireAtPos(this.lastMouseX, this.lastMouseY);
			}
		}
	};

	return MyViewport;

});