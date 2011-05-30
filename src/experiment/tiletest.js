var Pathfinder = {};

// Based on http://www.policyalmanac.org/games/aStarTutorial.htm
Pathfinder.naiveAStar = function (map, startIdx, endIdx, debug) {
	// index: [F, G, parentIndex]
	var tiles = {};
	tiles[startIdx] = [0, 0, -1];
	var openList = [startIdx];
	var endX = endIdx % map.width;
	var endY = Math.floor(endIdx / map.width);
	while (openList.length > 0) {
		// a) Look for the lowest F cost square on the open list. We refer to this as
		// the current square.
		// Implementation note: These are actually sorted from highest F to lowest F.
		openList.sort(function (a, b) { return tiles[b][0] - tiles[a][0]; });
		// b) Switch it to the closed list.
		var currentIdx = openList.pop();
		if (currentIdx == endIdx) {
			// Successfully found a path
			var result = [];
			while (currentIdx != startIdx) {
				result.push(currentIdx);
				currentIdx = tiles[currentIdx][2];
			}
			result.push(currentIdx);
			result.reverse();
			// If requested debug information, give that too
			if (debug) {
				for (var idx in tiles) {
					debug[idx] = tiles[idx][1];
				}
			}
			return result;
		}
		tiles[currentIdx][0] = -1;
		// c) For each of the 8 squares adjacent to this current square...
		for (var yDelta = -1; yDelta <= 1; ++yDelta) {
			for (var xDelta = -1; xDelta <= 1; ++xDelta) {
				var x = (currentIdx % map.width) + xDelta;
				var y = Math.floor(currentIdx / map.width) + yDelta;
				if ((xDelta || yDelta) && x >= 0 && x < map.width && y >= 0 && y < map.height) {
					var idx = y * map.width + x;
					// If it is not walkable or if it is on the closed list, ignore it.
					if (map[idx] != 1) {
						continue;
					}
					var tile = tiles[idx];
					if (tile && tile[0] < 0) {
						continue;
					}
					// Otherwise do the following.
					var G = tiles[currentIdx][1] + (xDelta && yDelta ? 14 : 10);
					var H = (Math.abs(x - endX) + Math.abs(y - endY)) * 10;
					if (!tile) {
						// If it isn’t on the open list, add it to the open list.
						// Make the current square the parent of this square.
						// Record the F, G, and H costs of the square.
						// Implementation note: H is not saved currently
						tiles[idx] = [G + H, G, currentIdx];
						openList.push(idx);
					} else {
						// If it is on the open list already, check to see if this path to
						// that square is better, using G cost as the measure. A lower G cost
						// means that this is a better path. If so, change the parent of
						// the square to the current square, and recalculate the G and F scores of
						// the square. If you are keeping your open list sorted by F score,
						// you may need to resort the list to account for the change.
						if (tile[1] > G) {
							tiles[idx] = [G + H, G, currentIdx];
						}
					}
				}
			}
		}
	}
	return null;
};

