// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/gllib', 'engine/util/mathlib', 'engine/world/Actor', 'engine/world/Player', 'tanks/world/Projectile', 'engine/util/JointedMesh!tanks/models/tank3.json!Tank,Turret'], function (gllib, mathlib, Actor, Player, Projectile, vehicleMesh) {

	var tempModelToWorld = gllib.Mat4.identity();
	var tempJointMatrices = [
		gllib.Mat4.identity(),
		gllib.Mat4.identity()
	];
	var tempVec3 = gllib.Vec3.create();

	register('Vehicle', Vehicle);
	inherits(Vehicle, Actor);
	function Vehicle(opt /* id, player, x, y */) {
		Actor.call(this, opt);
		this.defaults(opt, {
			id: Number,
			player: Player,
			angle: 0,
			turretAngle: 0,
			rotationSpeed: 3,
			speed: 30 * 1024,
			targetX: null,
			targetY: null,
			firingRadius: 300 * 1024,
			collisionRadius: 15 * 1024,
			reloadMsecs: 4000,
			projectileSpeed: 90 * 1024,
			currentReloadMsecs: [0, 0, 0, 0],
			reloadingCount: 0
		});
		this.dflAngle = 0;
		this.dflTurretAngle = 0;
	}

	Vehicle.prototype.setPosition = function (x, y) {
		this.dflX += x - this.x;
		this.dflY += y - this.y;
		this.x = x;
		this.y = y;
	};

	Vehicle.prototype.tick = function () {

		function rotateTowards(angle, angleProp, dflAngleProp) {
			var angleDelta = mathlib.angleDelta(this[angleProp], angle);
			var rotationPerTick = this.rotationSpeed / this.game.ticksPerSecond;
			if (Math.abs(angleDelta) > rotationPerTick) {
				var lastAngle = this[angleProp];
				this[angleProp] = mathlib.normalizeAngle(this[angleProp] + angleDelta / Math.abs(angleDelta) * rotationPerTick);
				this[dflAngleProp] = mathlib.angleDelta(lastAngle, this[angleProp]);
			} else {
				this[dflAngleProp] = mathlib.angleDelta(this[angleProp], angle);
				this[angleProp] = angle;
			}
		}

		this.dflAngle = 0;
		this.dflX = 0;
		this.dflY = 0;
		this.dflTurretAngle = 0;
		if (this.targetX && this.targetY) {
			// Orient towards a waypoint if we have not reached it yet
			var angle = mathlib.angle(this.x, this.y, this.targetX, this.targetY);
			rotateTowards.call(this, angle, 'angle', 'dflAngle');
			var delta = mathlib.anglePoint(this.angle, Math.round(this.speed / this.game.ticksPerSecond));
			if (this.game.map.isPassable(this.x + delta[0], this.y + delta[1])
					&& !this.wouldCollideWithSomeActor(this.x + delta[0], this.y + delta[1])) {
				this.setPosition(this.x + delta[0], this.y + delta[1]);
			}
			if (mathlib.manhattanDistance(this.x, this.y, this.targetX, this.targetY) <= 5120) {
				this.targetX = null;
				this.targetY = null;
			}
		}
		// Continue reloading if not reloaded already
		if (this.reloadingCount > 0) {
			for (var i = 0; i < this.currentReloadMsecs.length; ++i) {
				if (this.currentReloadMsecs[i] > 0) {
					this.currentReloadMsecs[i] -= this.game.msecsPerTick;
					if (this.currentReloadMsecs[i] <= 0) {
						--this.reloadingCount;
					}
				}
			}
		}
		// Fire at any enemies in range
		var targetUnit = null;
		for (var idx in this.game.actors) {
			var actor = this.game.actors[idx];
			if (actor.player !== this.player
					&& 'firingRadius' in actor   // FIXME: Use something more role-specific
					&& mathlib.distance(actor.x, actor.y, this.x, this.y) < this.firingRadius) {
				targetUnit = actor;
				break;
			}
		}
		if (targetUnit) {
			// If there is a target, rotate the turret towards the target and fire
			var angleTowardsTarget = mathlib.angle(this.x, this.y, targetUnit.x, targetUnit.y);
			var turretAngle = mathlib.normalizeAngle(angleTowardsTarget - this.angle);
			rotateTowards.call(this, turretAngle, 'turretAngle', 'dflTurretAngle');
			if (this.turretAngle === turretAngle
					&& this.reloadingCount < this.currentReloadMsecs.length) {
				this.fireAtPos(targetUnit.x, targetUnit.y);
			}
		} else {
			// Otherwise make sure the turrent points forward
			rotateTowards.call(this, 0, 'turretAngle', 'dflTurretAngle');
		}
	};

	Vehicle.prototype.getModelToWorld = function (factor, dest) {
		if (!dest) {
			dest = gllib.Mat4.create();
		}
		var angleRad = (this.angle - this.dflAngle * factor);

		gllib.Mat4.identity(dest);
		// Rotation
		dest[0] = Math.cos(angleRad);
		dest[4] = -Math.sin(angleRad);
		dest[1] = Math.sin(angleRad);
		dest[5] = Math.cos(angleRad);
		// Translation
		dest[12] = (this.x - this.dflX * factor) / 1024;
		dest[13] = (this.y - this.dflY * factor) / 1024;

		return dest;
	};

	Vehicle.prototype.getJointMatrix = function (jointNo, factor, dest) {
	    if (!dest) {
			dest = gllib.Mat4.create();
		}

		gllib.Mat4.identity(dest);
		if (jointNo === 1) {
			// Turret rotation
			var turretAngleRad = (this.turretAngle - this.dflTurretAngle * factor);
			dest[0] = Math.cos(turretAngleRad);
			dest[4] = -Math.sin(turretAngleRad);
			dest[1] = Math.sin(turretAngleRad);
			dest[5] = Math.cos(turretAngleRad);
		}

		return dest;
	};

	Vehicle.prototype.drawShadowMap = function (gl, client, viewport) {
		var factor = client.factor;

		var mtw = this.getModelToWorld(factor, tempModelToWorld);
		var joints = tempJointMatrices;
		this.getJointMatrix(1, factor, joints[1]);

		vehicleMesh.draw(gl, viewport, mtw, viewport.shadowWorldToView, viewport.shadowProjection, joints, null);
	};

	Vehicle.prototype.draw = function (gl, client, viewport) {
		var factor = client.factor;

		var mtw = this.getModelToWorld(factor, tempModelToWorld);
		var joints = tempJointMatrices;
		this.getJointMatrix(1, factor, joints[1]);

		vehicleMesh.draw(gl, viewport, mtw, viewport.worldToView, viewport.projection, joints, this.player.color);

		// If selected, draw the selection indicator
		if (client.selectedActors.indexOf(this) >= 0) {
			client.uiRenderer.addRectModel(viewport.worldToClip, mtw, 40, 40);
		}

		// If there is a target, draw the target indicator
		if (typeof this.targetX === 'number' && typeof this.targetY === 'number'
				&& this.player === this.game.localPlayer) {
			client.uiRenderer.addLineWorld(
				viewport.worldToClip,
				(this.x - this.dflX * factor) / 1024,
				(this.y - this.dflY * factor) / 1024,
				this.targetX / 1024,
				this.targetY / 1024,
				0
			);
		}

		/*
			// If reloading, draw the reload indicator
			if (this.reloadingCount > 0 && this.player == this.game.localPlayer) {
				for (var i = 0; i < this.currentReloadMsecs.length; ++i) {
					if (this.currentReloadMsecs[i] > 0) {
						ctx.fillStyle = uiCtx.indicatorStyle;
						ctx.fillRect(-15, -35 - 6 * i, 30 * this.currentReloadMsecs[i] / this.reloadMsecs, 4);
						ctx.strokeStyle = uiCtx.indicatorStyle;
						ctx.strokeRect(-15, -35 - 6 * i, 30, 4);
					}
				}
			}
		*/
	};

	Vehicle.prototype.clickTest = function (x, y, client) {
		var factor = client.factor;
		return mathlib.distance(
			this.x - this.dflX * factor,
			this.y - this.dflY * factor,
			x,
			y
		) <= 20480;
	};

	// Returns true if this actor is selectable by the local player
	Vehicle.prototype.isSelectable = function () {
		return true;
	};

	Vehicle.prototype.projectileHitTest = function (x, y) {
		return mathlib.distance(this.x, this.y, x, y) <= 15360;
	};

	Vehicle.prototype.validateMove = function (player, x, y) {
		return this.player === player;
	};

	Vehicle.prototype.issueMove = function (x, y) {
		this.game.issueCommand(['GO', this.id, x, y]);
	};

	Vehicle.prototype.performMove = function (x, y) {
		this.targetX = x;
		this.targetY = y;
	};

	Vehicle.prototype.fireAtPos = function (x, y) {
		for (var gunIndex = 0; gunIndex < this.currentReloadMsecs.length; ++gunIndex) {
			if (this.currentReloadMsecs[gunIndex] <= 0) {
				break;
			}
		}
		if (gunIndex < this.currentReloadMsecs.length &&
				mathlib.distance(x, y, this.x, this.y) < this.firingRadius) {

			// TODO: Placeholders should be tied to joints
			// TODO: This probably can't use placeholders in the future due to consistency issues
			var vec = vehicleMesh.getPlaceholderPosition('Muzzle', tempVec3);
			gllib.Vec3.scale(vec, 1024, vec);
			gllib.Mat4.multiplyVec3(this.getJointMatrix(1, 0, tempJointMatrices[1]), vec, vec);
			var mtw = this.getModelToWorld(0, tempModelToWorld);
			mtw[12] = this.x;
			mtw[13] = this.y;
			gllib.Mat4.multiplyVec3(mtw, vec, vec);

			this.game.createActor(Projectile, {
				'player': this.player,
				'x': vec[0], 'y': vec[1],
				'angle': mathlib.normalizeAngle(this.turretAngle + this.angle),
				'range': mathlib.distance(vec[0], vec[1], x, y),
				'speed': this.projectileSpeed
			});
			this.currentReloadMsecs[gunIndex] = this.reloadMsecs;
			++this.reloadingCount;
		}
	};

	Vehicle.prototype.issueFireAtPos = function (x, y) {
		if (this.reloadingCount < this.currentReloadMsecs.length &&
				mathlib.distance(x, y, this.x, this.y) < this.firingRadius) {
			this.game.issueCommand(['FR', this.id, x, y]);
			return true;
		}
		return false;
	};

	// FIXME: Use a suitable data structure to determine collisions in better
	// than O(n^2).
	Vehicle.prototype.wouldCollideWithSomeActor = function (x, y) {
		for (var idx in this.game.actors) {
			var actor = this.game.actors[idx];
			if (actor !== this
					&& 'collisionRadius' in actor
					&& mathlib.distance(actor.x, actor.y, x, y) < actor.collisionRadius + this.collisionRadius) {
				return true;
			}
		}
		return false;
	};

	return Vehicle;

});