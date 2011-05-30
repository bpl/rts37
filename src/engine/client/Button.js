// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/client/Widget', 'engine/util/Event'], function (Widget, Event) {

	inherits(Button, Widget);
	function Button(client, opt /* x, y, width, height, caption, callback */) {
		Widget.call(this, client, opt);
		this.caption = opt.caption || '';
		this.onClick = new Event();
		if (opt.callback) {
			this.onClick.register(opt.callback);
		}
	}

	Button.prototype.handleClick = function (x, y) {
		this.onClick.emit();
	};

	Button.prototype.draw = function (ctx, uiCtx) {
		ctx.save();
		if (uiCtx.buttonFillStyle) {
			ctx.fillStyle = uiCtx.buttonFillStyle;
			ctx.fillRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);
		}
		if (uiCtx.buttonBorderStyle) {
			ctx.strokeStyle = uiCtx.buttonBorderStyle;
			ctx.strokeRect(this.x, this.y, this.width, this.height);
		}
		if (this.caption && uiCtx.buttonTextStyle) {
			ctx.fillStyle = uiCtx.buttonTextStyle;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(this.caption, this.x + this.width / 2, this.y + this.height / 2, this.width);
		}
		ctx.restore();
	};

	return Button;

});