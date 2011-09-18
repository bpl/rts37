// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(function () {

	// The code assumes that there will be at most (safety factor) * (maximum
	// ball count) feet. Safety factor of four provides full safety if the
	// maximum diameter of a ball is less than or equal to the smaller dimension
	// of a tile.
	const SAFETY_FACTOR = 4;

	const INDEX_BIT_COUNT = 16;
	const INDEX_BIT_MASK = ~(-1 << INDEX_BIT_COUNT);

	function log2(n) {
		return Math.log(n) / Math.LN2;
	}

	function TiledCollisionContext(width, height, tileWidth, tileHeight, maxBallCount) {
		this.width = width;
		this.height = height;
		this.tileWidth = tileWidth;
		this.tileHeight = tileHeight;

		this._tileXShift = Math.round(log2(tileWidth));
		this._tileYShift = Math.round(log2(tileHeight));

		assert(this._tileXShift >= 0, 'TiledCollisionContext: Tile width must be a power-of-two >= 1');
		assert(this._tileYShift >= 0, 'TiledCollisionContext: Tile height must be a power-of-two >= 1');

		this.tileXCount = Math.ceil(width / tileWidth);
		this.tileYCount = Math.ceil(height / tileHeight);
		this._tileCount = this.tileXCount * this.tileYCount;

		assert(this._tileCount < 32768, 'TiledCollisionContext: Too many tiles. Tiles X * Tiles Y must be below 32768');

		this._footCounts = new Uint16Array(this._tileCount);
		this._tileIndices = new Uint16Array(this._tileCount + 1);

		assert(maxBallCount < 65536, 'TiledCollisionContext: Too many balls. Maximum ball count must be below 65536');

		this._unsortedFeet = new Int32Array(maxBallCount * 4 * SAFETY_FACTOR);
		this._feetByTile = new Int32Array(maxBallCount * 4 * SAFETY_FACTOR);

		this._ballCount = 0;
		this._footTotal = 0;
	}

	TiledCollisionContext.prototype.sortIntoTiles = function (balls, ballCount) {
		const TILE_X_COUNT = this.tileXCount;
		const TILE_Y_COUNT = this.tileYCount;
		const TILE_COUNT = this._tileCount;

		const LAST_TILE_X = TILE_X_COUNT - 1;
		const LAST_TILE_Y = TILE_Y_COUNT - 1;

		const TILE_X_SHIFT = this._tileXShift;
		const TILE_Y_SHIFT = this._tileYShift;

		const CONTEXT_WIDTH = TILE_X_COUNT * this.tileWidth;
		const CONTEXT_HEIGHT = TILE_Y_COUNT * this.tileHeight;

		var footCounts = this._footCounts;
		var tileIndices = this._tileIndices;
		var unsortedFeet = this._unsortedFeet;
		var feetByTile = this._feetByTile;

		// Reset the count buckets
		for (var i = 0; i < TILE_COUNT; ++i) {
			footCounts[i] = 0;
		}

		// Construct the unsorted foot array
		var idx = 0;
		for (var i = 0; i < ballCount; ++i) {
			var ball = balls[i];

			var br = ball.radius;
			var bx = ball.x - br;
			var by = ball.y - br;
			var bs = br + br;
			var brx = bx + bs;
			var bby = by + bs;

			var tileX = (
				bx < 0 ? 0 :
				bx >= CONTEXT_WIDTH ? LAST_TILE_X :
				bx >> TILE_X_SHIFT
			);
			var lastTileX = (
				brx < 0 ? 0 :
				brx >= CONTEXT_WIDTH ? LAST_TILE_X :
				brx >> TILE_X_SHIFT
			);

			var tileY = (
				by < 0 ? 0 :
				by >= CONTEXT_HEIGHT ? LAST_TILE_Y :
				by >> TILE_Y_SHIFT
			);
			var lastTileY = (
				bby < 0 ? 0 :
				bby >= CONTEXT_HEIGHT ? LAST_TILE_Y :
				bby >> TILE_Y_SHIFT
			);

			// Each ball (object) adds one "foot" for each tile it falls in. If
			// ball size (radius * 2) is less than tile dimension, then a ball
			// will add up to four feet.
			for (var ty = tileY; ty <= lastTileY; ++ty) {
				for (var tx = tileX; tx <= lastTileX; ++tx) {
					var bucketIndex = tx + (ty * TILE_X_COUNT);
					++footCounts[bucketIndex];
					unsortedFeet[idx] = (bucketIndex << INDEX_BIT_COUNT) + i;
					unsortedFeet[idx + 1] = bx + br;
					unsortedFeet[idx + 2] = by + br;
					unsortedFeet[idx + 3] = br;
					idx += 4;
				}
			}
		}

		var footTotal = idx >> 2;

		// Transform counts into indices
		idx = 0;
		for (var i = 0; i < TILE_COUNT; ++i) {
			tileIndices[i] = idx;
			idx += footCounts[i];
		}
		tileIndices[TILE_COUNT] = idx;

		// Construct sorted list with bucket sort
		idx = 0;
		for (var i = 0; i < footTotal; ++i) {
			var bucketIndex = unsortedFeet[idx] >> INDEX_BIT_COUNT;

			var ndx = (tileIndices[bucketIndex + 1] - footCounts[bucketIndex]--) << 2;
			feetByTile[ndx] = unsortedFeet[idx];
			feetByTile[ndx + 1] = unsortedFeet[idx + 1];
			feetByTile[ndx + 2] = unsortedFeet[idx + 2];
			feetByTile[ndx + 3] = unsortedFeet[idx + 3];

			idx += 4;
		}

		this._ballCount = ballCount;
		this._footTotal = footTotal;
	};

	TiledCollisionContext.prototype.getDidCollide = function (collidedArray) {
		const BALL_COUNT = this._ballCount;
		const FOOT_TOTAL = this._footTotal;

		var tileIndices = this._tileIndices;
		var feetByTile = this._feetByTile;

		for (var i = 0; i < BALL_COUNT; ++i) {
			collidedArray[i] = 0;
		}

		for (var i = 0, idx = 0; i < FOOT_TOTAL; ++i, idx += 4) {
			var ab = feetByTile[idx] >> INDEX_BIT_COUNT;
			var ai = feetByTile[idx] & INDEX_BIT_MASK;
			var ax = feetByTile[idx + 1];
			var ay = feetByTile[idx + 2];
			var ar = feetByTile[idx + 3];

			var bl = tileIndices[ab];
			var bh = tileIndices[ab + 1];
			for (var j = bl; j < bh; ++j) {
				if (i !== j) {
					var bidx = j << 2;
					var dx = ax - feetByTile[bidx + 1];
					var dy = ay - feetByTile[bidx + 2];
					var radii = ar + feetByTile[bidx + 3];

					if (dx * dx + dy * dy < radii * radii) {
						collidedArray[ai] = 1;
					}
				}
			}
		}
	};

	return TiledCollisionContext;

});