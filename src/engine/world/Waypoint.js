// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(function () {

	function Waypoint(x, y, next) {
		this.x = x;
		this.y = y;
		this.next = next;
	}

	Waypoint.prototype.hasBeenReachedBy = function (unit) {
		return (distance(unit, this) <= unit.radius);
	};

	return Waypoint;

});