// Based on http://www.policyalmanac.org/games/aStarTutorial.htm
// Does not sort unnecessarily
// No lookups while sorting
Pathfinder.naiveAStar2 = function (map, startIdx, endIdx, debug) {
	var tileCount = map.width * map.height;
	// index: [F, G, parentIndex]
	var tiles = {};
	tiles[startIdx] = [0, 0, -1];
	var openList = [startIdx];
	var endX = endIdx % map.width;
	var endY = Math.floor(endIdx / map.width);
	var needSort = false;
	while (openList.length > 0) {
		// a) Look for the lowest F cost square on the open list. We refer to this as
		// the current square.
		// Implementation note: These are actually sorted from highest F to lowest F.
		if (needSort) {
			openList.sort(function (a, b) { return b - a; });
			needSort = false;
		}
		// b) Switch it to the closed list.
		var currentIdx = openList.pop() % tileCount;
		if (currentIdx == endIdx) {
			// Successfully found a path
			var result = [];
			while (currentIdx != startIdx) {
				result.push(currentIdx);
				currentIdx = tiles[currentIdx][2];
			}
			result.push(currentIdx);
			result.reverse();
			// If requested debug information, give that too
			if (debug) {
				for (var idx in tiles) {
					debug[idx] = tiles[idx][1];
				}
			}
			return result;
		}
		tiles[currentIdx][0] = -1;
		// c) For each of the 8 squares adjacent to this current square...
		for (var yDelta = -1; yDelta <= 1; ++yDelta) {
			for (var xDelta = -1; xDelta <= 1; ++xDelta) {
				var x = (currentIdx % map.width) + xDelta;
				var y = Math.floor(currentIdx / map.width) + yDelta;
				if ((xDelta || yDelta) && x >= 0 && x < map.width && y >= 0 && y < map.height) {
					var idx = y * map.width + x;
					// If it is not walkable or if it is on the closed list, ignore it.
					if (map[idx] != 1) {
						continue;
					}
					var tile = tiles[idx];
					if (tile && tile[0] < 0) {
						continue;
					}
					// Otherwise do the following.
					var G = tiles[currentIdx][1] + (xDelta && yDelta ? 14 : 10);
					var H = (Math.abs(x - endX) + Math.abs(y - endY)) * 10;
					if (!tile) {
						// If it isn’t on the open list, add it to the open list.
						// Make the current square the parent of this square.
						// Record the F, G, and H costs of the square.
						// Implementation note: H is not saved currently
						tiles[idx] = [G + H, G, currentIdx];
						openList.push(idx + tileCount * (G + H));
						needSort = true;
					} else {
						// If it is on the open list already, check to see if this path to
						// that square is better, using G cost as the measure. A lower G cost
						// means that this is a better path. If so, change the parent of
						// the square to the current square, and recalculate the G and F scores of
						// the square. If you are keeping your open list sorted by F score,
						// you may need to resort the list to account for the change.
						if (tile[1] > G) {
							openList.splice(openList.indexOf(idx + tileCount * tile[0]), 1);
							tiles[idx] = [G + H, G, currentIdx];
							openList.push(idx + tileCount * (G + H));
							needSort = true;
						}
					}
				}
			}
		}
	}
	return null;
};

