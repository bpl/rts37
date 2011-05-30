define(function () {

	register('Color', Color);
	function Color(opt /* red */, green, blue, alpha) {
		if (typeof opt == 'string') {
			return Color.fromString(opt);
		} else if (typeof opt == 'object') {
			return Color.fromValues(
				opt.red / 256,
				opt.green / 256,
				opt.blue / 256,
				alpha
			);
		} else {
			return Color.fromValues(
				red / 256,
				green / 256,
				blue / 256,
				alpha
			);
		}
	}

	Color.fromString = function (s) {
		var values = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
		assert(values, 'Color.fromString: s is not a valid color');
		var red = parseInt(values[1], 16);
		var green = parseInt(values[2], 16);
		var blue = parseInt(values[3], 16);
		var result = new Float32Array(4);
		result[0] = red / 256;
		result[1] = green / 256;
		result[2] = blue / 256;
		result[3] = 1;
		return result;
	};

	Color.fromValues = function (red, green, blue, alpha) {
		var result = new Float32Array(4);
		result[0] = red;
		result[1] = green;
		result[2] = blue;
		result[3] = alpha;
		return result;
	};

	Color.require = function (color) {
		if (typeof color == 'string') {
			return new Color(color);
		}
		assert(color.length === 4, 'Color.require: color must be an array of 4 items');
		return color;
	};

	Color.asString = function (color) {
		if (this.alpha < 1) {
			this.asString = 'rgba(' + color.red + ', ' + color.green + ', ' + color.blue + ', ' + color.alpha + ')';
		} else {
			this.asString = 'rgb(' + color.red + ', ' + color.green + ', ' + color.blue + ')';
		}
	};

	Color.withAlpha = function (color, alpha) {
		return Color.fromValues(color[0], color[1], color[2], alpha);
	};

	Color.withAlphaMul = function (color, alphaMul) {
		return Color.fromValues(color[0], color[1], color[2], color[3] * alphaMul);
	};

	return Color;

});