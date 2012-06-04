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

define(['engine/util', 'engine/client/Widget', 'engine/util/Event'], function (util, Widget, Event) {

	util.inherits(Button, Widget);
	function Button(client, opt /* x, y, width, height, caption, callback */) {
		Widget.call(this, client, opt);
		this.caption = opt.caption || '';
		this.onClick = new Event();
		if (opt.callback) {
			this.onClick.register(opt.callback);
		}
	}

	Button.prototype.handleClick = function (x, y, isDouble) {
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