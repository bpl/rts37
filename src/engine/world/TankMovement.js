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

// Movement implementation for units that are on ground and take time to turn
// but can turn in place.

define(['engine/util/mathlib'], function (mathlib) {

	function TankMovement() {
	}

	// This is called in the context of the unit. Tank movement has no
	// parameters, so it always uses the same tick function.
	TankMovement.prototype.tickFunction = function (collisionIndex) {
		const TICKS_PER_SECOND = this.game.ticksPerSecond;
		const UNIT_TYPE = this.unitType;

		const ACTOR_MAX_SPEED = UNIT_TYPE.speed / TICKS_PER_SECOND;
		const ROTATION_SPEED = UNIT_TYPE.rotationSpeed / TICKS_PER_SECOND;
		const COLLISION_DISTANCE = UNIT_TYPE.collisionRadius * 2;

		var cd = this.game.collisionData;

		var collisionArray = cd.collisionArray;
		var indexArray = cd.indexArray;
		var collisionUnits = cd.collisionUnits;

		var collisionsBegin = indexArray[collisionIndex];
		var collisionsEnd = indexArray[collisionIndex + 1];

		var dx = 0;
		var dy = 0;

		if (!this.orderCompleted && this.waypoint) {
			var odx = this.waypoint.x - this.x;
			var ody = this.waypoint.y - this.y;
			var olen = 1 / Math.sqrt(odx * odx + ody * ody);

			dx = odx * olen;
			dy = ody * olen;
		}

		var maxOverlap = 0;
		for (var i = collisionsBegin; i < collisionsEnd; ++i) {
			var actor = collisionUnits[collisionArray[i] & 0xFFFF];
			var overlap = COLLISION_DISTANCE - mathlib.distanceObj(this, actor);
			if (overlap > 0) {
				if (this.order !== actor.order || this.orderCompleted || (!actor.orderCompleted && actor.distanceToWaypoint <= this.distanceToWaypoint)) {
					dx += this.x - actor.x;
					dy += this.y - actor.y;
					if (overlap > maxOverlap) {
						maxOverlap = overlap;
					}
				}
			}
		}
		if (maxOverlap > 0) {
			maxOverlap = mathlib.constrain(maxOverlap, ACTOR_MAX_SPEED / 2, ACTOR_MAX_SPEED);
		}

		if (dx || dy) {
			var waypointHeading = Math.atan2(dx, -dy);
			var angleDelta = mathlib.angleDelta(this.angle, waypointHeading);
			if (maxOverlap > 0) {
				angleDelta = mathlib.constrain(angleDelta, -Math.PI / 2, Math.PI / 2);
				waypointHeading = this.angle + angleDelta;
				dx = maxOverlap * Math.sin(waypointHeading);
				dy = maxOverlap * -Math.cos(waypointHeading);
				// Also turn the unit to face push direction
				if (angleDelta != 0 && Math.abs(angleDelta) > ROTATION_SPEED) {
					this.angle = mathlib.normalizeAngle(this.angle + angleDelta / Math.abs(angleDelta) * ROTATION_SPEED);
				} else {
					this.angle = waypointHeading;
				}
			} else if (angleDelta != 0 && Math.abs(angleDelta) > ROTATION_SPEED) {
				this.angle = mathlib.normalizeAngle(this.angle + angleDelta / Math.abs(angleDelta) * ROTATION_SPEED);
				dx = 0;
				dy = 0;
			} else {
				this.angle = waypointHeading;
				dx = ACTOR_MAX_SPEED * Math.sin(this.angle);
				dy = ACTOR_MAX_SPEED * -Math.cos(this.angle);
			}
		}

		if ((dx || dy) && this.game.map.isPassable(this.x + dx, this.y + dy)) {
			this.x += dx;
			this.y += dy;
		}
	};

	return TankMovement;

});