// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/gllib', 'engine/client/Viewport', 'engine/client/Billboard', 'engine/util/Texture'], function (gllib, Viewport, Billboard, Texture) {

	const Mat4 = gllib.Mat4;
	const Vec3 = gllib.Vec3;
	const Vec4 = gllib.Vec4;
	const Plane = gllib.Plane;

	var tempVec41 = Vec4.create();
	var tempVec42 = Vec4.create();
	var tempVec43 = Vec4.create();
	var tempVec44 = Vec4.create();

	var tempVec31 = Vec3.create();
	var tempVec32 = Vec3.create();
	var tempVec33 = Vec3.create();
	var tempVec34 = Vec3.create();
	var tempVec35 = Vec3.create();

	const invertYMat4 = Mat4.scaleVal(Mat4.identity(), 1, -1, 1);

	inherits(MyViewport, Viewport);
	function MyViewport(client, opt /* x, y, width, height */) {
		Viewport.call(this, client, opt);

		this.fov = 60;   // Degrees
		this.zNear = 10;
		this.zFar = 1500;

		this.worldToView = Mat4.identity();
		this.projection = Mat4.identity();
		this.worldToClip = Mat4.identity();
		this.viewToWorld = Mat4.identity();
		// NT = Not Translated
		this.viewToWorldNT = Mat4.identity();

		this.shadowWorldToView = Mat4.identity();
		this.shadowProjection = Mat4.identity();
		this.shadowWorldToClip = Mat4.identity();

		this.visibleArea = new Float32Array(8);

		this.visibleSet = [];

		// Unit vector pointing towards the sun. The fourth component controls
		// the intensity of sunlight.
		// FIXME: Should reside in game or client
		var sun = Vec4.create();
		sun[0] = -1;
		sun[1] = 1;
		sun[2] = 1;
		sun[3] = 0.6;
		Vec4.normalize(sun);
		this.sunLightWorld = sun;
		this.sunLightView = Vec4.create();

		this.shadowTexture = new Texture({
			'width': 1024,
			'height': 1024,
			'mipmap': false,
			'mag_filter': 'nearest',
			'min_filter': 'nearest',
			'wrap_s': 'clamp_to_edge',
			'wrap_t': 'clamp_to_edge'
		});
		this.shadowFramebuffer = null;

		gllib.needsContext(function (gl) {
			// Initialize framebuffer for shadow mapping
			this.shadowFramebuffer = gl.createFramebuffer();

			var rb = gl.createRenderbuffer();
			gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
			gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.shadowTexture.width, this.shadowTexture.height);
			gl.bindRenderbuffer(gl.RENDERBUFFER, null);

			gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.shadowTexture.texture, 0);
			gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
			var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);

			if (status !== gl.FRAMEBUFFER_COMPLETE) {
				throw new Error('MyViewport: Framebuffer not complete, status ' + status);
			}
		}, this);
	}

	MyViewport.prototype.draw = function (gl) {
		Viewport.prototype.draw.call(this, gl);

		if (!this.game.map) {
			return;
		}

		// M_model->screen =
		//    M_ndc->screen * M_projection * M_world->view * M_model->world

		var wtv = this.worldToView;
		var prj = this.projection;
		var wtc = this.worldToClip;
		var vtw = this.viewToWorld;
		var vtwNT = this.viewToWorldNT;

		var swtv = this.shadowWorldToView;
		var sprj = this.shadowProjection;
		var swtc = this.shadowWorldToClip;

		var sun = this.sunLightWorld;

		var client = this.client;

		//
		// Set up matrices for view rendering
		//

		Mat4.identity(wtv);
		Mat4.scaleVal(wtv, 1, -1, 1);
		Mat4.rotateX(wtv, Math.PI / 12);
		Mat4.translateVal(wtv, -this.viewX, -this.viewY - 200, -600 * this.viewZoom);

		Mat4.identity(vtw);
		Mat4.translateVal(vtw, this.viewX, this.viewY + 200, 600 * this.viewZoom);
		Mat4.rotateX(vtw, -Math.PI / 12);
		Mat4.scaleVal(vtw, 1, -1, 1);

		Mat4.identity(vtwNT);
		Mat4.translateVal(vtwNT, 0, 200, 600 * this.viewZoom);
		Mat4.rotateX(vtwNT, -Math.PI / 12);
		Mat4.scaleVal(vtwNT, 1, -1, 1);

		Mat4.perspective(
			this.fov,
			this.width / this.height,   // Aspect ratio
			this.zNear,
			this.zFar,
			prj
		);

		Mat4.multiply(prj, wtv, wtc);

		// Now that the matrices are done, find the visible area
		this.getVisibleArea(this.visibleArea);

		// Transform light direction from world to view space, leaving W alone
		Mat4.multiplyNormal3(wtv, this.sunLightWorld, this.sunLightView);
		Vec4.normalize(this.sunLightView);
		this.sunLightView[3] = this.sunLightWorld[3];

		//
		// Set up matrices for shadow map rendering
		//

		Mat4.lookAt(
			Vec3.values(
				sun[0] * 700 + this.viewX,
				sun[1] * -700 - this.viewY,
				sun[2] * 700,
				tempVec31
			),
			Vec3.values(this.viewX, -this.viewY, 0, tempVec32),
			Vec3.values(0, 0, 1, tempVec33),
			swtv
		);
		Mat4.multiply(swtv, invertYMat4, swtv);

		this._calculateShadowMapFrustrum();

		Mat4.multiply(sprj, swtv, swtc);

		// Determine which actors to draw (the visible set) and sort them into
		// batches for faster drawing.
		this._determineSortedVisibleSet();

		//
		// Shadow map rendering
		//

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
		gl.viewport(0, 0, this.shadowTexture.width, this.shadowTexture.height);
		gl.clearColor(1, 1, 1, 1);
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
		gl.cullFace(gl.FRONT);

		this._drawVisibleSet(gl, 'drawShadowMapMultiple');

		//
		// View rendering
		//

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(this.x, this.y, this.width, this.height);
		gl.clearColor(0, 0, 0, 0);
		gl.cullFace(gl.BACK);

		// We use a convention that texture unit 0 is reserved for the shadow map
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture.texture);

		// Draw the terrain
		this.game.map.draw(gl, client, this);

		// Draw the actors
		this._drawVisibleSet(gl, 'drawMultiple');

		// Draw the billboards
		Billboard.draw(gl, client, this);

		// Draw the boundaries of the playfield
		this.client.uiRenderer.addRectWorld(wtc, 0, 0, this.game.fieldWidth, this.game.fieldHeight);

		// Draw the area selection rectangle
		if (this._areaSelectionActive) {
			this.client.uiRenderer.addRectScreen(this,
				this._areaSelectionStartX, this._areaSelectionStartY,
				this._areaSelectionEndX, this._areaSelectionEndY
			);
		}

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, null);
	};

	MyViewport.prototype._determineSortedVisibleSet = function () {
		var vs = this.visibleSet;

		// FIXME: Actually determine the visible set
		vs.length = 0;
		for (var i = 0; i < this.game.actors.length; ++i) {
			var actor = this.game.actors[i];
			vs.push(actor);
		}

		// FIXME: Do some other kind of sorting
		vs.sort(function (a, b) {
			if (a.batchName < b.batchName) {
				return -1;
			}
			if (a.batchName > b.batchName) {
				return 1;
			}
			return 0;
		});
	};

	MyViewport.prototype._drawVisibleSet = function (gl, drawMethodName) {
		var client = this.client;
		var vs = this.visibleSet;
		var begin = 0;
		while (begin < vs.length) {
			var currentType = vs[begin].constructor;

			var end = begin + 1;
			while (end < vs.length && vs[end].constructor === currentType) {
				++end;
			}

			var drawMethod = currentType[drawMethodName];
			if (drawMethod) {
				drawMethod.call(currentType, gl, client, this, vs, begin, end);
			}

			begin = end;
		}
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
		var upp = tempVec31;

		upp[0] = 0;
		upp[1] = 0;
		upp[2] = 0;
		Mat4.multiplyVec3(this.viewToWorld, upp);
		var xa = upp[0];
		var ya = upp[1];
		var za = upp[2];

		upp[0] = 2 / this.height * x - this.width / this.height;
		upp[1] = -2 / this.height * y + 1;
		upp[2] = -1 / Math.tan(this.fov * Math.PI / 360);
		Mat4.multiplyVec3(this.viewToWorld, upp);
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
		var upp = tempVec31;

		upp[0] = 0;
		upp[1] = 0;
		upp[2] = 0;
		Mat4.multiplyVec3(this.viewToWorldNT, upp);
		var xa = upp[0];
		var ya = upp[1];
		var za = upp[2];

		for (var i = 0; i < 8; i += 2) {
			upp[0] = (i === 0 || i === 6 ? -1 : 1) * this.width / this.height;
			upp[1] = (i === 0 || i === 2 ? 1 : -1);
			upp[2] = -1 / Math.tan(this.fov * Math.PI / 360);
			Mat4.multiplyVec3(this.viewToWorldNT, upp);
			var xb = upp[0];
			var yb = upp[1];
			var zb = upp[2];

			var t = za / (za - zb);   // t when z = 0

			area[i] = xa + (xb - xa) * t;
			area[i + 1] = ya + (yb - ya) * t;
		}
	};

	/**
	 * Calculates a view frustrum for the shadow map, to make good use of the
	 * available shadow map space. This routine will make use of visibleArea and
	 * shadowWorldToView and will put the result to shadowProjection.
	 */
	MyViewport.prototype._calculateShadowMapFrustrum = function () {
		var swtv = this.shadowWorldToView;
		var va = this.visibleArea;
		var pos = tempVec31;
		var z = 0;   // This will need to be the maximum height of an object a shadow is casted on

		// Essentially, we calculate the bounding box of the four corners of the
		// visible area plus those corners extruded by Z in the coordinate space
		// of the light.

		// TODO: The area given by this routine (as it currenly stands) doesn't
		// take into account shadow casters residing just outside the visible
		// area. They too should be able to cast shadows here.
		//
		// A tighter fit could be achieved by calculating the bounding box of
		// shadow casters instead of visible area.
		//
		// Due to the use of simple (single) shadow map, either shadow map
		// resolution is wasted on far-away objects or near objects will
		// experience terrible shadow aliasing. A technique such as PSSM could
		// fix this.

		var left = 0;
		var right = 0;
		var bottom = 0;
		var top = 0;
		var near = Infinity;
		var far = 0;

		for (var i = 0; i < 2; ++i) {
			for(var j = 0; j < 8; j += 2) {
				pos[0] = va[j] + this.viewX;
				pos[1] = va[j + 1] + this.viewY;
				pos[2] = (i ? z : 0);
				Mat4.multiplyVec3(swtv, pos);

				if (pos[0] < left) {
					left = pos[0];
				}
				if (pos[0] > right) {
					right = pos[0];
				}
				if (pos[1] < bottom) {
					bottom = pos[1];
				}
				if (pos[1] > top) {
					top = pos[1];
				}
				if (-pos[2] < near) {
					near = -pos[2];
				}
				if (-pos[2] > far) {
					far = -pos[2];
				}
			}
		}

		Mat4.ortho(left, right, bottom, top, near, far, this.shadowProjection);
	};

	/**
	 * Returns an array containing all the actors that reside inside the
	 * specified screen coordinate rectangle.
	 * @param {number} x1
	 * @param {number} y1
	 * @param {number} x2
	 * @param {number} y2
	 * @returns {Actor[]}
	 */
	MyViewport.prototype.getActorsInsideScreenRect = function (x1, y1, x2, y2) {
		var eye = tempVec31;
		var topLeft = tempVec32;
		var topRight = tempVec33;
		var bottomRight = tempVec34;
		var bottomLeft = tempVec35;

		var planeTop = tempVec41;
		var planeRight = tempVec42;
		var planeBottom = tempVec43;
		var planeLeft = tempVec44;

		var vtw = this.viewToWorld;
		var z = -1 / Math.tan(this.fov * Math.PI / 360);

		// First calculate the planes that constrain the apparent rectangle

		x1 = 2 / this.height * x1 - this.width / this.height;
		y1 = -2 / this.height * y1 + 1;
		x2 = 2 / this.height * x2 - this.width / this.height;
		y2 = -2 / this.height * y2 + 1;

		Mat4.multiplyVec3(vtw, Vec3.values(0, 0, 0, eye));
		Mat4.multiplyVec3(vtw, Vec3.values(x1, y1, z, topLeft));
		Mat4.multiplyVec3(vtw, Vec3.values(x2, y1, z, topRight));
		Mat4.multiplyVec3(vtw, Vec3.values(x2, y2, z, bottomRight));
		Mat4.multiplyVec3(vtw, Vec3.values(x1, y2, z, bottomLeft));

		Plane.fromPointsVec3(eye, topRight, topLeft, planeTop);
		Plane.fromPointsVec3(eye, bottomRight, topRight, planeRight);
		Plane.fromPointsVec3(eye, bottomLeft, bottomRight, planeBottom);
		Plane.fromPointsVec3(eye, topLeft, bottomLeft, planeLeft);

		// Then loop through actors and find all actors that are on the same
		// side of all the planes

		var result = [];
		for (var i = 0; i < this.game.actors.length; ++i) {
			var actor = this.game.actors[i];
			if (actor.isSelectable()) {
				var x = actor.x >> 10;
				var y = actor.y >> 10;
				if (Plane.pointTest(planeTop, x, y, 0) > 0 &&
						Plane.pointTest(planeRight, x, y, 0) > 0 &&
						Plane.pointTest(planeBottom, x, y, 0) > 0 &&
						Plane.pointTest(planeLeft, x, y, 0) > 0) {
					result.push(actor);
				}
			}
		}
		return result;
	};

	MyViewport.prototype.handleKeyPress = function (key) {
		switch (key) {
			case 'x':
				this.fireWithSelected();
				break;
			case 'u':
				this.createNewUnit();
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

	MyViewport.prototype.createNewUnit = function () {
		// FIXME: For debugging only
		this.game.issueCommand(['AC', {
			'$type': 'tank',
			'id': this.game.nextId(),   // FIXME: This is not going to work at all in networked setting
			'playerId': this.game.localPlayer.publicId,
			'x': this.lastMouseX,
			'y': this.lastMouseY
		}]);
	};

	return MyViewport;

});