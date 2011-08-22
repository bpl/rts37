// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/gllib', 'engine/util/Program!engine/shaders/uisprite.vert!engine/shaders/uisprite.frag'], function (gllib, quadProgram) {

	// NOTE: Using the texture object assumes that it is safe to change the
	// currently active texture unit 0 and bind texture objects to it when
	// Texture objects are created and/or when WebGL context is restored.

	// Options:
	//
	// - image: The texture data to load (browser-provided Image object)
	//
	// - flip: Flip the Y axis when unpacking image data. Defaults to true.
	//
	// - mipmap: Generate a mipmap for the texture. Defaults to true.
	//
	// - min_filter: Minifying function to use. One of 'nearest', 'linear',
	//   'nearest_mipmap_nearest', 'linear_mipmap_nearest',
	//   'nearest_mipmap_linear', 'linear_mipmap_linear'. Default is
	//   'nearest_mipmap_linear'.
	//
	// - mag_filter: Magnifying function to use. Either 'nearest' or 'linear'.
	//   Default is 'linear'.
	//
	// Please see http://www.khronos.org/opengles/sdk/docs/man/xhtml/glTexParameter.xml
	// for information about min_filter and mag_filter values.

	function decodeMinFilter(gl, value) {
		switch (value) {
			case 'nearest': return gl.NEAREST;
			case 'linear': return gl.LINEAR;
			case 'nearest_mipmap_nearest': return gl.NEAREST_MIPMAP_NEAREST;
			case 'linear_mipmap_nearest': return gl.LINEAR_MIPMAP_NEAREST;
			case 'nearest_mipmap_linear': return gl.NEAREST_MIPMAP_LINEAR;
			case 'linear_mipmap_linear': return gl.LINEAR_MIPMAP_LINEAR;
		}
		throw new Error('decodeMinFilter: Unknown value ' + value);
	}

	function decodeMagFilter(gl, value) {
		switch (value) {
			case 'nearest': return gl.NEAREST;
			case 'linear': return gl.LINEAR;
		}
		throw new Error('decodeMagFilter: Unknown value ' + value);
	}

	function Texture(opt) {
		this.texture = null;

		this._image = opt.image || null;
		this._flip = 'flip' in opt ? opt.flip : true;
		this._mipmap = 'mipmap' in opt ? opt.mipmap : true;
		this._min_filter = opt.min_filter || 'nearest_mipmap_linear';
		this._mag_filter = opt.mag_filter || 'linear';

		gllib.needsContext(function (gl) {
			this.texture = gl.createTexture();

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.texture);

			if (this._image) {
				// Load texture data from image
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this._flip);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
			} else {
				throw new Error('Texture: Unknown texture type');
			}

			if (this._mipmap) {
				gl.generateMipmap(gl.TEXTURE_2D);
			}

			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, decodeMinFilter(gl, this._min_filter));
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, decodeMagFilter(gl, this._mag_filter));

			gl.bindTexture(gl.TEXTURE_2D, null);
		}, this);
	}

	Texture._vertexBuffer = null;

	Texture.load = function (name, req, load, config) {
		req(['engine/util/Image!' + name], function (image) {
			load(new Texture({'image': image}));
		});
	};

	gllib.needsContext(function (gl) {
		this._vertexBuffer = gllib.createArrayBuffer(new Float32Array([
		//   X,  Y, S, T
			-1, -1, 0, 0,
			-1,  1, 0, 1,
			 1, -1, 1, 0,
			 1,  1, 1, 1
		]));
	}, Texture);

	Texture.prototype.drawQuad = function (gl) {
		var vertexBuffer = Texture._vertexBuffer;
		var program = quadProgram;

		gl.useProgram(program.program);
		gl.enableVertexAttribArray(program.vertexPosition);
		gl.enableVertexAttribArray(program.vertexTexCoord);
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		gl.vertexAttribPointer(program.vertexPosition, 2, gl.FLOAT, false, 4 * 4, 0);
		gl.vertexAttribPointer(program.vertexTexCoord, 2, gl.FLOAT, false, 4 * 4, 4 * 2);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.uniform1i(program.spriteTexture, 0);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, null);

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.disableVertexAttribArray(program.vertexNormal);
		gl.disableVertexAttribArray(program.vertexTexCoord);
		gl.useProgram(null);
	};

	return Texture;

});