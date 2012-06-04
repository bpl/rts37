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

define(['engine/util', 'engine/util/gllib', 'engine/util/mathlib', 'engine/world/Actor', 'engine/world/Player', 'engine/util/Color', 'engine/client/Billboard', 'engine/util/Mesh!tanks/models/cone.json', 'engine/util/Image!tanks/textures/cuzco_exp2.jpg'], function (util, gllib, mathlib, Actor, Player, Color, Billboard, projectileMesh, explosionImage) {

	util.inherits(Projectile, Actor);
	function Projectile(opt /* player, x, y, angle, range, speed */) {
		util.assert(opt.player && typeof opt.player === 'object', 'Projectile: player must be an object');
		Actor.call(this, opt);
		this.batchName = 'Projectile';
		util.defaults.call(this, opt, {
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

	Projectile.drawMultiple = function (gl, client, viewport, visibleSet, begin, end) {
		projectileMesh.beforeDrawInstances(gl, client, viewport);

		var mtw = Projectile.modelToWorld;
		var factor = client.factor;

		for (var i = begin; i < end; ++i) {
			var obj = visibleSet[i];

			// FIXME: The math code is repeated here and in Vehicle class
			var angleRad = obj.angle;
			// Rotation
			mtw[0] = Math.cos(angleRad);
			mtw[4] = -Math.sin(angleRad);
			mtw[1] = Math.sin(angleRad);
			mtw[5] = Math.cos(angleRad);
			// Translation
			mtw[12] = (obj.x - obj.dflX * factor) / 1024;
			mtw[13] = (obj.y - obj.dflY * factor) / 1024;
			mtw[14] = 10;

			projectileMesh.draw(gl, viewport, mtw, Projectile.meshColor);
		}
	};

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

	return Projectile;

});