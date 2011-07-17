// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/gllib', 'engine/util/mathlib', 'engine/world/Actor', 'engine/world/Player', 'tanks/world/Projectile', 'engine/util/Mesh!tanks/models/tank1.json'], function (gllib, mathlib, Actor, Player, Projectile, vehicleMesh) {

	register('Vehicle', Vehicle);
	inherits(Vehicle, Actor);
	function Vehicle(opt /* id, player, x, y */) {
		Actor.call(this, opt);
		this.defaults(opt, {
			id: Number,
			player: Player,
			angle: 0,
			rotationSpeed: 3,
			speed: 30 * 1024,
			targetX: null,
			targetY: null,
			firingRadius: 300 * 1024,
			radarRadius: 200 * 1024,
			visualRadius: 100 * 1024,
			reloadMsecs: 4000,
			projectileSpeed: 90 * 1024,
			currentReloadMsecs: [0, 0, 0, 0],
			reloadingCount: 0
		});
		this.dflAngle = 0;
		this.surfaceLowBound = null;
		this.surfaceHighBound = null;
	}

	Vehicle.modelToWorld = gllib.Mat4.identity(gllib.Mat4.create());

	Vehicle.prototype.setGame = function (game) {
		Actor.prototype.setGame.call(this, game);
		this.surfaceLowBound = this.game.surfaceContext.getLowBound(this, 15 * 1024);
		this.surfaceHighBound = this.game.surfaceContext.getHighBound(this, 15 * 1024);
	};

	Vehicle.prototype.afterRemove = function () {
		if (this.surfaceLowBound) {
			this.surfaceLowBound.remove();
		}
		if (this.surfaceHighBound) {
			this.surfaceHighBound.remove();
		}
	};

	Vehicle.prototype.afterCollision = function (context, actor) {
		if (context == this.game.surfaceContext) {
			this.setPosition(this.x - this.dflX, this.y - this.dflY);
		}
	};

	Vehicle.prototype.setPosition = function (x, y) {
		this.dflX += x - this.x;
		this.dflY += y - this.y;
		this.x = x;
		this.y = y;
		this.surfaceLowBound.setPosition(x, y);
		this.surfaceHighBound.setPosition(x, y);
	};

	Vehicle.prototype.tick = function () {
		this.dflAngle = 0;
		this.dflX = 0;
		this.dflY = 0;
		if (this.targetX && this.targetY) {
			// Orient towards a waypoint if we have not reached it yet
			var angle = mathlib.angle(this.x, this.y, this.targetX, this.targetY);
			var angleDelta = mathlib.angleDelta(this.angle, angle);
			var rotationPerTick = this.rotationSpeed / this.game.ticksPerSecond;
			if (Math.abs(angleDelta) > rotationPerTick) {
				var lastAngle = this.angle;
				this.angle = mathlib.normalizeAngle(this.angle + angleDelta / Math.abs(angleDelta) * rotationPerTick);
				this.dflAngle = mathlib.angleDelta(lastAngle, this.angle);
			} else {
				this.dflAngle = mathlib.angleDelta(this.angle, angle);
				this.angle = angle;
			}
			var delta = mathlib.anglePoint(this.angle, Math.round(this.speed / this.game.ticksPerSecond));
			if (this.game.map.isPassable(this.x + delta[0], this.y + delta[1])) {
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
		// Radar handling
		if (this.reloadingCount < this.currentReloadMsecs.length) {
			for (var idx in this.game.actors) {
				var actor = this.game.actors[idx];
				if (actor.player !== this.player
						&& 'firingRadius' in actor   // FIXME: Use something more role-specific
						&& mathlib.distance(actor.x, actor.y, this.x, this.y) < this.firingRadius
						&& actor.isInRadarRadiusOf(this.player)) {
					this.fireAtPos(actor.x, actor.y);
					break;
				}
			}
		}
	};

	Vehicle.prototype.draw = function (gl, client, viewport) {
		if (this.player !== this.game.localPlayer
				&& !this.isInRadarRadiusOf(this.game.localPlayer)) {
			return;
		}

		var mtw = Vehicle.modelToWorld;
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

		vehicleMesh.draw(gl, viewport, mtw, this.getMeshColor(client));

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

	Vehicle.prototype.getMeshColor = function (client) {
		return this.player.color;
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

	Vehicle.prototype.addRadarArc = function (ctx, expand, factor) {
		if (this.player == this.game.localPlayer) {
			var centerX = (this.x - this.dflX * factor) / 1024;
			var centerY = (this.y - this.dflY * factor) / 1024;
			ctx.arc(centerX, centerY, (this.radarRadius >> 10) + expand, 0, Math.PI * 2, false);
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

	Vehicle.prototype.isInVisualRadiusOf = function (player) {
		for (var idx in this.game.actors) {
			var actor = this.game.actors[idx];
			if (actor.player == player && 'visualRadius' in actor) {
				if (mathlib.distance(this.x, this.y, actor.x, actor.y) <= actor.visualRadius) {
					return true;
				}
			}
		}
		return false;
	};

	Vehicle.prototype.isInRadarRadiusOf = function (player) {
		for (var idx in this.game.actors) {
			var actor = this.game.actors[idx];
			if (actor.player == player && 'radarRadius' in actor) {
				if (mathlib.distance(this.x, this.y, actor.x, actor.y) <= actor.radarRadius) {
					return true;
				}
			}
		}
		return false;
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

	return Vehicle;

});