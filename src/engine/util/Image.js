/*global define: false, Image: false*/

// Image loading plugin for RequireJS. No functionality beyond the standard
// Image object is provided.

define(function () {

	var SPLIT_EXT_REGEX = /^(.+)(\.[^.\/]+)$/;

	// Ugly hack to work around the fact that req.nameToUrl expects that non-JS
	// files will give it an extension.
	var TRUTHY_BLANK = {'toString': function () { return ''; }};

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
		}
	};

});