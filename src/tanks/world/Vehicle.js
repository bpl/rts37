//////////////
// Vehicle //
////////////

define(['dep/glmatrix/glmatrix', 'tanks/world/MyActor', 'tanks/world/Commander', 'tanks/world/Projectile', 'engine/util/Program', 'engine/util/Shader!tanks/shaders/vehicle.vert', 'engine/util/Shader!tanks/shaders/vehicle.frag'], function (glmatrix, MyActor, Commander, Projectile, Program, vertexShader, fragmentShader) {

	register('Vehicle', Vehicle);
	inherits(Vehicle, MyActor);
	function Vehicle(opt /* id, player, x, y */) {
		MyActor.call(this, opt);
		this.defaults(opt, {
			id: Number,
			player: Commander,
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
		this.radiusStyle = this.player.color.withAlpha(0.4).toString();
		this.vehicleStyle = this.player.color.withAlpha(1).toString();
		this.dflAngle = 0;
		this.surfaceLowBound = null;
		this.surfaceHighBound = null;
		this.modelToWorld = glmatrix.Mat4.identity(glmatrix.Mat4.create());
	}

	Vehicle.TRIANGLE_VERTICES = new Float32Array([
		0, -15, 0,
		10, 15, 0,
		-10, 15, 0
	]);

	Vehicle.triangleBuffer = null;

	Vehicle.shaderProgram = new Program(vertexShader, fragmentShader);

	Vehicle.prototype.setGame = function (game) {
		MyActor.prototype.setGame.call(this, game);
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
			var angle = MathUtil.angle(this.x, this.y, this.targetX, this.targetY);
			var angleDelta = MathUtil.angleDelta(this.angle, angle);
			var rotationPerTick = this.rotationSpeed / this.game.ticksPerSecond;
			if (Math.abs(angleDelta) > rotationPerTick) {
				var lastAngle = this.angle;
				this.angle = MathUtil.normalizeAngle(this.angle + angleDelta / Math.abs(angleDelta) * rotationPerTick);
				this.dflAngle = MathUtil.angleDelta(lastAngle, this.angle);
			} else {
				this.dflAngle = MathUtil.angleDelta(this.angle, angle);
				this.angle = angle;
			}
			var delta = MathUtil.anglePoint(this.angle, Math.round(this.speed / this.game.ticksPerSecond));
			if (this.game.map.getTileAt(this.x + delta[0], this.y + delta[1]) === 0) {
				this.setPosition(this.x + delta[0], this.y + delta[1]);
			}
			if (MathUtil.manhattanDistance(this.x, this.y, this.targetX, this.targetY) <= 5120) {
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
				if (actor.player != this.player
						&& instanceOf(actor, Vehicle)
						&& MathUtil.distance(actor.x, actor.y, this.x, this.y) < this.firingRadius
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

		// FIXME: Color according to player color

		// FIXME: Put this somewhere else. This must be recreated if the WebGL
		// context is lost.
		var triangleBuffer = Vehicle.triangleBuffer;
		if (!triangleBuffer) {
			triangleBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, Vehicle.TRIANGLE_VERTICES, gl.STATIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			Vehicle.triangleBuffer = triangleBuffer;
		}

		var wtc = viewport.worldToClip;
		var mtw = this.modelToWorld;
		var factor = client.game.factor;
		var angleRad = (this.angle - this.dflAngle * factor);
		// Rotation
		mtw[0] = Math.cos(angleRad);
		mtw[4] = -Math.sin(angleRad);
		mtw[1] = Math.sin(angleRad);
		mtw[5] = Math.cos(angleRad);
		// Translation
		mtw[12] = (this.x - this.dflX * factor) / 1024;
		mtw[13] = (this.y - this.dflY * factor) / 1024;

		var program = Vehicle.shaderProgram;

		gl.useProgram(program.prepare(gl));
		gl.enableVertexAttribArray(program.vertexPosition);
		gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuffer);
		gl.vertexAttribPointer(program.vertexPosition, 3, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		gl.uniformMatrix4fv(program.modelToWorld, false, mtw);
		gl.uniformMatrix4fv(program.worldToClip, false, wtc);

		gl.drawArrays(gl.TRIANGLES, 0, 3);

		gl.disableVertexAttribArray(program.vertexPosition);
		gl.useProgram(null);

		// If selected, draw the selection indicator
		if (client.selectedActors.indexOf(this) >= 0) {
			client.uiRenderer.addRectModel(wtc, mtw, 40, 40);
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
				var distance = MathUtil.distance(
					this.x - this.dflX * factor,
					this.y - this.dflY * factor,
					this.targetX,
					this.targetY
				);
				ctx.strokeStyle = uiCtx.indicatorStyle;
				if (distance > 49152) {
					ctx.beginPath();
					var angle = MathUtil.angle(
						this.x - this.dflX * factor,
						this.y - this.dflY * factor,
						this.targetX,
						this.targetY
					);
					var delta = MathUtil.anglePoint(angle, 35);
					ctx.moveTo(delta[0], delta[1]);
					delta = MathUtil.anglePoint(angle - Math.PI, 13);
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

	Vehicle.prototype.addRadarArc = function (ctx, expand, factor) {
		if (this.player == this.game.localPlayer) {
			var centerX = (this.x - this.dflX * factor) / 1024;
			var centerY = (this.y - this.dflY * factor) / 1024;
			ctx.arc(centerX, centerY, (this.radarRadius >> 10) + expand, 0, Math.PI * 2, false);
		}
	};

	Vehicle.prototype.clickTest = function (x, y, client) {
		var factor = client.game.factor;
		return MathUtil.distance(
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
		return MathUtil.distance(this.x, this.y, x, y) <= 15360;
	};

	Vehicle.prototype.isInVisualRadiusOf = function (player) {
		for (var idx in this.game.actors) {
			var actor = this.game.actors[idx];
			if (actor.player == player && instanceOf(actor, Vehicle)) {
				if (MathUtil.distance(this.x, this.y, actor.x, actor.y) <= actor.visualRadius) {
					return true;
				}
			}
		}
		return false;
	};

	Vehicle.prototype.isInRadarRadiusOf = function (player) {
		for (var idx in this.game.actors) {
			var actor = this.game.actors[idx];
			if (actor.player == player && instanceOf(actor, Vehicle)) {
				if (MathUtil.distance(this.x, this.y, actor.x, actor.y) <= actor.radarRadius) {
					return true;
				}
			}
		}
		return false;
	};

	Vehicle.prototype.validateMove = function (x, y) {
		return this.player == this.game.localPlayer;
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
				MathUtil.distance(x, y, this.x, this.y) < this.firingRadius) {
			this.game.createActor(Projectile, {
				'player': this.player,
				'x': this.x, 'y': this.y,
				'angle': MathUtil.angle(this.x, this.y, x, y),
				'range': MathUtil.distance(this.x, this.y, x, y),
				'speed': this.projectileSpeed
			});
			this.currentReloadMsecs[gunIndex] = this.reloadMsecs;
			++this.reloadingCount;
		}
	};

	Vehicle.prototype.issueFireAtPos = function (x, y) {
		if (this.reloadingCount < this.currentReloadMsecs.length &&
				MathUtil.distance(x, y, this.x, this.y) < this.firingRadius) {
			this.game.issueCommand(['FR', this.id, x, y]);
			return true;
		}
		return false;
	};

	return Vehicle;

});