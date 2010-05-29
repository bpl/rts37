// Firing Solution                          //
// Utilities for working with HTML5 and CSS //

register('Color', Color);
function Color(opt /* red */, green, blue, alpha) {
	if (typeof opt == 'string') {
		var values = opt.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
		assert(values, 'Color: opt was a string but not a valid color');
		var red = parseInt(values[1], 16);
		green = parseInt(values[2], 16);
		blue = parseInt(values[3], 16);
		alpha = 1;
	} else if (typeof opt == 'object') {
		var red = opt.red;
		green = opt.green;
		blue = opt.blue;
		alpha = opt.alpha;
	} else {
		var red = opt;
	}
	this.red = red;
	this.green = green;
	this.blue = blue;
	this.alpha = alpha;
	if (this.alpha < 1) {
		this.asString = 'rgba(' + this.red + ', ' + this.green + ', ' + this.blue + ', ' + this.alpha + ')';
	} else {
		this.asString = 'rgb(' + this.red + ', ' + this.green + ', ' + this.blue + ')';
	}
}

Color.require = function (color) {
	if (typeof color == 'string') {
		return new Color(color);
	}
	assert(instanceOf(color, Color), 'Color.require: color is not a Color');
	return color;
};

Color.prototype.toString = function () {
	return this.asString;
};

Color.prototype.withAlpha = function (alpha) {
	return new Color(this.red, this.green, this.blue, alpha);
};

Color.prototype.withAlphaMul = function (alphaMul) {
	return new Color(this.red, this.green, this.blue, this.alpha * alphaMul);
};