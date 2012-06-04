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

define(['engine/util/gllib', 'engine/util/Program!engine/shaders/uivector.vert!engine/shaders/uivector.frag'], function (gllib, vectorProgram) {

	function UIRenderer() {
		this._linePoints = new Float32Array(UIRenderer.LINE_MAX_POINTS);
		this._linePointCount = 0;
		this._visualizations = [];
	}

	UIRenderer.LINE_MAX_POINTS = 1000;

	UIRenderer.positionBuffer = null;

	UIRenderer.tempVec41 = gllib.Vec4.create();
	UIRenderer.tempVec42 = gllib.Vec4.create();
	UIRenderer.tempVec43 = gllib.Vec4.create();
	UIRenderer.tempVec44 = gllib.Vec4.create();

	UIRenderer.tempMat4 = gllib.Mat4.create();

	gllib.needsContext(function (gl) {
		UIRenderer.positionBuffer = gllib.createArrayBuffer(
			UIRenderer.LINE_MAX_POINTS * 4,
			gl.DYNAMIC_DRAW
		);
	}, UIRenderer);

	UIRenderer.prototype.addVisualization = function (type /* ...params */) {
		if (typeof this['visualize' + type] !== 'function') {
			throw new Error('UIRenderer.addVisualization: Unknown type ' + type);
		}
		this._visualizations.push({
			'type': type,
			'params': Array.prototype.slice.call(arguments, 1)
		});
	};

	UIRenderer.prototype.addRectScreen4zw = function (vec1, vec2, vec3, vec4) {
		var lps = this._linePoints;
		var lpc = this._linePointCount;
		if (lpc + 32 > lps.length) {
			// FIXME: Show error in console
			return;
		}
		// Top side
		lps.set(vec1, lpc);
		lps.set(vec2, lpc + 4);
		// Right side
		lps.set(vec2, lpc + 8);
		lps.set(vec3, lpc + 12);
		// Bottom side
		lps.set(vec3, lpc + 16);
		lps.set(vec4, lpc + 20);
		// Left side
		lps.set(vec4, lpc + 24);
		lps.set(vec1, lpc + 28);
		this._linePointCount += 32;
	};

	UIRenderer.prototype.addRectScreen4 = function (viewport, x1, y1, x2, y2, x3, y3, x4, y4) {
		var vec1 = UIRenderer.tempVec41;
		var vec2 = UIRenderer.tempVec42;
		var vec3 = UIRenderer.tempVec43;
		var vec4 = UIRenderer.tempVec44;

		var xr = 2 / viewport.width;
		var yr = -2 / viewport.height;

		vec1[0] = x1*xr - 1;
		vec1[1] = y1*yr + 1;
		vec1[2] = 0;
		vec1[3] = 1;

		vec2[0] = x2*xr - 1;
		vec2[1] = y2*yr + 1;
		vec2[2] = 0;
		vec2[3] = 1;

		vec3[0] = x3*xr - 1;
		vec3[1] = y3*yr + 1;
		vec3[2] = 0;
		vec3[3] = 1;

		vec4[0] = x4*xr - 1;
		vec4[1] = y4*yr + 1;
		vec4[2] = 0;
		vec4[3] = 1;

		this.addRectScreen4zw(vec1, vec2, vec3, vec4);
	};

	UIRenderer.prototype.addRectScreen = function (viewport, x1, y1, x2, y2) {
		this.addRectScreen4(viewport, x1, y1, x2, y1, x2, y2, x1, y2);
	};

	UIRenderer.prototype.addRectModel = function (worldToClip, modelToWorld, w, h) {
		var vec1 = UIRenderer.tempVec41;
		var vec2 = UIRenderer.tempVec42;
		var vec3 = UIRenderer.tempVec43;
		var vec4 = UIRenderer.tempVec44;

		var mat = UIRenderer.tempMat4;

		gllib.Mat4.set(worldToClip, mat);
		gllib.Mat4.multiply(mat, modelToWorld, mat);

		var half_w = w / 2;
		var half_h = h / 2;

		vec1[0] = -half_w;
		vec1[1] = -half_h;
		vec1[2] = 0;
		vec1[3] = 1;
		gllib.Mat4.multiplyVec4(mat, vec1, vec1);

		vec2[0] = half_w;
		vec2[1] = -half_h;
		vec2[2] = 0;
		vec2[3] = 1;
		gllib.Mat4.multiplyVec4(mat, vec2, vec2);

		vec3[0] = half_w;
		vec3[1] = half_h;
		vec3[2] = 0;
		vec3[3] = 1;
		gllib.Mat4.multiplyVec4(mat, vec3, vec3);

		vec4[0] = -half_w;
		vec4[1] = half_h;
		vec4[2] = 0;
		vec4[3] = 1;
		gllib.Mat4.multiplyVec4(mat, vec4, vec4);

		this.addRectScreen4zw(vec1, vec2, vec3, vec4);
	};

	UIRenderer.prototype.addRectWorld = function (worldToClip, x1, y1, x2, y2, z) {
		var vec1 = UIRenderer.tempVec41;
		var vec2 = UIRenderer.tempVec42;
		var vec3 = UIRenderer.tempVec43;
		var vec4 = UIRenderer.tempVec44;

		z = z || 0;

		vec1[0] = x1;
		vec1[1] = y1;
		vec1[2] = z;
		vec1[3] = 1;
		gllib.Mat4.multiplyVec4(worldToClip, vec1, vec1);

		vec2[0] = x2;
		vec2[1] = y1;
		vec2[2] = z;
		vec2[3] = 1;
		gllib.Mat4.multiplyVec4(worldToClip, vec2, vec2);

		vec3[0] = x2;
		vec3[1] = y2;
		vec3[2] = z;
		vec3[3] = 1;
		gllib.Mat4.multiplyVec4(worldToClip, vec3, vec3);

		vec4[0] = x1;
		vec4[1] = y2;
		vec4[2] = z;
		vec4[3] = 1;
		gllib.Mat4.multiplyVec4(worldToClip, vec4, vec4);

		this.addRectScreen4zw(vec1, vec2, vec3, vec4);
	};

	UIRenderer.prototype.addPolyWorld = function (worldToClip, poly, z) {
		var vec1 = UIRenderer.tempVec41;
		var vec2 = UIRenderer.tempVec42;
		var vec3 = UIRenderer.tempVec43;
		var lps = this._linePoints;
		var lpc = this._linePointCount;

		z = z || 0;

		if (poly.length < 2) {
			return;
		}
		if (lpc + poly.length * 8 > lps.length) {
			// FIXME: Show error in console
			return;
		}

		vec1[0] = poly[0];
		vec1[1] = poly[1];
		vec1[2] = z;
		vec1[3] = 1;
		gllib.Mat4.multiplyVec4(worldToClip, vec1, vec1);
		gllib.Mat4.set(vec1, vec2);

		for (var i = 2; i < poly.length; i += 2) {
			vec3[0] = poly[i];
			vec3[1] = poly[i + 1];
			vec3[2] = z;
			vec3[3] = 1;
			gllib.Mat4.multiplyVec4(worldToClip, vec3, vec3);

			lps.set(vec2, lpc);
			lps.set(vec3, lpc + 4);
			lpc += 8;

			gllib.Mat4.set(vec3, vec2);
		}

		lps.set(vec2, lpc);
		lps.set(vec1, lpc + 4);
		lpc += 8;

		this._linePointCount = lpc;
	};

	UIRenderer.prototype.addLineWorld = function (worldToClip, sx, sy, ex, ey, z) {
		var vec1 = UIRenderer.tempVec41;
		var lps = this._linePoints;
		var lpc = this._linePointCount;

		z = z || 0;

		if (lpc + 8 > lps.length) {
			// FIXME: Show error in console
			return;
		}

		vec1[0] = sx;
		vec1[1] = sy;
		vec1[2] = z;
		vec1[3] = 1;
		gllib.Mat4.multiplyVec4(worldToClip, vec1, vec1);
		lps.set(vec1, lpc);

		vec1[0] = ex;
		vec1[1] = ey;
		vec1[2] = z;
		vec1[3] = 1;
		gllib.Mat4.multiplyVec4(worldToClip, vec1, vec1);
		lps.set(vec1, lpc + 4);

		this._linePointCount = lpc + 8;
	};

	UIRenderer.prototype.draw = function (gl) {
		for (var i = 0; i < this._visualizations.length; ++i) {
			var vis = this._visualizations[i];
			this['visualize' + vis.type].apply(this, vis.params);
		}

		// Cache all relevant variables
		var lps = this._linePoints;
		var lpc = this._linePointCount;
		var positionBuffer = UIRenderer.positionBuffer;

		// Line rendering pass
		if (lpc) {
			gl.useProgram(vectorProgram.program);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.DST_COLOR);
			gl.enableVertexAttribArray(vectorProgram.vertexPosition);
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, lps);
			gl.vertexAttribPointer(vectorProgram.vertexPosition, 4, gl.FLOAT, false, 0, 0);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);

			gl.vertexAttrib4f(vectorProgram.fillColor, 0, 1, 1, 1);

			gl.drawArrays(gl.LINES, 0, lpc / 4);

			gl.disableVertexAttribArray(vectorProgram.vertexPosition);
			gl.disable(gl.BLEND);
			gl.useProgram(null);
			this._linePointCount = 0;
		}
	};

	UIRenderer.prototype.visualizePlaneGroundIntersection = function (viewport /* ...planes */) {
		for (var i = 1; i < arguments.length; ++i) {
			var plane = arguments[i];
			if (Math.abs(plane[0]) > Math.abs(plane[1])) {
				this.addPolyWorld(viewport.worldToClip, [
					gllib.Plane.getX(plane, 0, 0), 0,
					gllib.Plane.getX(plane, viewport.game.fieldHeight, 0), viewport.game.fieldHeight
				]);
			} else {
				this.addPolyWorld(viewport.worldToClip, [
					0, gllib.Plane.getY(plane, 0, 0),
					viewport.game.fieldWidth, gllib.Plane.getY(plane, viewport.game.fieldWidth, 0)
				]);
			}
		}
	};

	return UIRenderer;

});