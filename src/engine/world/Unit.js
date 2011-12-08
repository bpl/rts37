// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util', 'engine/util/mathlib', 'engine/world/Actor'], function (util, mathlib, Actor) {

	util.inherits(Unit, Actor);
	function Unit(opt) {
		Actor.call(this, opt);

		this.id = util.required(opt.id);   // FIXME: Also require that this is a number

		this.player = this.game.playerWithPublicId(util.required(opt.playerId));
		util.assert(this.player, 'Unit: player is required');

		this.unitType = util.required(opt.unitType);

		// x, y and radius are required by collision detection
		// FIXME: That the division is applied in unit creation means that ticksPerSecond cannot be adjusted dynamically
		this.radius = this.unitType.collisionRadius + this.unitType.speed / this.game.ticksPerSecond;

		this.angle = 0;   // FIXME: was heading in the prototype
		this.dflAngle = 0;

		this.order = null;
		this.waypoint = null;
		this.distanceToWaypoint = 0;
		this.orderCompleted = true;
	}

	Unit.prototype.setOrder = function (order) {
		// Currently assume that we start at the first waypoint
		if (this.order !== order) {
			if (this.order) {
				this.order.removeUnit(this);
				this.waypoint = null;
				this.distanceToWaypoint = 0;
				this.orderCompleted = true;
			}
			this.order = order;
			if (order) {
				this.waypoint = order.firstWaypoint;
				this.distanceToWaypoint = mathlib.distanceObj(this, this.waypoint);
				this.orderCompleted = false;
				order.addUnit(this);
			}
		}
	};

	Unit.prototype.tick = function (collisionIndex) {
		var oldX = this.x;
		var oldY = this.y;
		var oldAngle = this.angle;

		// FIXME: This must be calculated again every tick if we want to make
		// units detect if they have been pushed away from their goal. However,
		// hasBeenCompletedBy should be called only once.
		if (!this.orderCompleted && this.order) {
			if (this.order.hasBeenCompletedBy(this)) {
				this.orderCompleted = true;
			}
		}

		if (this.waypoint && this.waypoint.next) {
			if (this.waypoint.hasBeenReachedBy(this)) {
				this.waypoint = this.waypoint.next;
			}
		}

		this.unitType.movement.tickFunction.call(this, collisionIndex);

		this.dflX = this.x - oldX;
		this.dflY = this.y - oldY;
		this.dflAngle = -mathlib.angleDelta(this.angle, oldAngle);

		this.distanceToWaypoint = this.waypoint ? mathlib.distanceObj(this, this.waypoint) : 0;
	};

	return Unit;

});