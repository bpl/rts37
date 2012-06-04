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

// JSON loading plugin for RequireJS

define(function () {

	var SPLIT_EXT_REGEX = /^(.+)(\.[^.\/]+)$/;

	// Ugly hack to work around the fact that req.nameToUrl expects that non-JS
	// files will give it an extension.
	var TRUTHY_BLANK = {'toString': function () { return ''; }};

	return {
		'load': function (name, req, load, config) {
			var modName, ext;

			var match = name.match(SPLIT_EXT_REGEX);
			if (match) {
				modName = match[1];
				ext = match[2];
			} else {
				modName = name;
				ext = TRUTHY_BLANK;
			}

			var xhr = new XMLHttpRequest();

			xhr.open('GET', req.nameToUrl(modName, ext), true);

			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					if (xhr.status === 200) {
						try {
							var json = JSON.parse(xhr.responseText);
						} catch (e) {
							req.onError(new Error('Error ' + e.toString() + ' while parsing JSON file ' + name));
						}
						load(json);
					} else {
						req.onError(new Error('Status ' + xhr.status + ' when load JSON file ' + name));
					}
				}
			};

			xhr.send(null);
		}
	};

});