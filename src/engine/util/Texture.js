// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/gllib'], function (gllib) {

	// NOTE: Using the texture object assumes that it is safe to change the
	// currently active texture unit 0 and bind texture objects to it when
	// Texture objects are created and/or when WebGL context is restored.

	// Options:
	//
	// - image: The texture data to load (browser-provided Image object)
	//
	// - flip: Flip the Y axis when unpacking image data. Defaults to true.
	//
	// - min_filter: Minifying function to use. One of 'nearest', 'linear',
	//   'nearest_mipmap_nearest', 'linear_mipmap_nearest',
	//   'nearest_mipmap_linear', 'linear_mipmap_linear'. Default is 'linear'.
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
		this._min_filter = opt.min_filter || 'linear';
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

			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, decodeMinFilter(gl, this._min_filter));
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, decodeMagFilter(gl, this._mag_filter));

			gl.bindTexture(gl.TEXTURE_2D, null);
		}, this);
	}

	Texture.load = function (name, req, load, config) {
		req(['engine/util/Image!' + name], function (image) {
			load(new Texture({'image': image}));
		});
	};

	return Texture;

});