// Firing Solution   //
// Core game objects //

////////////////
// Commander //
//////////////

register('Commander', Commander);
inherits(Commander, Player);
function Commander(opt /* id, playerId, color */) {
	Player.call(this, opt);
	this.color = Color.require(opt.color);
}

//////////////
// MyActor //
////////////

inherits(MyActor, Actor);
function MyActor(opt /* x, y */) {
	Actor.prototype.constructor.call(this, opt.x, opt.y);
}

///////////
// Ship //
/////////

register('Ship', Ship);
inherits(Ship, MyActor);
function Ship(opt /* id, player, x, y */) {
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
		radarScanMsecs: 1000,
		reloadMsecs: 4000,
		projectileSpeed: 90 * 1024,
		currentReloadMsecs: [0, 0, 0, 0],
		reloadingCount: 0,
		currentRadarAngle: 0
	});
	this.radiusStyle = this.player.color.withAlpha(0.4).toString();
	this.shipStyle = this.player.color.withAlpha(1).toString();
	this.dflAngle = 0;
	this.surfaceLowBound = null;
	this.surfaceHighBound = null;
}

Ship.prototype.setGame = function (game) {
	Actor.prototype.setGame.call(this, game);
	this.surfaceLowBound = this.game.surfaceContext.getLowBound(this, 15 * 1024);
	this.surfaceHighBound = this.game.surfaceContext.getHighBound(this, 15 * 1024);
};

Ship.prototype.afterRemove = function () {
	if (this.surfaceLowBound) {
		this.surfaceLowBound.remove();
	}
	if (this.surfaceHighBound) {
		this.surfaceHighBound.remove();
	}
};

Ship.prototype.afterCollision = function (context, actor) {
	if (context == this.game.surfaceContext) {
		this.setPosition(this.x - this.dflX, this.y - this.dflY);
	}
};

Ship.prototype.setPosition = function (x, y) {
	this.dflX += x - this.x;
	this.dflY += y - this.y;
	this.x = x;
	this.y = y;
	this.surfaceLowBound.setPosition(x, y);
	this.surfaceHighBound.setPosition(x, y);
};

Ship.prototype.tick = function () {
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
		this.setPosition(this.x + delta[0], this.y + delta[1]);
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
	var radarWedge = Math.PI * 2 / (this.radarScanMsecs / this.game.msecsPerTick);
	// Rotate radar
	if (this.game.radarMode == this.game.RADAR_MODE_SPINNING ||
			this.game.showRadarAsSpinning) {
		this.currentRadarAngle = MathUtil.normalizeAngle(this.currentRadarAngle + radarWedge);
	}
	// If we are in an active mode (server or local-only game)
	// Do something with the radar
	if (this.game.radarMode == this.game.RADAR_MODE_SPINNING) {
		// Show blips when radar hits the target if we are the human player,
		// fire at target if we are a computer player.
		for (var idx in this.game.actors) {
			var actor = this.game.actors[idx];
			if (instanceOf(actor, Ship)) {
				if (actor.player != this.player
					&& MathUtil.distance(actor.x, actor.y, this.x, this.y) <= this.radarRadius
					&& MathUtil.isInsideArc(this.currentRadarAngle, radarWedge, MathUtil.angle(this.x, this.y, actor.x, actor.y)))
				{
					if (actor.player != this.game.localPlayer) {
						if (!actor.isInVisualRadiusOf(this.player)) {
							// FIXME: Add uncertainty
							this.game.addActor(Blip, {
								'x': actor.x, 'y': actor.y,
								'radius': 20
							});
						}
					} else if (instanceOf(this, AIShip)) {
						this.fireAtActor(actor);
					}
				}
			} else if (instanceOf(actor, Projectile)) {
				if (actor.player != this.player
					&& actor.player != this.game.localPlayer
					&& MathUtil.distance(actor.x, actor.y, this.x, this.y) <= this.radarRadius
					&& MathUtil.isInsideArc(this.currentRadarAngle, radarWedge, MathUtil.angle(this.x, this.y, actor.x, actor.y))
					&& !actor.isInVisualRadiusOf(this.player))
				{
					// FIXME: Add uncertainty
					this.game.addActor(Blip, {
						'x': actor.x, 'y': actor.y,
						'radius': 4
					});
				}
			}
		}
	} else {
		// Look for targets and fire at them
		if (this.reloadingCount < this.currentReloadMsecs.length) {
			for (var idx in this.game.actors) {
				var actor = this.game.actors[idx];
				if (actor.player != this.player
						&& instanceOf(actor, Ship)
						&& MathUtil.distance(actor.x, actor.y, this.x, this.y) < this.firingRadius
						&& actor.isInRadarRadiusOf(this.player)) {
					this.fireAtActor(actor);
					break;
				}
			}
		}
	}
};

