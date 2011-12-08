// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

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