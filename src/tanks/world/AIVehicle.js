////////////////
// AIVehicle //
//////////////

define(['tanks/world/Vehicle'], function (Vehicle) {

	register('AIVehicle', AIVehicle);
	inherits(AIVehicle, Vehicle);
	function AIVehicle(opt /* id, player, x, y, waypoints */) {
		Vehicle.call(this, opt);
		this.defaults(opt, {
			waypoints: [],
			currentWaypoint: 0
		});
		if (this.currentWaypoint < this.waypoints.length) {
			this.targetX = this.waypoints[this.currentWaypoint][0];
			this.targetY = this.waypoints[this.currentWaypoint][1];
		}
	}

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