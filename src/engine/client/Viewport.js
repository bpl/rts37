///////////////
// Viewport //
/////////////

define(['engine/client/Widget'], function (Widget) {

	inherits(Viewport, Widget);
	function Viewport(client, opt /* x, y, width, height */) {
		Widget.call(this, client, opt);
		this.game = this.client.game;
		this.autoScrollRegion = 100;
		this.autoScrollMultiplier = 0.5;
		this.viewX = this.game.fieldWidth / 2;
		this.viewY = this.game.fieldHeight / 2;
		this.viewZoom = 1;
		this.lastMouseX = 0;
		this.lastMouseY = 0;
		this.autoScrollX = 0;
		this.autoScrollY = 0;

		var self = this;
		this.game.onTick.register(function () {
			self.tick();
		});
	};

	Viewport.prototype.tick = function () {
		if (this.autoScrollX != 0 || this.autoScrollY != 0) {
			this.translate(this.autoScrollX, this.autoScrollY);
		}
	};

	Viewport.prototype.draw = function (gl) {
		// To be overridden in a subclass
	};

	Viewport.prototype.viewToWorld = function (x, y) {
		return [(x - this.x) * this.viewZoom + this.viewX - this.width / 2 * this.viewZoom << 10,
				(y - this.y) * this.viewZoom + this.viewY - this.height / 2 * this.viewZoom << 10];
	};

	Viewport.prototype._autoScrollDimension = function (mousePos, viewportPos, viewportSize) {
		if (mousePos > viewportPos && mousePos < viewportPos + this.autoScrollRegion) {
			return (mousePos - viewportPos - this.autoScrollRegion) * this.autoScrollMultiplier;
		} else if (mousePos > viewportPos + viewportSize - this.autoScrollRegion
				&& mousePos < viewportPos + viewportSize) {
			return (mousePos - viewportPos - viewportSize + this.autoScrollRegion) * this.autoScrollMultiplier;
		} else {
			return 0;
		}
	};

	Viewport.prototype.handleClick = function (x, y) {
		var target = this.viewToWorld(x, y);
		for (var idx in this.game.actors) {
			var actor = this.game.actors[idx];
			if (actor.isSelectable() && actor.clickTest(target[0], target[1], this.client)) {
				this.client.setSelection([actor]);
				return;
			}
		}
		for (var idx in this.client.selectedActors) {
			var actor = this.client.selectedActors[idx];
			if (actor.validateMove && actor.validateMove(target[0], target[1])) {
				actor.issueMove(target[0], target[1]);
			}
		}
	};

	Viewport.prototype.handleMouseMove = function (x, y) {
		// Save the most recent position of the mouse to use in firing etc.
		// FIXME: Handle changes to this when zooming or scrolling. Maybe do the
		// conversion right before the value needs to be used.
		var target = this.viewToWorld(x, y);
		this.lastMouseX = target[0];
		this.lastMouseY = target[1];
		// If the mouse pointer is near the boundary of the viewport, scroll
		// the viewport automatically.
		if (this.autoScrollRegion > 0) {
			this.autoScrollX = this._autoScrollDimension(x, this.x, this.width);
			this.autoScrollY = this._autoScrollDimension(y, this.y, this.height);
		}
	};

	Viewport.prototype.handleKeyPress = function (key) {
		switch (key) {
			case 'e':
				this.zoomBy(0.5);
				break;
			case 'f':
				this.zoomBy(2);
				break;
			case 'w':
				this.translate(0, -50);
				break;
			case 's':
				this.translate(0, 50);
				break;
			case 'a':
				this.translate(-50, 0);
				break;
			case 'd':
				this.translate(50, 0);
				break;
			default:
				return false;
		}
	};

	Viewport.prototype._constrainDimension = function (value, viewport, field) {
		if (viewport >= field) {
			return field / 2;
		} else if (value < viewport / 2) {
			return viewport / 2;
		} else if (value > field - viewport / 2) {
			return field - viewport / 2;
		} else {
			return value;
		}
	};

	Viewport.prototype.translate = function (x, y) {
		this.viewX = this._constrainDimension(this.viewX + x * this.viewZoom,
				this.width * this.viewZoom, this.game.fieldWidth);
		this.viewY = this._constrainDimension(this.viewY + y * this.viewZoom,
				this.height * this.viewZoom, this.game.fieldHeight);
	};

	Viewport.prototype.zoomBy = function (factor) {
		this.viewZoom *= factor;
		this.translate(0, 0);
	};

	return Viewport;

});