// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/client/Widget'], function(Widget) {

	inherits(PerformanceIndicator, Widget);
	function PerformanceIndicator(client, opt) {
		Widget.call(this, client, opt);
	}

	PerformanceIndicator.prototype.draw = function (ctx, uiCtx) {
		var game = this.client.game;
		ctx.fillStyle = '#fff';
		ctx.fillText(
			'permitted ' + game.lastPermittedTick +
				', processed ' + game.lastProcessedTick +
				', sinceTick ' + padToThree(game.msecsSinceTick) +
				', sinceDrawn ' + padToThree(this.client.msecsSinceDrawn),
			10, 10
		);

	};

	return PerformanceIndicator;

});