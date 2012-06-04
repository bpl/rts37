// Copyright © 2012 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

define(['engine/util', 'engine/util/mathlib', 'engine/world/Waypoint'], function (util, mathlib, Waypoint) {

	function MoveOrder(x, y, firstWaypoint) {
		this.x = x;
		this.y = y;
		this.firstWaypoint = firstWaypoint;

		this.units = [];
		this._completedCount = 0;
	}

	MoveOrder.createSimpleMoveOrder = function (x, y) {
		return new MoveOrder(x, y, new Waypoint(x, y, null));
	};

	// Called by Unit.setOrder
	MoveOrder.prototype.addUnit = function (unit) {
		util.assert(this.units.indexOf(unit) === -1, 'MoveOrder.addUnit: unit already in order');
		this.units.push(unit);
	};

	// Called by Unit.setOrder
	MoveOrder.prototype.removeUnit = function (unit) {
		var index = this.units.indexOf(unit);
		util.assert(index >= 0, 'MoveOrder.removeUnit: unit not found in order');
		this.units.splice(index, 1);
		if (unit.orderCompleted) {
			--this._completedCount;
		}
	};

	// This will increment the counter of units that have reached the goal, so
	// this should only be called once per unit.
	MoveOrder.prototype.hasBeenCompletedBy = function (unit) {
		var reached = (mathlib.distanceObj(unit, unit.waypoint) <= this._completedCount * 5120 + 10240);
		if (reached) {
			++this._completedCount;
		}
		return reached;
	};

	return MoveOrder;

});