Ship.prototype.draw = function (ctx, uiCtx, factor) {
	if (this.player == this.game.localPlayer
			|| (this.game.radarMode == this.game.RADAR_MODE_SIMPLE
			&& this.isInRadarRadiusOf(this.game.localPlayer))
			|| (this.game.radarMode == this.game.RADAR_MODE_SPINNING
			&& this.isInVisualRadiusOf(this.game.localPlayer))) {
		ctx.save();
		ctx.translate(
			(this.x - this.dflX * factor) / 1024,
			(this.y - this.dflY * factor) / 1024
		);
		ctx.rotate(this.angle - this.dflAngle * factor);
		ctx.strokeStyle = this.shipStyle;
		ctx.beginPath();
		ctx.moveTo(0, -15);
		ctx.lineTo(10, 15);
		ctx.lineTo(-10, 15);
		ctx.closePath();
		ctx.stroke();
		ctx.rotate(-(this.angle - this.dflAngle * factor));
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
		// If selected, draw the selection indicator
		if (uiCtx.selectedActors.indexOf(this) >= 0) {
			ctx.rotate(uiCtx.spinnerAngle);
			ctx.strokeStyle = uiCtx.selectionStyle;
			ctx.lineWidth *= 3;
			ctx.beginPath();
			ctx.arc(0, 0, 25, 0, Math.PI * 0.33, false);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, 0, 25, Math.PI * 0.66, Math.PI, false);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, 0, 25, Math.PI * 1.33, Math.PI * 1.66, false);
			ctx.stroke();
		}
		ctx.restore();
	}
};

Ship.prototype.addFiringArc = function (ctx, expand, factor) {
	if (this.player == this.game.localPlayer) {
		ctx.arc(
			(this.x - this.dflX * factor) / 1024,
			(this.y - this.dflY * factor) / 1024,
			(this.firingRadius >> 10) + expand,
			0, Math.PI * 2, false
		);
	}
};

Ship.prototype.addRadarArc = function (ctx, expand, factor) {
	if (this.player == this.game.localPlayer) {
		var centerX = (this.x - this.dflX * factor) / 1024;
		var centerY = (this.y - this.dflY * factor) / 1024;
		if (this.game.showRadarAsSpinning) {
			var radarWedge = Math.PI * 2 / (this.radarScanMsecs / this.game.msecsPerTick);
			ctx.moveTo(centerX, centerY);
			ctx.arc(centerX, centerY, (this.radarRadius >> 10) + expand, this.currentRadarAngle - Math.PI / 2, this.currentRadarAngle + radarWedge - Math.PI / 2, false);
			ctx.lineTo(centerX, centerY);
		} else {
			ctx.arc(centerX, centerY, (this.radarRadius >> 10) + expand, 0, Math.PI * 2, false);
		}
	}
};

Ship.prototype.clickTest = function (x, y, factor) {
	return MathUtil.distance(
		this.x - this.dflX * factor,
		this.y - this.dflY * factor,
		x,
		y
	) <= 20480;
};

Ship.prototype.projectileHitTest = function (x, y) {
	return MathUtil.distance(this.x, this.y, x, y) <= 15360;
};

Ship.prototype.isInVisualRadiusOf = function (player) {
	for (var idx in this.game.actors) {
		var actor = this.game.actors[idx];
		if (actor.player == player && instanceOf(actor, Ship)) {
			if (MathUtil.distance(this.x, this.y, actor.x, actor.y) <= actor.visualRadius) {
				return true;
			}
		}
	}
	return false;
};

Ship.prototype.isInRadarRadiusOf = function (player) {
	for (var idx in this.game.actors) {
		var actor = this.game.actors[idx];
		if (actor.player == player && instanceOf(actor, Ship)) {
			if (MathUtil.distance(this.x, this.y, actor.x, actor.y) <= actor.radarRadius) {
				return true;
			}
		}
	}
	return false;
};

