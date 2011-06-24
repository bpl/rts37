// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['dep/glmatrix/glmatrix', 'engine/client/Viewport'], function (glmatrix, Viewport) {

	inherits(MyViewport, Viewport);
	function MyViewport(client, opt /* x, y, width, height */) {
		Viewport.call(this, client, opt);

		this.fov = 60;   // Degrees
		this.zNear = 10;
		this.zFar = 1500;

		this.worldToView = glmatrix.Mat4.identity();
		this.projection = glmatrix.Mat4.identity();
		this.worldToClip = glmatrix.Mat4.identity();
		this.viewToWorld = glmatrix.Mat4.identity();
		// NT = Not Translated
		this.viewToWorldNT = glmatrix.Mat4.identity();

		this.visibleArea = new Float32Array(8);

		// Unit vector pointing towards the sun. The fourth component controls
		// the intensity of sunlight.
		// FIXME: Should reside in game or client
		var sun = glmatrix.Vec4.create();
		sun[0] = -1;
		sun[1] = 1;
		sun[2] = 1;
		sun[3] = 0.6;
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
		var vtwNT = this.viewToWorldNT;

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

		glmatrix.Mat4.identity(vtwNT);
		glmatrix.Mat4.translateVal(vtwNT, 0, 200, 600 * this.viewZoom);
		glmatrix.Mat4.rotateX(vtwNT, -Math.PI / 12);
		glmatrix.Mat4.scaleVal(vtwNT, 1, -1, 1);

		glmatrix.Mat4.perspective(
			this.fov,
			this.width / this.height,   // Aspect ratio
			this.zNear,
			this.zFar,
			prj
		);

		glmatrix.Mat4.multiply(prj, wtv, wtc);

		// Now that the matrices are done, find the visible area
		this.getVisibleArea(this.visibleArea);

		// Transform light direction from world to view space, leaving W alone
		glmatrix.Mat4.multiplyNormal3(wtv, this.sunLightWorld, this.sunLightView);
		glmatrix.Vec4.normalize(this.sunLightView);
		this.sunLightView[3] = this.sunLightWorld[3];

		// Draw the terrain
		this.game.map.draw(gl, client, this);

		// Draw the actors
		for (var idx in this.game.actors) {
			this.game.actors[idx].draw(gl, client, this);
		}

		// Draw the boundaries of the playfield
		this.client.uiRenderer.addRectWorld(wtc, 0, 0, this.game.fieldWidth, this.game.fieldHeight);
	};

	MyViewport.prototype._constrainView = function () {
		var va = this.visibleArea;

		if (va[4] - va[6] >= this.game.fieldWidth) {
			this.viewX = this.game.fieldWidth / 2;
		} else if (this.viewX < -va[6]) {
			this.viewX = -va[6];
		} else if (this.viewX > this.game.fieldWidth - va[4]) {
			this.viewX = this.game.fieldWidth - va[4];
		}

		if (va[7] - va[1] >= this.game.fieldHeight) {
			this.viewY = this.game.fieldHeight / 2;
		} else if (this.viewY < -va[1]) {
			this.viewY = -va[1];
		} else if (this.viewY > this.game.fieldHeight - va[7]) {
			this.viewY = this.game.fieldHeight - va[7];
		}
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

	// Returns the current view trapezoid, assuming the viewport is centered at
	// 0, 0. The area parameter will be mutated with the results.
	//
	// area [0][1] ------------ [2][3]         -
	//              \        /               - * +
	//               \      /                  +
	//         [6][7] ------ [4][5]
	MyViewport.prototype.getVisibleArea = function (area) {
		// FIXME: Use Vec3
		var upp = this._screenToWorldTempVec4;

		upp[0] = 0;
		upp[1] = 0;
		upp[2] = 0;
		upp[3] = 1;
		glmatrix.Mat4.multiplyVec4(this.viewToWorldNT, upp);
		var xa = upp[0];
		var ya = upp[1];
		var za = upp[2];

		for (var i = 0; i < 8; i += 2) {
			upp[0] = (i === 0 || i === 6 ? -1 : 1) * this.width / this.height;
			upp[1] = (i === 0 || i === 2 ? 1 : -1);
			upp[2] = -1 / Math.tan(this.fov * Math.PI / 360);
			upp[3] = 1;
			glmatrix.Mat4.multiplyVec4(this.viewToWorldNT, upp);
			var xb = upp[0];
			var yb = upp[1];
			var zb = upp[2];

			var t = za / (za - zb);   // t when z = 0

			area[i] = xa + (xb - xa) * t;
			area[i + 1] = ya + (yb - ya) * t;
		}
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