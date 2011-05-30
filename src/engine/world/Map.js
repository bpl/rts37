define(function () {

	function Map(width, height, tileSize) {
		assert(width > 0 && width % 1 == 0, 'Map: width must be a positive integer');
		assert(height > 0 && height % 1 == 0, 'Map: height must be a positive integer');
		this.tiles = [];
		this.width = width;
		this.height = height;
		this.tileSize = tileSize;
		this.widthShift = 0;
		while (1 << this.widthShift < this.width) {
			++this.widthShift;
		}
		this.realWidth = 1 << this.widthShift;
		this.tileCount = this.realWidth * this.height;
		for (var i = 0; i < this.tileCount; ++i) {
			this.tiles.push(0);
		}
	}

	// A safe but slow routine to set the value of a tile on the map
	Map.prototype.setTile = function (x, y, value) {
		assert(x >= 0 && x < this.width, 'Map.setTile: x out of bounds');
		assert(y >= 0 && y < this.height, 'Map.setTile: y out of bounds');
		this.tiles[x + (y << this.widthShift)] = value;
	};

	// A safe but slow routine to get the value of a tile on the map
	Map.prototype.getTile = function (x, y) {
		if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
			return this.tiles[x + (y << this.widthShift)];
		}
		return -1;
	};

	// A safe but slow routine to get the value of a tile on the map on the certain
	// world coordinates.
	Map.prototype.getTileAt = function (x, y) {
		x = Math.floor((x >> 10) / this.tileSize);
		y = Math.floor((y >> 10) / this.tileSize);
		if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
			return this.tiles[x + (y << this.widthShift)];
		}
		return -1;
	};

	Map.prototype.draw = function (ctx, uiCtx, factor) {
		// FIXME: Have this actually draw map tiles instead of green rectangles
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