Ship.prototype.fireAtPos = function (x, y) {
	if (this.reloadingCount < this.currentReloadMsecs.length &&
			MathUtil.distance(x, y, this.x, this.y) < this.firingRadius) {
		this.game.issueCommand(this.player, ['FR', this.id, x, y]);
	}
};

Ship.prototype.fireAtActor = function (actor) {
	this.fireAtPos(actor.x, actor.y);
};

Ship.prototype.commandFireAtPos = function (x, y) {
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

/////////////
// AIShip //
///////////

register('AIShip', AIShip);
inherits(AIShip, Ship);
function AIShip(opt /* id, player, x, y, waypoints */) {
	Ship.call(this, opt);
	this.defaults(opt, {
		waypoints: [],
		currentWaypoint: 0
	});
	if (this.currentWaypoint < this.waypoints.length) {
		this.targetX = this.waypoints[this.currentWaypoint][0];
		this.targetY = this.waypoints[this.currentWaypoint][1];
	}
}

AIShip.prototype.tick = function () {
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
	Ship.prototype.tick.call(this);
};

/////////////////
// Projectile //
///////////////

register('Projectile', Projectile);
inherits(Projectile, MyActor);
function Projectile(opt /* player, x, y, angle, range, speed */) {
	assert(instanceOf(opt.player, Commander), 'Projectile: player must be a Commander');
	MyActor.call(this, opt);
	this.defaults(opt, {
		player: Commander,
		angle: Number,
		range: Number,
		speed: Number
	});
}

Projectile.prototype.tick = function () {
	var speedPerTick = Math.round(this.speed / this.game.ticksPerSecond);
	if (this.range > speedPerTick) {
		var delta = MathUtil.anglePoint(this.angle, speedPerTick);
		this.dflX = delta[0];
		this.dflY = delta[1];
		this.x += delta[0];
		this.y += delta[1];
		this.range -= speedPerTick;
	} else {
		for (var idx in this.game.actors) {
			var actor = this.game.actors[idx];
			if (instanceOf(actor, Ship) && actor.projectileHitTest(this.x, this.y)) {
				this.game.addActor(HitMarker, {'x': this.x, 'y': this.y});
			}
		}
		this.game.removeActor(this);
	}
};

Projectile.prototype.draw = function (ctx, uiCtx, factor) {
	if (this.player == this.game.localPlayer
			|| (this.game.radarMode == this.game.RADAR_MODE_SIMPLE
			&& this.isInRadarRadiusOf(this.game.localPlayer))
			|| (this.game.radarMode == this.game.RADAR_MODE_SPINNING
			&& this.isInVisualRadiusOf(this.game.localPlayer))) {
		ctx.save();
		ctx.translate((this.x - this.dflX * factor) / 1024, (this.y - this.dflY * factor) / 1024);
		ctx.rotate(this.angle);
		ctx.strokeStyle = '#fff';
		ctx.beginPath();
		ctx.moveTo(-3, 4);
		ctx.lineTo(0, 0);
		ctx.lineTo(3, 4);
		ctx.stroke();
		ctx.restore();
	}
};

Projectile.prototype.isInVisualRadiusOf = function (player) {
	for (var idx in this.game.actors) {
		var actor = this.game.actors[idx];
		if (actor.player == player && instanceOf(actor, Ship)) {
			if (MathUtil.distance(this.x, this.y, actor.x, actor.y) <= actor.visualRadius) {
				return true;
			}
		}
	}
	return false;
};

Projectile.prototype.isInRadarRadiusOf = function (player) {
	for (var idx in this.game.actors) {
		var actor = this.game.actors[idx];
		if (actor.player == player && instanceOf(actor, Ship)) {
			if (MathUtil.distance(this.x, this.y, actor.x, actor.y) <= actor.radarRadius) {
				return true;
			}
		}
	}
	return false;
};

///////////
// Blip //
/////////

register('Blip', Blip);
inherits(Blip, MyActor);
function Blip(opt /* x, y, radius */) {
	MyActor.call(this, opt);
	this.defaults(opt, {
		radius: Number,
		lifetimeMsecs: 2000,
		currentMsecs: 2000
	});
}

Blip.prototype.tick = function () {
	this.currentMsecs -= this.game.msecsPerTick;
	if (this.currentMsecs <= 0) {
		this.game.removeActor(this);
	}
};

Blip.prototype.draw = function (ctx, uiCtx, factor) {
	var multiplier = (this.currentMsecs + this.game.msecsPerTick * factor) / this.lifetimeMsecs;
	if (multiplier > 1) {
		multiplier = 1;
	}
	ctx.fillStyle = uiCtx.blipColor.withAlphaMul(multiplier).toString();
	ctx.beginPath();
	ctx.arc(this.x / 1024, this.y / 1024, this.radius, 0, Math.PI * 2, false);
	ctx.fill();
};

////////////////
// HitMarker //
//////////////

register('HitMarker', HitMarker);
inherits(HitMarker, MyActor);
function HitMarker(opt /* x, y */) {
	MyActor.call(this, opt);
	this.defaults(opt, {
		radius: 15,
		lifetimeMsecs: 2000,
		currentMsecs: opt.lifetimeMsecs || 2000,
	});
}

HitMarker.prototype.tick = function () {
	this.currentMsecs -= this.game.msecsPerTick;
	if (this.currentMsecs <= 0) {
		this.game.removeActor(this);
	}
};

HitMarker.prototype.draw = function (ctx, uiCtx, factor) {
	ctx.save();
	ctx.translate(this.x / 1024, this.y / 1024);
	var multiplier = (this.currentMsecs + this.game.msecsPerTick * factor) / this.lifetimeMsecs;
	if (multiplier > 1) {
		multiplier = 1;
	}
	ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.5 * multiplier) + ')';
	ctx.beginPath();
	ctx.moveTo(0, -this.radius * multiplier);
	ctx.lineTo(this.radius * multiplier, 0);
	ctx.lineTo(0, this.radius * multiplier);
	ctx.lineTo(-this.radius * multiplier, 0);
	ctx.fill();
	ctx.restore();
};

