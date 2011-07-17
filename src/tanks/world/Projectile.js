// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/mathlib', 'engine/world/Actor', 'tanks/world/SolidMesh', 'engine/world/Player', 'engine/util/Color', 'engine/client/Billboard'], function (mathlib, Actor, SolidMesh, Player, Color, Billboard) {

	register('Projectile', Projectile);
	inherits(Projectile, Actor);
	inherits(Projectile, SolidMesh);
	function Projectile(opt /* player, x, y, angle, range, speed */) {
		assert(opt.player && typeof opt.player === 'object', 'Projectile: player must be an object');
		Actor.call(this, opt);
		SolidMesh.call(this, Projectile);
		this.defaults(opt, {
			player: Player,
			angle: Number,
			range: Number,
			speed: Number
		});
	}

	Projectile.TRIANGLE_VERTICES = new Float32Array([
		0, -3, 0,
		3, 3, 0,
		-3, 3, 0
	]);

	Projectile.triangleBuffer = null;

	Projectile.meshColor = Color.fromValues(1, 1, 1, 1);

	Projectile.explosion = new Billboard(Color.fromValues(1, 1, 1, 1), 1000);

	Projectile.prototype.dflAngle = 0;

	Projectile.prototype.tick = function () {
		var speedPerTick = Math.round(this.speed / this.game.ticksPerSecond);
		if (this.range > speedPerTick) {
			var delta = mathlib.anglePoint(this.angle, speedPerTick);
			this.dflX = delta[0];
			this.dflY = delta[1];
			this.x += delta[0];
			this.y += delta[1];
			this.range -= speedPerTick;
		} else {
			for (var idx in this.game.actors) {
				var actor = this.game.actors[idx];
				if ('projectileHitTest' in actor && actor.projectileHitTest(this.x, this.y)) {
					Projectile.explosion.add(this.x, this.y, 0);
				}
			}
			this.game.removeActor(this);
		}
	};

	Projectile.prototype.draw = function (gl, client, viewport) {
		this.drawMesh(gl, client, viewport);
	};

	Projectile.prototype.getMeshColor = function (client) {
		return Projectile.meshColor;
	};

	return Projectile;

});