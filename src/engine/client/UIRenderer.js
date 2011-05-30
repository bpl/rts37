// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['dep/glmatrix/glmatrix', 'engine/util/Program', 'engine/util/Shader!engine/shaders/uivector.vert', 'engine/util/Shader!engine/shaders/uivector.frag'], function (glmatrix, Program, vectorVertexShader, vectorFragmentShader) {

	function UIRenderer() {
		this._linePoints = new Float32Array(UIRenderer.LINE_MAX_POINTS);
		this._linePointCount = 0;
	}

	UIRenderer.LINE_MAX_POINTS = 1000;

	UIRenderer.positionBuffer = null;

	UIRenderer.vectorProgram = new Program(vectorVertexShader, vectorFragmentShader);

	UIRenderer.tempVec3 = glmatrix.Vec3.create();

	UIRenderer.tempMat4 = glmatrix.Mat4.create();

	UIRenderer.prototype.addRectScreen4 = function (x1, y1, x2, y2, x3, y3, x4, y4) {
		var lps = this._linePoints;
		var lpc = this._linePointCount;
		if (lpc + 16 > lps.length) {
			// FIXME: Show error in console
			return;
		}
		// Top side
		lps[lpc] = x1;
		lps[lpc + 1] = y1;
		lps[lpc + 2] = x2;
		lps[lpc + 3] = y2;
		// Right side
		lps[lpc + 4] = x2;
		lps[lpc + 5] = y2;
		lps[lpc + 6] = x3;
		lps[lpc + 7] = y3;
		// Bottom side
		lps[lpc + 8] = x3;
		lps[lpc + 9] = y3;
		lps[lpc + 10] = x4;
		lps[lpc + 11] = y4;
		// Left side
		lps[lpc + 12] = x4;
		lps[lpc + 13] = y4;
		lps[lpc + 14] = x1;
		lps[lpc + 15] = y1;
		this._linePointCount += 16;
	};

	UIRenderer.prototype.addRectScreen = function (x1, y1, x2, y2) {
		this.addRectScreen4(x1, y1, x2, y1, x2, y2, x1, y2);
	};

	UIRenderer.prototype.addRectModel = function (worldToClip, modelToWorld, w, h) {
		var vec = UIRenderer.tempVec3;
		var mat = UIRenderer.tempMat4;

		glmatrix.Mat4.set(worldToClip, mat);
		glmatrix.Mat4.multiply(mat, modelToWorld, mat);

		var half_w = w / 2;
		var half_h = h / 2;

		vec[0] = -half_w;
		vec[1] = -half_h;
		vec[2] = 0;
		glmatrix.Mat4.multiplyVec3(mat, vec, vec);
		var x1 = vec[0];
		var y1 = vec[1];

		vec[0] = half_w;
		vec[1] = -half_h;
		vec[2] = 0;
		glmatrix.Mat4.multiplyVec3(mat, vec, vec);
		var x2 = vec[0];
		var y2 = vec[1];

		vec[0] = half_w;
		vec[1] = half_h;
		vec[2] = 0;
		glmatrix.Mat4.multiplyVec3(mat, vec, vec);
		var x3 = vec[0];
		var y3 = vec[1];

		vec[0] = -half_w;
		vec[1] = half_h;
		vec[2] = 0;
		glmatrix.Mat4.multiplyVec3(mat, vec, vec);
		var x4 = vec[0];
		var y4 = vec[1];

		this.addRectScreen4(x1, y1, x2, y2, x3, y3, x4, y4);
	};

	UIRenderer.prototype.addRectWorld = function (worldToClip, x1, y1, x2, y2) {
		var vec = UIRenderer.tempVec3;

		vec[0] = x1;
		vec[1] = y1;
		vec[2] = 0;
		glmatrix.Mat4.multiplyVec3(worldToClip, vec, vec);
		var nx1 = vec[0];
		var ny1 = vec[1];

		vec[0] = x2;
		vec[1] = y1;
		vec[2] = 0;
		glmatrix.Mat4.multiplyVec3(worldToClip, vec, vec);
		var nx2 = vec[0];
		var ny2 = vec[1];

		vec[0] = x2;
		vec[1] = y2;
		vec[2] = 0;
		glmatrix.Mat4.multiplyVec3(worldToClip, vec, vec);
		var nx3 = vec[0];
		var ny3 = vec[1];

		vec[0] = x1;
		vec[1] = y2;
		vec[2] = 0;
		glmatrix.Mat4.multiplyVec3(worldToClip, vec, vec);
		var nx4 = vec[0];
		var ny4 = vec[1];

		this.addRectScreen4(nx1, ny1, nx2, ny2, nx3, ny3, nx4, ny4);
	};

	UIRenderer.prototype.draw = function (gl) {
		// Cache all relevant variables
		var lps = this._linePoints;
		var lpc = this._linePointCount;
		var vectorProgram = UIRenderer.vectorProgram;

		// FIXME: Put this somewhere else. This must be recreated if the WebGL
		// context is lost.
		var positionBuffer = UIRenderer.positionBuffer;
		if (!positionBuffer) {
			positionBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, lps, gl.DYNAMIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			UIRenderer.positionBuffer = positionBuffer;
		}

		// Line rendering pass
		if (lpc) {
			gl.useProgram(vectorProgram.prepare(gl));
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.DST_COLOR);
			gl.enableVertexAttribArray(vectorProgram.vertexPosition);
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, lps);
			gl.vertexAttribPointer(vectorProgram.vertexPosition, 2, gl.FLOAT, false, 0, 0);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);

			gl.vertexAttrib4f(vectorProgram.fillColor, 0, 1, 1, 0.3);

			gl.drawArrays(gl.LINES, 0, lpc);

			gl.disableVertexAttribArray(vectorProgram.vertexPosition);
			gl.disable(gl.BLEND);
			gl.useProgram(null);
			this._linePointCount = 0;
		}
	};

	return UIRenderer;

});