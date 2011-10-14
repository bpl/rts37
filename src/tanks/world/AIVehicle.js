// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util', 'tanks/world/Vehicle'], function (util, Vehicle) {

	util.inherits(AIVehicle, Vehicle);
	function AIVehicle(opt /* id, playerId, x, y, waypoints */) {
		Vehicle.call(this, opt);
		util.defaults.call(this, opt, {
			waypoints: [],
			currentWaypoint: 0
		});
		if (this.currentWaypoint < this.waypoints.length) {
			this.targetX = this.waypoints[this.currentWaypoint][0];
			this.targetY = this.waypoints[this.currentWaypoint][1];
		}
	}

	AIVehicle.drawShadowMapMultiple = Vehicle.drawShadowMapMultiple;

	AIVehicle.drawMultiple = Vehicle.drawMultiple;

	AIVehicle.prototype.tick = function () {
		if (!this.targetX && !this.targetY) {
			this.currentWaypoint++;
			if (this.currentWaypoint >= this.waypoints.length) {
				this.currentWaypoint = 0;
			}
			if (this.currentWaypoint < this.waypoints.length) {
				this.targetX = this.waypoints[this.currentWaypoint][0];
				this.targetY = this.waypoints[this.currentWaypoint][1];
			}
		}
		Vehicle.prototype.tick.call(this);
	};

	return AIVehicle;

});