// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/gllib', 'engine/util/mathlib', 'engine/world/Actor', 'engine/world/Player', 'engine/util/Color', 'engine/client/Billboard', 'engine/util/Mesh!tanks/models/cone.json', 'engine/util/Image!tanks/textures/cuzco_exp2.jpg'], function (gllib, mathlib, Actor, Player, Color, Billboard, projectileMesh, explosionImage) {

	register('Projectile', Projectile);
	inherits(Projectile, Actor);
	function Projectile(opt /* player, x, y, angle, range, speed */) {
		assert(opt.player && typeof opt.player === 'object', 'Projectile: player must be an object');
		Actor.call(this, opt);
		this.defaults(opt, {
			player: Player,
			angle: Number,
			range: Number,
			speed: Number
		});
	}

	Projectile.meshColor = Color.fromValues(1, 1, 1, 1);

	Projectile.modelToWorld = gllib.Mat4.identity();

	Projectile.bigExplosion = new Billboard({
		'image': explosionImage,
		'flip': false,
		'lifetime': 1000,
		'blending': 'additive',
		'framesAcross': 4,
		'numFrames': 16,
		'minAlpha': 1,
		'scaleFactor': 50
	});

	Projectile.smallExplosion = new Billboard({
		'image': explosionImage,
		'flip': false,
		'lifetime': 1000,
		'blending': 'additive',
		'framesAcross': 4,
		'numFrames': 16,
		'minAlpha': 1,
		'scaleFactor': 10
	});

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
					Projectile.bigExplosion.add(this.x, this.y, 20 * 1024);
				} else {
					Projectile.smallExplosion.add(this.x, this.y, 10 * 1024);
				}
			}
			this.game.removeActor(this);
		}
	};

	Projectile.prototype.draw = function (gl, client, viewport) {
		// FIXME: The math code is repeated here and in Vehicle class

		var mtw = Projectile.modelToWorld;
		var factor = client.factor;
		var angleRad = this.angle;
		// Rotation
		mtw[0] = Math.cos(angleRad);
		mtw[4] = -Math.sin(angleRad);
		mtw[1] = Math.sin(angleRad);
		mtw[5] = Math.cos(angleRad);
		// Translation
		mtw[12] = (this.x - this.dflX * factor) / 1024;
		mtw[13] = (this.y - this.dflY * factor) / 1024;
		mtw[14] = 10;

		projectileMesh.draw(gl, viewport, mtw, Projectile.meshColor);
	};

	return Projectile;

});