// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/gllib', 'engine/util/Texture', 'engine/util/Program!engine/shaders/billboard.frag!engine/shaders/billboard.vert'], function (gllib, Texture, shaderProgram) {

	// Billboards are used here for ephemeral animated decorations such as
	// explosions and smoke. Billboard objects are managers of that type of
	// billboard instead of actual billboard instances.
	//
	// Options:
	// - image: Image object to use as the texture. Required.
	// - lifetime: Billboard instance lifetime in msecs.
	// - blending: Blending mode, as below. Defaults to 'replace'.
	// - framesAcross: How many animation frames are there per row in the
	//   image. Default is 1.
	// - numFrames: How animation frames are there in the image in total.
	//   Default is 1.
	// - minAlpha: The minimum alpha value to fade to. Default is 0.
	// - scaleFactor: Extent of the billboard in world units. The actual width
	//   and height will be scaleFactor * 2.
	//
	// Options will also be passed to the Texture constructor as-is. Please see
	// Texture source file for information about applicable options.
	//
	// Supported blending modes:
	// - replace: Replace existing fragment with the new fragment. The default.
	// - additive: Add color values from the new fragment to the existing one.
	function Billboard(opt) {
		this.lifetime = opt.lifetime || 1000;
		this.blending = opt.blending || 'replace';
		this.framesAcross = opt.framesAcross || 1;
		this.numFrames = opt.numFrames || 1;
		this.minAlpha = opt.minAlpha || 0;
		this.scaleFactor = opt.scaleFactor || 50;

		this._count = 0;
		this._texture = new Texture(opt);
		this._variableArray = new Float32Array(Billboard.CAPACITY * Billboard.VARIABLE_SIZE);

		Billboard._billboards.push(this);
	}

	// Display at most this many billboards. If depleted, purge starting from
	// the oldest one.
	Billboard.CAPACITY = 100;

	// Each billboard needs two triangles. The varying part contains the
	// coordinates and the amount of time the billboard has been alive so far.
	Billboard.VARIABLE_SIZE = 6 * 4;

	// List of all billboards (billboard managers) for drawing
	Billboard._billboards = [];

	Billboard._constantBuffer = null;

	Billboard._variableBuffer = null;

	Billboard._tempRight = gllib.Vec3.create();
	Billboard._tempUp = gllib.Vec3.create();
	Billboard._tempLook = gllib.Vec3.create();

	Billboard.draw = function (gl, client, viewport) {
		var arr = this._billboards;
		for (var i = 0; i < arr.length; ++i) {
			arr[i].draw(gl, client, viewport);
		}
	};

	gllib.needsContext(function (gl) {
		var vertices = [
			// One half
			-1, -1,   1, -1,   -1, 1,
			// Second half
			-1, 1,   1, -1,   1, 1
		];
		var arr = new Float32Array(Billboard.CAPACITY * vertices.length);
		var pos = 0;
		for (var i = 0; i < Billboard.CAPACITY; ++i) {
			for (var j = 0; j < vertices.length; ++j) {
				arr[pos++] = vertices[j];
			}
		}
		Billboard._constantBuffer = gllib.createArrayBuffer(arr);
		Billboard._variableBuffer = gllib.createArrayBuffer(Billboard.CAPACITY * Billboard.VARIABLE_SIZE * 4);
	}, Billboard);

	Billboard.prototype.add = function (worldX, worldY, worldZ) {
		if (this._count >= Billboard.CAPACITY) {
			return;
		}

		var pos = this._count * Billboard.VARIABLE_SIZE;
		var va = this._variableArray;

		for (var i = 0; i < 6; ++i) {
			va[pos++] = worldX / 1024;
			va[pos++] = worldY / 1024;
			va[pos++] = worldZ / 1024;
			va[pos++] = 0;
		}

		++this._count;
	};

	Billboard.prototype.draw = function (gl, client, viewport) {
		if (!this._count) {
			return;
		}

		// Cull the variable array
		var va = this._variableArray;
		var msecsSinceDrawn = client.msecsSinceDrawn;
		var pos = 0;
		var oldPos = 0;
		var count = 0;
		for (var i = 0; i < this._count * 6; ++i) {
			va[oldPos + 3] += msecsSinceDrawn;
			if (va[oldPos + 3] <= this.lifetime) {
				if (oldPos !== pos) {
					va[pos] = va[oldPos];
					va[pos + 1] = va[oldPos + 1];
					va[pos + 2] = va[oldPos + 2];
					va[pos + 3] = va[oldPos + 3];
				}
				pos += 4;
				++count;
			}
			oldPos += 4;
		}
		count = count / 6;
		this._count = count;

		if (!count) {
			return;
		}

		// Cache some further variables
		var wtv = viewport.worldToView;
		var right = Billboard._tempRight;
		var up = Billboard._tempUp;
		var look = Billboard._tempLook;

		var constantBuffer = Billboard._constantBuffer;
		var variableBuffer = Billboard._variableBuffer;
		var program = shaderProgram;

		// Calculate the transformation
		//
		// 3D math is based on NeHe billboarding tutorial:
		// http://nehe.gamedev.net/data/articles/article.asp?article=19

		up[0] = wtv[4];
		up[1] = wtv[5];
		up[2] = wtv[6];

		look[0] = -wtv[8];
		look[1] = -wtv[9];
		look[2] = -wtv[10];

		gllib.Vec3.cross(up, look, right);

		// Do the drawing
		gl.useProgram(program.program);
		gl.depthMask(false);
		gl.enable(gl.BLEND);
		switch (this.blending) {
			case 'replace': gl.blendFunc(gl.ONE, gl.ZERO); break;
			case 'additive': gl.blendFunc(gl.SRC_ALPHA, gl.ONE); break;
			default: throw new Error('Billboard.draw: Unknown blending mode ' + this.blending);
		}
		gl.enableVertexAttribArray(program.anchorPosition);
		gl.enableVertexAttribArray(program.msecsLive);
		gl.enableVertexAttribArray(program.deltaPosition);
		gl.bindBuffer(gl.ARRAY_BUFFER, variableBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, va);
		gl.vertexAttribPointer(program.anchorPosition, 3, gl.FLOAT, false, 4 * 4, 0);
		gl.vertexAttribPointer(program.msecsLive, 1, gl.FLOAT, false, 4 * 4, 3 * 4);
		gl.bindBuffer(gl.ARRAY_BUFFER, constantBuffer);
		gl.vertexAttribPointer(program.deltaPosition, 2, gl.FLOAT, false, 0, 0);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._texture.texture);
		gl.uniform1i(program.fillTexture, 0);

		gl.uniformMatrix4fv(program.worldToView, false, wtv);
		gl.uniformMatrix4fv(program.projection, false, viewport.projection);
		gl.uniform3fv(program.modelToWorldRight, right);
		gl.uniform3fv(program.modelToWorldUp, up);
		gl.uniform3fv(program.modelToWorldLook, look);
		gl.uniform1f(program.lifetime, this.lifetime);
		gl.uniform1f(program.scaleFactor, this.scaleFactor);
		gl.uniform1f(program.framesAcross, this.framesAcross);
		gl.uniform1f(program.numFrames, this.numFrames);
		gl.uniform1f(program.minAlpha, this.minAlpha);

		gl.drawArrays(gl.TRIANGLES, 0, count * 6);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, null);

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.disableVertexAttribArray(program.deltaPosition);
		gl.disableVertexAttribArray(program.msecsLive);
		gl.disableVertexAttribArray(program.anchorPosition);
		gl.disable(gl.BLEND);
		gl.depthMask(true);
		gl.useProgram(null);
	};

	return Billboard;

});