/////////////
// MyGame //
///////////

inherits(MyGame, Game);
function MyGame(isLocal) {
	Game.prototype.constructor.call(this, isLocal);
	this.fieldWidth = 800;
	this.fieldHeight = 600;
	this.surfaceContext = new CollisionContext(this);
	// Gameplay modes
	this.RADAR_MODE_SIMPLE = 1;
	this.RADAR_MODE_SPINNING = 2;
	this.radarMode = this.RADAR_MODE_SPINNING;
	this.showRadarAsSpinning = false;
}

MyGame.prototype.handleCommand = function (player, cmd) {
	// The command is a JavaScript array, where cmd[0] is a string indicating
	// the type of the command. Commands may need to be validated because the server
	// echoes command from the clients without parsing them.
	switch (cmd[0]) {
		case 'GO':
			// Movement order
			// [1] is the actor the order was issued to
			// [2] is the target X coordinate
			// [3] is the target Y coordinate
			var actor = this.actorWithId(cmd[1]);
			assert(actor.player === player, 'MyGame.handleCommand: player mismatch');
			actor.targetX = cmd[2];
			actor.targetY = cmd[3];
			break;
		case 'FR':
			// Fire order
			// [1] is the actor the order was issued to
			// [2] is the target X coordinate
			// [3] is the target Y coordinate
			var actor = this.actorWithId(cmd[1]);
			assert(actor.player === player, 'MyGame.handleCommand: player mismatch');
			actor.commandFireAtPos(cmd[2], cmd[3]);
			break;
	}
};

////////////////
// UIContext //
//////////////

function UIContext(game) {
	assert(instanceOf(game, MyGame), 'UIContext: game must be a MyGame');
	this.game = game;
	this.selectionStyle = 'rgba(0, 255, 255, 0.5)';
	this.indicatorStyle = 'rgba(0, 255, 255, 0.5)';
	this.blipColor = new Color(0, 255, 0, 0.5);
	this.spinnerAngle = 0;
	this.selectedActors = [];
}

UIContext.prototype.update = function () {
	this.spinnerAngle = MathUtil.normalizeAngle(this.spinnerAngle + Math.PI * this.game.msecsSinceDrawn / 1000);
};

UIContext.prototype.setSelection = function (arr) {
	this.selectedActors = arr;
};