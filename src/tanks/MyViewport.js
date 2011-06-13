// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['dep/glmatrix/glmatrix', 'engine/client/Viewport'], function (glmatrix, Viewport) {

	inherits(MyViewport, Viewport);
	function MyViewport(client, opt /* x, y, width, height */) {
		Viewport.call(this, client, opt);

		this.fov = 60;   // Degrees
		this.zNear = 10;
		this.zFar = 1500;

		this.worldToView = glmatrix.Mat4.identity(glmatrix.Mat4.create());
		this.projection = glmatrix.Mat4.identity(glmatrix.Mat4.create());
		this.worldToClip = glmatrix.Mat4.identity(glmatrix.Mat4.create());
		this.viewToWorld = glmatrix.Mat4.identity(glmatrix.Mat4.create());

		// Unit vector pointing towards the sun. The fourth component controls
		// the intensity of sunlight.
		var sun = glmatrix.Vec4.create();
		sun[0] = -1;
		sun[1] = 0;
		sun[2] = 0.25;
		sun[3] = 0.5;
		glmatrix.Vec4.normalize(sun);
		this.sunLightWorld = sun;
		this.sunLightView = glmatrix.Vec4.create();

		this._screenToWorldTempVec4 = glmatrix.Vec4.create();
	}

	MyViewport.prototype.draw = function (gl) {
		Viewport.prototype.draw.call(this, gl);

		// M_model->screen =
		//    M_ndc->screen * M_projection * M_world->view * M_model->world

		var wtv = this.worldToView;
		var prj = this.projection;
		var wtc = this.worldToClip;
		var vtw = this.viewToWorld;

		var client = this.client;

		gl.viewport(this.x, this.y, this.width, this.height);

		glmatrix.Mat4.identity(wtv);
		glmatrix.Mat4.scaleVal(wtv, 1, -1, 1);
		glmatrix.Mat4.rotateX(wtv, Math.PI / 12);
		glmatrix.Mat4.translateVal(wtv, -this.viewX, -this.viewY - 200, -600 * this.viewZoom);

		glmatrix.Mat4.identity(vtw);
		glmatrix.Mat4.translateVal(vtw, this.viewX, this.viewY + 200, 600 * this.viewZoom);
		glmatrix.Mat4.rotateX(vtw, -Math.PI / 12);
		glmatrix.Mat4.scaleVal(vtw, 1, -1, 1);
		// FIXME: See if this is actually faster
//		glmatrix.Mat4.inverse(wtv, this.viewToWorld);

		glmatrix.Mat4.perspective(
			this.fov,
			this.width / this.height,   // Aspect ratio
			this.zNear,
			this.zFar,
			prj
		);

		glmatrix.Mat4.multiply(prj, wtv, wtc);

		glmatrix.Vec4.set(this.sunLightWorld, this.sunLightView);
		glmatrix.Mat4.multiplyVec3(wtv, this.sunLightView);   // Leave w alone
		glmatrix.Vec4.normalize(this.sunLightView);

		// Draw the terrain
		this.game.map.draw(gl, client, this);

		// Draw the actors
		for (var idx in this.game.actors) {
			this.game.actors[idx].draw(gl, client, this);
		}

		// Draw the boundaries of the playfield
		this.client.uiRenderer.addRectWorld(wtc, 0, 0, this.game.fieldWidth, this.game.fieldHeight);
	};

	MyViewport.prototype.screenToWorld = function (x, y) {
		// FIXME: Use Vec3
		var upp = this._screenToWorldTempVec4;

		upp[0] = 0;
		upp[1] = 0;
		upp[2] = 0;
		upp[3] = 1;
		glmatrix.Mat4.multiplyVec4(this.viewToWorld, upp);
		var xa = upp[0];
		var ya = upp[1];
		var za = upp[2];

		upp[0] = 2 / this.height * x - this.width / this.height;
		upp[1] = -2 / this.height * y + 1;
		upp[2] = -1 / Math.tan(this.fov * Math.PI / 360);
		upp[3] = 1;
		glmatrix.Mat4.multiplyVec4(this.viewToWorld, upp);
		var xb = upp[0];
		var yb = upp[1];
		var zb = upp[2];

		var t = za / (za - zb);   // t when z = 0

		return [
			xa + (xb - xa) * t << 10,
			ya + (yb - ya) * t << 10
		];
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