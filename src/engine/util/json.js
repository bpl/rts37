// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

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