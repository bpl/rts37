// Firing Solution                    //
// Tiled map and pathfinding routines //

//////////
// Map //
////////

function Map(width, height) {
	assert(width > 0 && width % 1 == 0, 'Map: width must be a positive integer');
	assert(height > 0 && height % 1 == 0, 'Map: height must be a positive integer');
	this.tiles = [];
	this.width = width;
	this.height = height;
	this.widthShift = 0;
	while (1 << this.widthShift < this.width) {
		++this.widthShift;
	}
	this.realWidth = 1 << this.widthShift;
	this.tileCount = this.realWidth * this.height;
	for (var i = 0; i < this.tileCount; ++i) {
		this.tiles.push(1);
	}
}

//////////////
// MinHeap //
////////////

function MinHeap() {
	this.items = [0];
	this.length = 0;
}

MinHeap.prototype.isEmpty = function () {
	return this.length <= 0;
};

MinHeap.prototype.insert = function (value) {
	var currentIdx = ++this.length;
	while (currentIdx > 1 && this.items[currentIdx >> 1] > value) {
		this.items[currentIdx] = this.items[currentIdx >> 1];
		currentIdx >>= 1;
	}
	this.items[currentIdx] = value;
};

MinHeap.prototype.remove = function () {
	var result = this.items[1];
	var heapifyValue = this.items[this.length--];
	if (this.length <= 0) {
		return result;
	}
	var currentIdx = 1,
		smallest = 0;
	while (true) {
		var left = currentIdx << 1;
		if (left <= this.length && this.items[left] < heapifyValue) {
			if (left + 1 <= this.length && this.items[left + 1] < this.items[left]) {
				smallest = left + 1;
			} else {
				smallest = left;
			}
		} else if (left + 1 <= this.length && this.items[left + 1] < heapifyValue) {
			smallest = left + 1;
		} else {
			this.items[currentIdx] = heapifyValue;
			return result;
		}
		this.items[currentIdx] = this.items[smallest];
		currentIdx = smallest;
	}
};

MinHeap.prototype.reorderTileValue = function (value, tileCount) {
	var tileIndex = value % tileCount,
		length = this.length,
		items = this.items;
	for (var currentIdx = 1; currentIdx <= length; ++currentIdx) {
		if (items[currentIdx] % tileCount == tileIndex) {
			break;
		}
	}
	while (currentIdx > 1 && items[currentIdx >> 1] > value) {
		items[currentIdx] = items[currentIdx >> 1];
		currentIdx >>= 1;
	}
	items[currentIdx] = value;
};

////////////////////
// A* pathfinder //
//////////////////

// Based on http://www.policyalmanac.org/games/aStarTutorial.htm
function findPathAStar(map, startIdx, endIdx) {
	var mapTiles = map.tiles,
		mapWidth = map.width,
		mapHeight = map.height,
		realWidth = map.realWidth,
		tileCount = map.tileCount,
		widthShift = map.widthShift;
	// index: [F, G, parentIndex]
	var tiles = {};
	tiles[startIdx] = [0, 0, -1];
	var openList = new MinHeap();
	openList.insert(startIdx);
	var endX = endIdx % realWidth;
	var endY = endIdx >> widthShift;
	while (openList.length > 0) {
		// a) Look for the lowest F cost square on the open list. We refer to this as
		// the current square.
		// b) Switch it to the closed list.
		var currentIdx = openList.remove() % tileCount;
		if (currentIdx == endIdx) {
			// Successfully found a path
			var result = [];
			while (currentIdx != startIdx) {
				result.push(currentIdx);
				currentIdx = tiles[currentIdx][2];
			}
			result.push(currentIdx);
			result.reverse();
			return result;
		}
		var currentX = currentIdx % realWidth;
		var currentY = currentIdx >> widthShift;
		var currentTile = tiles[currentIdx];
		currentTile[0] = -1;
		// c) For each of the 8 squares adjacent to this current square...
		for (var yDelta = -1; yDelta <= 1; ++yDelta) {
			for (var xDelta = -1; xDelta <= 1; ++xDelta) {
				var x = currentX + xDelta;
				var y = currentY + yDelta;
				if ((xDelta || yDelta) && x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
					var idx = y * realWidth + x;
					// If it is not walkable or if it is on the closed list, ignore it.
					if (mapTiles[idx] != 1) {
						continue;
					}
					var tile = tiles[idx];
					if (tile && tile[0] < 0) {
						continue;
					}
					// Otherwise do the following.
					var G = currentTile[1] + (xDelta && yDelta ? 14 : 10);
					//var H = (Math.abs(x - endX) + Math.abs(y - endY)) * 10;
					var H = ((x < endX ? endX - x : x - endX) + (y < endY ? endY - y : y - endY)) * 10;
					if (!tile) {
						// If it isn’t on the open list, add it to the open list.
						// Make the current square the parent of this square.
						// Record the F, G, and H costs of the square.
						// Implementation note: H is not saved currently
						tiles[idx] = [G + H, G, currentIdx];
						openList.insert(idx + tileCount * (G + H));
					} else {
						// If it is on the open list already, check to see if this path to
						// that square is better, using G cost as the measure. A lower G cost
						// means that this is a better path. If so, change the parent of
						// the square to the current square, and recalculate the G and F scores of
						// the square. If you are keeping your open list sorted by F score,
						// you may need to resort the list to account for the change.
						if (tile[1] > G) {
							tiles[idx] = [G + H, G, currentIdx];
							openList.reorderTileValue(idx + tileCount * (G + H), tileCount);
						}
					}
				}
			}
		}
	}
	return null;
};