///////////////////////////
// PerformanceIndicator //
/////////////////////////

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
				', sinceDrawn ' + padToThree(game.msecsSinceDrawn),
			10, 10
		);

	};

	return PerformanceIndicator;

});