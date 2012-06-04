/*global define: false, Image: false*/

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

// Image loading plugin for RequireJS. No functionality beyond the standard
// Image object is provided.

define(function () {

	var SPLIT_EXT_REGEX = /^(.+)(\.[^.\/]+)$/;

	// Ugly hack to work around the fact that req.nameToUrl expects that non-JS
	// files will give it an extension.
	var TRUTHY_BLANK = {'toString': function () { return ''; }};

	var getPixelData = function () {
		var data = this.cachedPixelData;
		if (!data) {
			var canvas = document.createElement('canvas');
			canvas.width = this.width;
			canvas.height = this.height;
			var ctx = canvas.getContext('2d');
			ctx.drawImage(this, 0, 0);
			data = ctx.getImageData(0, 0, this.width, this.height).data;
			this.cachedPixelData = data;
		}
		return data;
	};

	return {
		'load': function (name, req, load, config) {
			var match, modName, ext, image;

			match = name.match(SPLIT_EXT_REGEX);
			if (match) {
				modName = match[1];
				ext = match[2];
			} else {
				modName = name;
				ext = TRUTHY_BLANK;
			}

			image = new Image();

			image.onload = function () {
				load(image);
			};
			image.onerror = function () {
				req.onError(new Error('Couldn\'t load Image with name ' + name));
			};

			image.src = req.nameToUrl(modName, ext);

			image.getPixelData = getPixelData;
		}
	};

});