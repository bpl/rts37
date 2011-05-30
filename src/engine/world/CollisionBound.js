// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(function () {

	function CollisionBound(x, y, radius, isLow, actor) {
		this.isLow = isLow;
		this.radius = radius;
		this.x = x + (this.isLow ? -this.radius : this.radius);
		this.y = y;
		this.actor = actor;
		this.next = null;
		this.prev = null;
	}

	CollisionBound.prototype.addBefore = function (bound) {
		if (bound.prev) {
			bound.prev.next = this;
		}
		this.prev = bound.prev;
		this.next = bound;
		bound.prev = this;
	};

	CollisionBound.prototype.addAfter = function (bound) {
		if (bound.next) {
			bound.next.prev = this;
		}
		this.next = bound.next;
		this.prev = bound;
		bound.next = this;
	};

	CollisionBound.prototype.remove = function () {
		if (this.next) {
			this.next.prev = this.prev;
		}
		if (this.prev) {
			this.prev.next = this.next;
		}
		this.next = null;
		this.prev = null;
	};

	CollisionBound.prototype.setRadius = function (radius) {
		this.radius = radius;
	};

	CollisionBound.prototype.setPosition = function (x, y) {
		x = x + (this.isLow ? -this.radius : this.radius);
		this.x = x;
		this.y = y;
		while (this.prev && x < this.prev.x) {
			var prev = this.prev;
			if (this.next) {
				this.next.prev = prev;
			}
			if (prev.prev) {
				prev.prev.next = this;
			}
			prev.next = this.next;
			this.prev = prev.prev;
			prev.prev = this;
			this.next = prev;
		}
		while (this.next && x > this.next.x) {
			var next = this.next;
			if (this.prev) {
				this.prev.next = next;
			}
			if (next.next) {
				next.next.prev = this;
			}
			next.prev = this.prev;
			this.next = next.next;
			next.next = this;
			this.prev = next;
		}
	};

	return CollisionBound;

});