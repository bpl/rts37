// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/world/Actor', 'tanks/world/SolidMesh', 'engine/util/Color'], function (Actor, SolidMesh, Color) {

	register('HitMarker', HitMarker);
	inherits(HitMarker, Actor);
	inherits(HitMarker, SolidMesh);
	function HitMarker(opt /* x, y */) {
		Actor.call(this, opt);
		SolidMesh.call(this, HitMarker);
		this.defaults(opt, {
			radius: 15,
			lifetimeMsecs: 2000,
			currentMsecs: opt.lifetimeMsecs || 2000,
		});
	}

	HitMarker.TRIANGLE_VERTICES = new Float32Array([
		// One half
		0, -10, 0,
		10, 0, 0,
		0, 10, 0,
		// Second half
		0, 10, 0,
		-10, 0, 0,
		0, -10, 0
	]);

	HitMarker.triangleBuffer = null;

	HitMarker.meshColor = Color.fromValues(1, 1, 1, 1);

	HitMarker.prototype.angle = 0;

	HitMarker.prototype.dflAngle = 0;

	HitMarker.prototype.tick = function () {
		this.currentMsecs -= this.game.msecsPerTick;
		if (this.currentMsecs <= 0) {
			this.game.removeActor(this);
		}
	};

	HitMarker.prototype.draw = function (gl, client, viewport) {
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.DST_COLOR);
		this.drawMesh(gl, client, viewport);
		gl.disable(gl.BLEND);
	};

	HitMarker.prototype.getMeshColor = function (client) {
		var multiplier = (this.currentMsecs + this.game.msecsPerTick * client.factor) / this.lifetimeMsecs;
		if (multiplier > 1) {
			multiplier = 1;
		}
		var mc = HitMarker.meshColor;
		mc[3] = 0.5 * multiplier;
		return mc;
	};

	return HitMarker;

});