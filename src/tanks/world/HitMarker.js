define(['engine/world/Actor'], function (Actor) {

	register('HitMarker', HitMarker);
	inherits(HitMarker, Actor);
	function HitMarker(opt /* x, y */) {
		Actor.call(this, opt);
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

	HitMarker.prototype.draw = function (gl, uiCtx, factor) {
		/*
		FIXME
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
		*/
	};

	return HitMarker;

});