// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['dep/glmatrix/glmatrix', 'engine/client/Viewport'], function (glmatrix, Viewport) {

	inherits(MyViewport, Viewport);
	function MyViewport(client, opt /* x, y, width, height */) {
		Viewport.call(this, client, opt);
		this.worldToClip = glmatrix.Mat4.identity(glmatrix.Mat4.create());
	}

	MyViewport.prototype.draw = function (gl) {
		Viewport.prototype.draw.call(this, gl);

		// M_model->screen =
		//    M_ndc->screen * M_projection * M_world->view * M_model->world

		var wtc = this.worldToClip;
		var client = this.client;

		gl.viewport(this.x, this.y, this.width, this.height);

		wtc[0] = 2 / this.width / this.viewZoom;     // X scale
		wtc[5] = -2 / this.height / this.viewZoom;   // Y scale
		wtc[12] = -this.viewX / this.width * 2 / this.viewZoom;    // X translation
		wtc[13] = this.viewY / this.height * 2 / this.viewZoom;    // Y translation

		// Draw the actors
		for (var idx in this.game.actors) {
			this.game.actors[idx].draw(gl, client, this);
		}

		// Draw the boundaries of the playfield
		this.client.uiRenderer.addRectWorld(wtc, 0, 0, this.game.fieldWidth, this.game.fieldHeight);

		/*
		// Draw map tiles
		this.game.map.draw(ctx, uiCtx, this.factor);
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