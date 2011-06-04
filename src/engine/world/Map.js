// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/webgllib'], function (webgllib) {

	// The map consists of square blocks of square tiles. One pixel in the
	// source image corresponds to one tile in the map. Block contains the
	// OpenGL buffers necessary to render that particular section of terrain.

	// The width and height of a block in tiles
	var BLOCK_SIZE = 16;

	// To represent BLOCK_SIZE tiles, we need BLOCK_SIZE + 1 vertices per dimension
	var BLOCK_VERTICES = BLOCK_SIZE + 16;

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

		this._widthInBlocks = this.width / BLOCK_SIZE + 0.5 | 0;
		this._heightInBlocks = this.height / BLOCK_SIZE + 0.5 | 0;

		// The red channel of the source image specifies the height value for
		// the top left corner of the tile.
		this._heightMap = this._generateHeightMap(image);

		this._blocks = null;
	}

	Map.commonVertexBuffer = null;

	Map.commonIndexBuffer = null;

	// FIXME: These need to be regenerated if the WebGL context is lost
	Map._generateCommonBuffers = function (gl) {
		// Common vertex buffer will contain X and Y coordinates of the top left
		// corners of the map tiles in row-major order. Common index buffer will
		// index into this in zig-zag fashion to produce a regular lattice mesh.
		// Z coordinates will be supplied by individual map tiles.
		var buf, arr, idx;

		// Generate vertex buffer
		if (Map.commonVertexBuffer) {
			buf = Map.commonVertexBuffer;
			Map.commonVertexBuffer = null;
			gl.deleteBuffer(buf);
		}
		arr = new Float32Array(BLOCK_VERTICES * BLOCK_VERTICES * 2);
		idx = 0;
		for (var y = 0; y < BLOCK_VERTICES; ++y) {
			for (var x = 0; x < BLOCK_VERTICES; ++x) {
				arr[idx++] = x;
				arr[idx++] = y;
			}
		}
		Map.commonVertexBuffer = webgllib.createArrayBuffer(gl, arr);

		// Generate index buffer
		if (Map.commonIndexBuffer) {
			buf = Map.commonIndexBuffer;
			Map.commonIndexBuffer = null;
			gl.deleteBuffer(buf);
		}
		arr = new Float16Array(BLOCK_SIZE * BLOCK_SIZE * 6);
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
		Map.commonIndexBuffer = webgllib.createElementArrayBuffer(gl, arr);
	};

	Map.prototype._generateHeightMap = function (image) {
		var pixelData = image.getPixelData();
		var result = new Int8Array(this.width * this.height);
		for (var i = 0; i < result.length; ++i) {
			result[i] = pixelData[i * 4];   // Red channel
		}
		return result;
	};

	// FIXME: These need to be regenerated if the WebGL context is lost
	Map.prototype._generateBlocks = function (gl) {
		var result = [];
		for (var by = 0; by < this._heightInBlocks; ++by) {
			var row = [];
			result.push(row);
			for (var bx = 0; bx < this._widthInBlocks; ++bx) {
				row.push(this._generateBlock(gl, bx, by));
			}
		}
	};

	Map.prototype._generateBlock = function (gl, bx, by) {
		// TODO: Don't recreate this every time a block is generated
		var arr = new Float32Array(BLOCK_VERTICES * BLOCK_VERTICES);
		// Sample the height map to generate a block
		var idx = 0;
		for (var y = 0; y < BLOCK_VERTICES; ++y) {
			for (var x = 0; x < BLOCK_VERTICES; ++x) {
				var mapX = bx * BLOCK_SIZE + x;
				var mapY = by * BLOCK_SIZE + y;
				if (mapX < this.width && mapY < this.height) {
					arr[idx++] = this._heightMap[mapY * this.width + mapX] - Z_BASE_LEVEL;
				} else {
					arr[idx++] = 0;
				}
			}
		}
		return arr;
	};

	// A safe but slow routine to get the height value of a tile on the map on
	// the certain world coordinates.
	Map.prototype.getHeightAt = function (x, y) {
		x = (x >> 10) / TILE_SIZE | 0;
		y = (y >> 10) / TILE_SIZE | 0;
		if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
			return this._heightMap[y * this.width + x];
		}
		return -1;
	};

	// A safe but slow routine to determine if a tile is passable to normal units
	Map.prototype.isPassable = function (x, y) {
		x = (x >> 10) / TILE_SIZE | 0;
		y = (y >> 10) / TILE_SIZE | 0;
		if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
			return (this._heightMap[y * this.width + x] === Z_BASE_LEVEL);
		}
		return false;
	};

	Map.prototype.draw = function (gl, client, viewport) {
		// FIXME: Actually draw a height map using WebGL
		ctx.save();
		ctx.fillStyle = '#090';
		var baseIndex = 0;          // Where the current row starts
		var index = 0;              // Where are we now
		var height = this.height;   // Cache reference
		var width = this.width;     // Cache reference
		var tiles = this.tiles;     // Cache reference
		var realWidth = this.realWidth;   // Cache reference
		var tileSize = this.tileSize;     // Cache reference
		for (var y = 0; y < height; ++y, baseIndex += realWidth) {
			index = baseIndex;
			for (var x = 0; x < width; ++x, ++index) {
				if (tiles[index] == 1) {
					ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
				}
			}
		}
		ctx.restore();
	};

	return Map;

});