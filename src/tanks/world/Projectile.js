/////////////////
// Projectile //
///////////////

define(['tanks/world/MyActor', 'tanks/world/Commander', 'tanks/world/HitMarker'], function (MyActor, Commander, HitMarker) {

	register('Projectile', Projectile);
	inherits(Projectile, MyActor);
	function Projectile(opt /* player, x, y, angle, range, speed */) {
		assert(opt.player && typeof opt.player === 'object', 'Projectile: player must be an object');
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
				if ('projectileHitTest' in actor && actor.projectileHitTest(this.x, this.y)) {
					this.game.addActor(HitMarker, {'x': this.x, 'y': this.y});
				}
			}
			this.game.removeActor(this);
		}
	};

	Projectile.prototype.draw = function (ctx, uiCtx, factor) {
		if (this.player == this.game.localPlayer
				|| this.isInRadarRadiusOf(this.game.localPlayer)) {
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
			if (actor.player == player && 'visualRadius' in actor) {
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
			if (actor.player == player && 'radarRadius' in actor) {
				if (MathUtil.distance(this.x, this.y, actor.x, actor.y) <= actor.radarRadius) {
					return true;
				}
			}
		}
		return false;
	};

	return Projectile;

});