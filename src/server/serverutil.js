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

// Server utility functions

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