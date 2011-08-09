// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/gllib', 'engine/util/mathlib', 'engine/world/Actor', 'engine/world/Player', 'tanks/world/Projectile', 'engine/util/JointedMesh!tanks/models/tank2.json!Tank,Turret'], function (gllib, mathlib, Actor, Player, Projectile, vehicleMesh) {

	var tempModelToWorld = gllib.Mat4.identity();
	var tempJointMatrices = [
		gllib.Mat4.identity(),
		gllib.Mat4.identity()
	];

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

	Vehicle.prototype.draw = function (gl, client, viewport) {
		var mtw = tempModelToWorld;
		var joints = tempJointMatrices;
		var factor = client.factor;
		var angleRad = (this.angle - this.dflAngle * factor);
		// Rotation
		mtw[0] = Math.cos(angleRad);
		mtw[4] = -Math.sin(angleRad);
		mtw[1] = Math.sin(angleRad);
		mtw[5] = Math.cos(angleRad);
		// Translation
		mtw[12] = (this.x - this.dflX * factor) / 1024;
		mtw[13] = (this.y - this.dflY * factor) / 1024;

		// Turret rotation
		var turret = joints[1];
		var turretAngleRad = (this.turretAngle - this.dflTurretAngle * factor);
		turret[0] = Math.cos(turretAngleRad);
		turret[4] = -Math.sin(turretAngleRad);
		turret[1] = Math.sin(turretAngleRad);
		turret[5] = Math.cos(turretAngleRad);

		vehicleMesh.draw(gl, viewport, mtw, joints, this.player.color);

		// If selected, draw the selection indicator
		if (client.selectedActors.indexOf(this) >= 0) {
			client.uiRenderer.addRectModel(viewport.worldToClip, mtw, 40, 40);
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
			// If there is a target, draw the target indicator
			if (this.targetX && this.targetY && this.player == this.game.localPlayer) {
				var distance = mathlib.distance(
					this.x - this.dflX * factor,
					this.y - this.dflY * factor,
					this.targetX,
					this.targetY
				);
				ctx.strokeStyle = uiCtx.indicatorStyle;
				if (distance > 49152) {
					ctx.beginPath();
					var angle = mathlib.angle(
						this.x - this.dflX * factor,
						this.y - this.dflY * factor,
						this.targetX,
						this.targetY
					);
					var delta = mathlib.anglePoint(angle, 35);
					ctx.moveTo(delta[0], delta[1]);
					delta = mathlib.anglePoint(angle - Math.PI, 13);
					ctx.lineTo(
						(this.targetX - (this.x - this.dflX * factor)) / 1024 + delta[0],
						(this.targetY - (this.y - this.dflY * factor)) / 1024 + delta[1]
					);
					ctx.stroke();
				}
				ctx.beginPath();
				ctx.arc(
					(this.targetX - (this.x - this.dflX * factor)) / 1024,
					(this.targetY - (this.y - this.dflY * factor)) / 1024,
					5, 0, Math.PI * 2, false
				);
				ctx.stroke();
			}
		*/
	};

	Vehicle.prototype.addFiringArc = function (ctx, expand, factor) {
		if (this.player == this.game.localPlayer) {
			ctx.arc(
				(this.x - this.dflX * factor) / 1024,
				(this.y - this.dflY * factor) / 1024,
				(this.firingRadius >> 10) + expand,
				0, Math.PI * 2, false
			);
		}
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
			this.game.createActor(Projectile, {
				'player': this.player,
				'x': this.x, 'y': this.y,
				'angle': mathlib.angle(this.x, this.y, x, y),
				'range': mathlib.distance(this.x, this.y, x, y),
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