// Based on http://www.policyalmanac.org/games/aStarTutorial.htm
// Uses binary heap for open list
Pathfinder.naiveAStar3 = function (map, startIdx, endIdx, debug) {
	var tileCount = map.width * map.height;
	// index: [F, G, parentIndex]
	var tiles = {};
	tiles[startIdx] = [0, 0, -1];
	var openList = new MinHeap();
	openList.insert(startIdx);
	var endX = endIdx % map.width;
	var endY = Math.floor(endIdx / map.width);
	while (!openList.isEmpty()) {
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
			// If requested debug information, give that too
			if (debug) {
				for (var idx in tiles) {
					debug[idx] = tiles[idx][1];
				}
			}
			return result;
		}
		tiles[currentIdx][0] = -1;
		// c) For each of the 8 squares adjacent to this current square...
		for (var yDelta = -1; yDelta <= 1; ++yDelta) {
			for (var xDelta = -1; xDelta <= 1; ++xDelta) {
				var x = (currentIdx % map.width) + xDelta;
				var y = Math.floor(currentIdx / map.width) + yDelta;
				if ((xDelta || yDelta) && x >= 0 && x < map.width && y >= 0 && y < map.height) {
					var idx = y * map.width + x;
					// If it is not walkable or if it is on the closed list, ignore it.
					if (map[idx] != 1) {
						continue;
					}
					var tile = tiles[idx];
					if (tile && tile[0] < 0) {
						continue;
					}
					// Otherwise do the following.
					var G = tiles[currentIdx][1] + (xDelta && yDelta ? 14 : 10);
					var H = (Math.abs(x - endX) + Math.abs(y - endY)) * 10;
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

// Based on http://www.policyalmanac.org/games/aStarTutorial.htm
// Uses binary heap for open list
// Accesses property instead of isEmpty
Pathfinder.naiveAStar4 = function (map, startIdx, endIdx, debug) {
	var tileCount = map.width * map.height;
	// index: [F, G, parentIndex]
	var tiles = {};
	tiles[startIdx] = [0, 0, -1];
	var openList = new MinHeap();
	openList.insert(startIdx);
	var endX = endIdx % map.width;
	var endY = Math.floor(endIdx / map.width);
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
			// If requested debug information, give that too
			if (debug) {
				for (var idx in tiles) {
					debug[idx] = tiles[idx][1];
				}
			}
			return result;
		}
		tiles[currentIdx][0] = -1;
		// c) For each of the 8 squares adjacent to this current square...
		for (var yDelta = -1; yDelta <= 1; ++yDelta) {
			for (var xDelta = -1; xDelta <= 1; ++xDelta) {
				var x = (currentIdx % map.width) + xDelta;
				var y = Math.floor(currentIdx / map.width) + yDelta;
				if ((xDelta || yDelta) && x >= 0 && x < map.width && y >= 0 && y < map.height) {
					var idx = y * map.width + x;
					// If it is not walkable or if it is on the closed list, ignore it.
					if (map[idx] != 1) {
						continue;
					}
					var tile = tiles[idx];
					if (tile && tile[0] < 0) {
						continue;
					}
					// Otherwise do the following.
					var G = tiles[currentIdx][1] + (xDelta && yDelta ? 14 : 10);
					var H = (Math.abs(x - endX) + Math.abs(y - endY)) * 10;
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

// Based on http://www.policyalmanac.org/games/aStarTutorial.htm
// Uses binary heap for open list
// Accesses property instead of isEmpty
// Use shifting instead of flooring
Pathfinder.naiveAStar5 = function (map, startIdx, endIdx, debug) {
	var tileCount = map.width * map.height;
	var widthShift = 7;
	assert(map.width == (1 << widthShift), 'naiveAStar: width mismatch');
	// index: [F, G, parentIndex]
	var tiles = {};
	tiles[startIdx] = [0, 0, -1];
	var openList = new MinHeap();
	openList.insert(startIdx);
	var endX = endIdx % map.width;
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
			// If requested debug information, give that too
			if (debug) {
				for (var idx in tiles) {
					debug[idx] = tiles[idx][1];
				}
			}
			return result;
		}
		var currentX = currentIdx % map.width;
		var currentY = currentIdx >> widthShift;
		var currentTile = tiles[currentIdx];
		currentTile[0] = -1;
		// c) For each of the 8 squares adjacent to this current square...
		for (var yDelta = -1; yDelta <= 1; ++yDelta) {
			for (var xDelta = -1; xDelta <= 1; ++xDelta) {
				var x = currentX + xDelta;
				var y = currentY + yDelta;
				if ((xDelta || yDelta) && x >= 0 && x < map.width && y >= 0 && y < map.height) {
					var idx = y * map.width + x;
					// If it is not walkable or if it is on the closed list, ignore it.
					if (map[idx] != 1) {
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

Pathfinder.potentialField = function (map, startIdx, endIdx, debug) {
	var tileCount = map.width * map.height;
	var widthShift = 7;
	assert(map.width == (1 << widthShift), 'potentialField: width mismatch');
	var pf = new Array(map.length);
	var stack = [];
	var stack2 = [endIdx];
	pf[endIdx] = 1;
	var deltas = [[0, -1], [1, 0], [0, 1], [-1, 0]];
	while (stack2.length > 0) {
		var swap = stack;
		stack = stack2;
		stack2 = swap;
		while (stack.length > 0) {
			var currentIdx = stack.pop();
			var cost = pf[currentIdx] + 1;
			var currentX = currentIdx % map.width;
			var currentY = currentIdx >> widthShift;
			for (var delta = 0; delta < 4; ++delta) {
				var x = currentX + deltas[delta][0];
				var y = currentY + deltas[delta][1];
				if (x >= 0 && x < map.width && y >= 0 && y < map.height) {
					var idx = y * map.width + x;
					if (map[idx] != 1) {
						continue;
					}
					if (pf[idx] <= cost) {
						continue;
					}
					pf[idx] = cost;
					stack2.push(idx);
				}
			}
		}
	}
	if (debug) {
		for (var idx = 0; idx < pf.length; ++idx) {
			if (pf[idx]) {
				debug[idx] = pf[idx];
			}
		}
	}
	var currentIdx = startIdx;
	stack.push(startIdx);
	while (currentIdx != endIdx) {
		var cost = pf[currentIdx];
		var currentX = currentIdx % map.width;
		var currentY = currentIdx >> widthShift;
		var bestIdx = -1;
		for (var yDelta = -1; yDelta <= 1; ++yDelta) {
			for (var xDelta = -1; xDelta <= 1; ++xDelta) {
				var x = currentX + xDelta;
				var y = currentY + yDelta;
				if ((xDelta || yDelta) && x >= 0 && x < map.width && y >= 0 && y < map.height) {
					var idx = y * map.width + x;
					if (pf[idx] < cost) {
						bestIdx = idx;
						cost = pf[idx];
					}
				}
			}
		}
		if (bestIdx < 0) {
			return null;
		}
		stack.push(bestIdx);
		currentIdx = bestIdx;
	}
	return stack;
};

Pathfinder.potentialField2 = function (map, startIdx, endIdx, debug) {
	var tileCount = map.width * map.height;
	var widthShift = 7;
	assert(map.width == (1 << widthShift), 'potentialField2: width mismatch');
	var pf = [];
	for (var i = map.length - 1; i >= 0; --i) {
		pf.push(1000000);
	}
	var stack = [];
	var stack2 = [endIdx];
	pf[endIdx] = 1;
	var cost = 1;
	var mapWidth = map.width;
	while (stack.length > 0 || stack2.length > 0) {
		++cost;
		for (var i = stack.length - 1; i >= 0; --i) {
			var currentIdx = stack[i];
			var idx = currentIdx + 1;
			if (map[idx] == 1 && pf[idx] > cost) {
				pf[idx] = cost;
				stack2.push(idx);
			}
			var idx = currentIdx - 1;
			if (map[idx] == 1 && pf[idx] > cost) {
				pf[idx] = cost;
				stack2.push(idx);
			}
			var idx = currentIdx + mapWidth;
			if (map[idx] == 1 && pf[idx] > cost) {
				pf[idx] = cost;
				stack2.push(idx);
			}
			var idx = currentIdx - mapWidth;
			if (map[idx] == 1 && pf[idx] > cost) {
				pf[idx] = cost;
				stack2.push(idx);
			}
		}
		stack.length = 0;
		++cost;
		for (var i = stack2.length - 1; i >= 0; --i) {
			var currentIdx = stack2[i];
			var idx = currentIdx + 1;
			if (map[idx] == 1 && pf[idx] > cost) {
				pf[idx] = cost;
				stack.push(idx);
			}
			var idx = currentIdx - 1;
			if (map[idx] == 1 && pf[idx] > cost) {
				pf[idx] = cost;
				stack.push(idx);
			}
			var idx = currentIdx + mapWidth;
			if (map[idx] == 1 && pf[idx] > cost) {
				pf[idx] = cost;
				stack.push(idx);
			}
			var idx = currentIdx - mapWidth;
			if (map[idx] == 1 && pf[idx] > cost) {
				pf[idx] = cost;
				stack.push(idx);
			}
		}
		stack2.length = 0;
	}
	if (debug) {
		for (var idx = 0; idx < pf.length; ++idx) {
			if (pf[idx]) {
				debug[idx] = pf[idx];
			}
		}
	}
	var currentIdx = startIdx;
	stack.push(startIdx);
	while (currentIdx != endIdx) {
		var cost = pf[currentIdx];
		var currentX = currentIdx % map.width;
		var currentY = currentIdx >> widthShift;
		var bestIdx = -1;
		for (var yDelta = -1; yDelta <= 1; ++yDelta) {
			for (var xDelta = -1; xDelta <= 1; ++xDelta) {
				var x = currentX + xDelta;
				var y = currentY + yDelta;
				if ((xDelta || yDelta) && x >= 0 && x < map.width && y >= 0 && y < map.height) {
					var idx = y * map.width + x;
					if (pf[idx] < cost) {
						bestIdx = idx;
						cost = pf[idx];
					}
				}
			}
		}
		if (bestIdx < 0) {
			return null;
		}
		stack.push(bestIdx);
		currentIdx = bestIdx;
	}
	return stack;
};

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

/*
MinHeap.prototype.remove = function () {
	var result = this.items[1];
	var heapifyValue = this.items[this.length--];
	if (this.length <= 0) {
		return result;
	}
	var currentIdx = 1;
	while (true) {
		var smallest = currentIdx,
			compareTo = heapifyValue,
			left = currentIdx << 1;
		if (left <= this.length && this.items[left] < compareTo) {
			smallest = left;
			compareTo = this.items[smallest];
		}
		if (left + 1 <= this.length && this.items[left + 1] < compareTo) {
			smallest = left + 1;
		}
		if (smallest == currentIdx) {
			this.items[currentIdx] = heapifyValue;
			return result;
		}
		this.items[currentIdx] = this.items[smallest];
		currentIdx = smallest;
	}
};
*/

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