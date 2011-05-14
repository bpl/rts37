////////////////
// UIContext //
//////////////

define(function () {

	function UIContext(game) {
		assert(game && typeof game === 'object', 'UIContext: game must be an object');
		this.game = game;
		this.selectionStyle = 'rgba(0, 255, 255, 0.5)';
		this.indicatorStyle = 'rgba(0, 255, 255, 0.5)';
		this.buttonBorderStyle = 'rgba(0, 255, 255, 0.5)';
		this.buttonFillStyle = 'rgba(0, 255, 255, 0.1)';
		this.buttonTextStyle = 'rgb(0, 255, 255)';
		this.spinnerAngle = 0;
		this.selectedActors = [];
	}

	UIContext.prototype.update = function () {
		this.spinnerAngle = MathUtil.normalizeAngle(this.spinnerAngle + Math.PI * this.game.msecsSinceDrawn / 1000);
	};

	UIContext.prototype.setSelection = function (arr) {
		this.selectedActors = arr;
	};

	return UIContext;

});