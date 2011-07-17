// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/gllib', 'engine/util/Program!engine/shaders/terrain.vert!engine/shaders/terrain.frag'], function (gllib, shaderProgram) {

	// The map consists of square blocks of square tiles. One pixel in the
	// source image corresponds to one tile in the map. Block contains the
	// OpenGL buffers necessary to render that particular section of terrain.

	// The width and height of a block in tiles
	var BLOCK_SIZE = 16;

	// To represent BLOCK_SIZE tiles, we need BLOCK_SIZE + 1 vertices per dimension
	var BLOCK_VERTICES = BLOCK_SIZE + 1;

	// The width and height of a tile in world coordinates
	var TILE_SIZE = 16;

	// The height map value when z = 0
	var Z_BASE_LEVEL = 64;

	function Map(image) {
		assert(image && 'getPixelData' in image, 'Map: must be able to get pixels from image');

		this.width = +image.width | 0;
		this.height = +image.height | 0;
		assert(this.width > 0, 'Map: width must be a positive integer');
		assert(this.height > 0, 'Map: height must be a positive integer');

		this.tileSize = TILE_SIZE;

		this._widthInBlocks = Math.ceil(this.width / BLOCK_SIZE);
		this._heightInBlocks = Math.ceil(this.height / BLOCK_SIZE);

		// The red channel of the source image specifies the height value for
		// the top left corner of the tile.
		this._heightMap = this._generateHeightMap(image);

		this._blocks = null;

		gllib.needsContext(function (gl) {
			this._blocks = this._generateBlocks(gl);
		}, this);
	}

	Map.commonIndexBuffer = null;

	gllib.needsContext(function (gl) {
		// Common index buffer will index into the map tiles in zig-zag fashion
		// to produce a regular lattice mesh.
		var buf, arr, idx;
		// Generate index buffer
		arr = new Int16Array(BLOCK_SIZE * BLOCK_SIZE * 6);
		idx = 0;
		for (var y = 0; y < BLOCK_SIZE; ++y) {
			for (var x = 0; x < BLOCK_SIZE; ++x) {
				// Top left triangle
				arr[idx++] = y * BLOCK_VERTICES + x;
				arr[idx++] = y * BLOCK_VERTICES + (x + 1);
				arr[idx++] = (y + 1) * BLOCK_VERTICES + x;
				// Bottom right triangle
				arr[idx++] = (y + 1) * BLOCK_VERTICES + x;
				arr[idx++] = y * BLOCK_VERTICES + (x + 1);
				arr[idx++] = (y + 1) * BLOCK_VERTICES + (x + 1);
			}
		}
		Map.commonIndexBuffer = gllib.createElementArrayBuffer(arr);
	}, Map);

	Map.prototype._generateHeightMap = function (image) {
		var pixelData = image.getPixelData();
		var result = new Int8Array(this.width * this.height);
		for (var i = 0; i < result.length; ++i) {
			result[i] = pixelData[i * 4];   // Red channel
		}
		return result;
	};

	Map.prototype._generateBlocks = function (gl) {
		var result = [];
		for (var by = 0; by < this._heightInBlocks; ++by) {
			var row = [];
			result.push(row);
			for (var bx = 0; bx < this._widthInBlocks; ++bx) {
				row.push(this._generateBlock(gl, bx, by));
			}
		}
		return result;
	};

	Map.prototype._sampleMap = function (mapX, mapY) {
		if (mapX < 0 || mapY < 0) {
			return 0;
		} else if (mapX < this.width && mapY < this.height) {
			return this._heightMap[mapY * this.width + mapX] - Z_BASE_LEVEL;
		} else if ((mapX === this.width && mapY <= this.height)
				|| (mapY === this.height && mapX <= this.width)) {
			return 0;
		} else {
			return -10;
		}
	};

	Map.prototype._generateBlock = function (gl, bx, by) {
		// TODO: Don't recreate this every time a block is generated
		var arr = new Float32Array(BLOCK_VERTICES * BLOCK_VERTICES * 6);

		// Sample the height map to generate a block
		var idx = 0;
		for (var y = 0; y < BLOCK_VERTICES; ++y) {
			for (var x = 0; x < BLOCK_VERTICES; ++x) {
				// X and Y vertex position
				arr[idx++] = x * TILE_SIZE;
				arr[idx++] = y * TILE_SIZE;

				// Z vertex position
				var mapX = bx * BLOCK_SIZE + x;
				var mapY = by * BLOCK_SIZE + y;
				arr[idx++] = this._sampleMap(mapX, mapY);

				// Approximate vertex normal
				var xdn = this._sampleMap(mapX - 1, mapY) - this._sampleMap(mapX + 1, mapY);
				var ydn = this._sampleMap(mapX, mapY - 1) - this._sampleMap(mapX, mapY + 1);
				var zdn = TILE_SIZE * 4;
				var length_i = 1 / Math.sqrt(xdn * xdn + ydn * ydn + zdn * zdn);

				arr[idx++] = xdn * length_i;
				arr[idx++] = ydn * length_i;
				arr[idx++] = zdn * length_i;
			}
		}
		return gllib.createArrayBuffer(arr);
	};

	// A safe but slow routine to get the height value of a tile on the map on
	// the certain world coordinates.
	Map.prototype.getHeightAt = function (x, y) {
		if (x >= 0 && x < this.width * TILE_SIZE << 10 && y >= 0 && y < this.height * TILE_SIZE << 10) {
			x = (x >> 10) / TILE_SIZE | 0;
			y = (y >> 10) / TILE_SIZE | 0;
			return this._heightMap[y * this.width + x];
		}
		return -1;
	};

	// A safe but slow routine to determine if a tile is passable to normal units
	Map.prototype.isPassable = function (x, y) {
		if (x >= 0 && x < this.width * TILE_SIZE << 10 && y >= 0 && y < this.height * TILE_SIZE << 10) {
			x = (x >> 10) / TILE_SIZE | 0;
			y = (y >> 10) / TILE_SIZE | 0;
			return (this._heightMap[y * this.width + x] === Z_BASE_LEVEL);
		}
		return false;
	};

	Map.prototype.draw = function (gl, client, viewport) {
		var commonIndexBuffer = Map.commonIndexBuffer;
		var blocks = this._blocks;
		var program = shaderProgram;

		gl.useProgram(program.program);
		gl.enableVertexAttribArray(program.vertexPosition);
		gl.enableVertexAttribArray(program.vertexNormal);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, commonIndexBuffer);

		gl.uniform1f(program.tileSize, TILE_SIZE);
		gl.uniformMatrix4fv(program.worldToView, false, viewport.worldToView);
		gl.uniformMatrix4fv(program.projection, false, viewport.projection);
		gl.uniform4fv(program.sunLight, viewport.sunLightView);

		for (var y = 0; y < this._heightInBlocks; ++y) {
			for (var x = 0; x < this._widthInBlocks; ++x) {
				gl.bindBuffer(gl.ARRAY_BUFFER, blocks[y][x]);
				gl.vertexAttribPointer(program.vertexPosition, 3, gl.FLOAT, false, 4 * 6, 0);
				gl.vertexAttribPointer(program.vertexNormal, 3, gl.FLOAT, false, 4 * 6, 4 * 3);

				gl.uniform2f(
					program.blockPosition,
					x * BLOCK_SIZE * TILE_SIZE,
					y * BLOCK_SIZE * TILE_SIZE
				);

				gl.drawElements(gl.TRIANGLES, BLOCK_SIZE * BLOCK_SIZE * 6, gl.UNSIGNED_SHORT, 0);
			}
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
		gl.disableVertexAttribArray(program.vertexNormal);
		gl.disableVertexAttribArray(program.vertexPosition);
		gl.useProgram(null);
	};

	return Map;

});