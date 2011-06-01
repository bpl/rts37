// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['dep/glmatrix/glmatrix', 'engine/client/Viewport'], function (glmatrix, Viewport) {

	inherits(MyViewport, Viewport);
	function MyViewport(client, opt /* x, y, width, height */) {
		Viewport.call(this, client, opt);
		this.worldToView = glmatrix.Mat4.identity(glmatrix.Mat4.create());
		this.projection = glmatrix.Mat4.identity(glmatrix.Mat4.create());
		this.worldToClip = glmatrix.Mat4.identity(glmatrix.Mat4.create());
	}

	MyViewport.prototype.draw = function (gl) {
		Viewport.prototype.draw.call(this, gl);

		// M_model->screen =
		//    M_ndc->screen * M_projection * M_world->view * M_model->world

		var wtv = this.worldToView;
		var prj = this.projection;
		var wtc = this.worldToClip;
		var client = this.client;

		gl.viewport(this.x, this.y, this.width, this.height);

		glmatrix.Mat4.identity(wtv);
		glmatrix.Mat4.scaleVal(wtv, 1, -1, 1);
		glmatrix.Mat4.rotateX(wtv, Math.PI / 12);
		glmatrix.Mat4.translateVal(wtv, -this.viewX, -this.viewY - 200, -600 * this.viewZoom);

		glmatrix.Mat4.perspective(
			60,   // FOV in degrees
			this.width / this.height,   // Aspect ratio
			10,   // zNear
			1500,   // zFar,
			prj
		);

		glmatrix.Mat4.multiply(prj, wtv, wtc);

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