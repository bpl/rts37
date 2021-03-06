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

define(['engine/util', 'engine/util/Event', 'engine/client/Widget'], function (util, Event, Widget) {

	util.inherits(Viewport, Widget);
	function Viewport(client, opt /* x, y, width, height */) {
		Widget.call(this, client, opt);
		this.game = this.client.game;
		this.autoScrollRegion = 100;
		this.autoScrollMultiplier = 2.5;
		this.viewX = 0;
		this.viewY = 0;
		this.viewZoom = 1;
		this.lastMouseX = 0;
		this.lastMouseY = 0;
		this.autoScrollX = 0;
		this.autoScrollY = 0;

		this._areaSelectionActive = false;
		this._areaSelectionStartX = 0;
		this._areaSelectionStartY = 0;
		this._areaSelectionEndX = 0;
		this._areaSelectionEndY = 0;

		Event.register('didLoadAsset', this._didLoadAsset, this);
	}

	Viewport.prototype._didLoadAsset = function () {
		if (this.game.map) {
			this.viewX = this.game.fieldWidth / 2;
			this.viewY = this.game.fieldHeight / 2;
			return Event.STOP;
		}
	};

	Viewport.prototype.draw = function (gl) {
		// To make autoscrolling work, this should be called as the first thing
		// in the overridden draw method.
		if (this.autoScrollX || this.autoScrollY) {
			var factor = this.client.msecsSinceDrawn / 1000;
			this.translate(this.autoScrollX * factor, this.autoScrollY * factor);
		}
	};

	Viewport.prototype.screenToWorld = function (x, y) {
		return [x * this.viewZoom + this.viewX - this.width / 2 * this.viewZoom << 10,
				y * this.viewZoom + this.viewY - this.height / 2 * this.viewZoom << 10];
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

	Viewport.prototype.handleClick = function (x, y, isDouble) {
		var target = this.screenToWorld(x, y);
		for (var idx in this.game.actors) {
			var actor = this.game.actors[idx];
			if (actor.isSelectable() && actor.clickTest(target[0], target[1], this.client)) {
				// If the user double-clicked this actor and the actor was
				// selected previously, do a screen selection (i.e. all actors
				// of the same type of the same player currently on screen).
				if (isDouble && 'unitType' in actor && this.client.selectedActors.length === 1 && this.client.selectedActors[0] === actor) {
					var actorsOnScreen = this.getActorsInsideScreenRect(0, 0, this.width, this.height);
					this.client.setSelection(actorsOnScreen.filter(function (actor2) {
						return (actor2.player === actor.player && actor2.unitType === actor.unitType);
					}));
				} else {
					this.client.setSelection([actor]);
				}
				return;
			}
		}
		for (var idx in this.client.selectedActors) {
			var actor = this.client.selectedActors[idx];
			if (actor.validateMove && actor.validateMove(this.game.localPlayer, target[0], target[1])) {
				actor.issueMove(target[0], target[1]);
			}
		}
	};

	Viewport.prototype.handleMouseMove = function (x, y) {
		// Save the most recent position of the mouse to use in firing etc.
		// FIXME: Handle changes to this when zooming or scrolling. Maybe do the
		// conversion right before the value needs to be used.
		var target = this.screenToWorld(x, y);
		this.lastMouseX = target[0];
		this.lastMouseY = target[1];
		// If the mouse pointer is near the boundary of the viewport, scroll
		// the viewport automatically.
		if (this.autoScrollRegion > 0) {
			this.autoScrollX = this._autoScrollDimension(x, this.x, this.width);
			this.autoScrollY = this._autoScrollDimension(y, this.y, this.height);
		}
	};

	Viewport.prototype.handleDragStart = function (x, y) {
		this._areaSelectionStartX = x;
		this._areaSelectionStartY = y;
		this._areaSelectionActive = true;

		// Cancel automatic scrolling, because it doesn't play well with area
		// selection yet.
		this.autoScrollX = 0;
		this.autoScrollY = 0;
	};

	Viewport.prototype.handleDragMove = function (x, y) {
		this._areaSelectionEndX = x;
		this._areaSelectionEndY = y;
	};

	Viewport.prototype.handleDragDone = function (x, y) {
		var sx = this._areaSelectionStartX;
		var sy = this._areaSelectionStartY;
		this.client.setSelection(this.getActorsInsideScreenRect(
			(sx <= x ? sx : x),
			(sy <= y ? sy : y),
			(sx <= x ? x : sx),
			(sy <= y ? y : sy)
		));
		this._areaSelectionActive = false;
	};

	Viewport.prototype.handleMouseOut = function () {
		// Stop automatic scrolling if the mouse leaves the viewport
		this.autoScrollX = 0;
		this.autoScrollY = 0;
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

	Viewport.prototype._constrainView = function () {
		var viewportWidth = this.width * this.viewZoom;
		var viewportHeight = this.height * this.viewZoom;

		if (viewportWidth >= this.game.fieldWidth) {
			this.viewX = this.game.fieldWidth / 2;
		} else if (this.viewX < viewportWidth / 2) {
			this.viewX = viewportWidth / 2;
		} else if (this.viewX > this.game.fieldWidth - viewportWidth / 2) {
			this.viewX = this.game.fieldWidth - viewportWidth / 2;
		}

		if (viewportHeight >= this.game.fieldHeight) {
			this.viewY = this.game.fieldHeight / 2;
		} else if (this.viewY < viewportHeight / 2) {
			this.viewY = viewportHeight / 2;
		} else if (this.viewY > this.game.fieldHeight - viewportHeight / 2) {
			this.viewY = this.game.fieldHeight - viewportHeight / 2;
		}
	};

	Viewport.prototype.translate = function (x, y) {
		this.viewX = this.viewX + x * this.viewZoom;
		this.viewY = this.viewY + y * this.viewZoom;
		this._constrainView();
	};

	Viewport.prototype.zoomBy = function (factor) {
		this.viewZoom *= factor;
		this.translate(0, 0);
	};

	return Viewport;

});