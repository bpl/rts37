// Firing Solution          //
// Server utility functions //

// Removes any part of the path that might refer to files below the initial scope of
// the path or to hidden files or directories. In other words, the result will:
// - Start with './'
// - Contain no empty path components
// - Contain no path components starting with a dot
// - Contain no '\' characters
exports.cleanPath = function (path) {
	var parts = path.replace(/\\/g, '/').split('/');
	for (var i = parts.length - 1; i >= 0; --i) {
		var part = parts[i];
		if (part === '' || part[0] == '.') {
			parts.splice(i, 1);
		}
	}
	return './' + parts.join('/');
};

// Removes the specified prefix from the specified string if such prefix exists
// and returns the resulting string.
exports.removePrefix = function (prefix, s) {
	if (s.indexOf(prefix) === 0) {
		return s.substr(prefix.length);
	}
	return s;
};