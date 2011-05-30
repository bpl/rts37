define(['engine/world/CollisionBound'], function (CollisionBound) {

	function CollisionContext(game) {
		assert(game && typeof game === 'object', 'CollisionContext: game must be an object');
		this.lowSentinel = new CollisionBound(-Infinity, 0, 0, true, null);
		this.highSentinel = new CollisionBound(Infinity, 0, 0, false, null);
		this.highSentinel.addAfter(this.lowSentinel);
		var self = this;
		game.onTick.register(function () {
			self.tick();
		});
	}

	CollisionContext.prototype.getLowBound = function (actor, radius) {
		var bound = new CollisionBound(0, 0, radius, true, actor);
		bound.addAfter(this.lowSentinel);
		bound.setPosition(actor.x, actor.y);
		return bound;
	};

	CollisionContext.prototype.getHighBound = function (actor, radius) {
		var bound = new CollisionBound(0, 0, radius, false, actor);
		bound.addAfter(this.lowSentinel);
		bound.setPosition(actor.x, actor.y);
		return bound;
	};

	CollisionContext.prototype.getCollisions = function () {
		var collided = {},
			bound = this.lowSentinel.next;
		if (bound == this.highSentinel) {
			return;
		}
		while (bound) {
			var bound2 = bound.next;
			while (bound2.actor != bound.actor) {
				if (bound2.isLow) {
					var dist = bound.y - bound2.y;
					if ((dist > 0 ? dist : -dist) < bound.radius + bound2.radius) {
						if (Math.pow(bound.actor.x - bound2.actor.x, 2) + Math.pow(bound.actor.y - bound2.actor.y, 2) < Math.pow(bound.radius + bound2.radius, 2)) {
							collided[bound.actor.id] = true;
							collided[bound2.actor.id] = true;
						}
					}
				}
				bound2 = bound2.next;
			}
			do {
				bound = bound.next;
			} while (bound && !bound.isLow);
		}
		return collided;
	};

	CollisionContext.prototype.tick = function () {
		var collisions = [],
			bound = this.lowSentinel.next;
		if (bound == this.highSentinel) {
			return;
		}
		while (bound) {
			var bound2 = bound.next;
			while (bound2.actor != bound.actor) {
				if (bound2.isLow) {
					var dist = bound.y - bound2.y;
					if ((dist > 0 ? dist : -dist) < bound.radius + bound2.radius) {
						if (Math.pow(bound.actor.x - bound2.actor.x, 2) + Math.pow(bound.actor.y - bound2.actor.y, 2) < Math.pow(bound.radius + bound2.radius, 2)) {
							collisions.push([bound.actor, bound2.actor]);
						}
					}
				}
				bound2 = bound2.next;
			}
			do {
				bound = bound.next;
			} while (bound && !bound.isLow);
		}
		for (var i = 0; i < collisions.length; ++i) {
			var collision = collisions[i];
			collision[0].afterCollision(this, collision[1]);
			collision[1].afterCollision(this, collision[0]);
		}
	};

	return CollisionContext;

});