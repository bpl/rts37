// Shader loading plugin for RequireJS. Wraps the actual shader, because it will
// need to be recreated if the context is lost.

define(function () {

	var GET_PARAMETERS_REGEX = /^(\w+)[ \t]+(\w+)[ \t]+(\w+);$/gm;
	var SPLIT_TYPE_REGEX = /^([^!]+)!([^!]+)$/;
	var SPLIT_EXT_REGEX = /^(.+)(\.[^.\/]+)$/;

	// Ugly hack to work around the fact that req.nameToUrl expects that non-JS
	// files will give it an extension.
	var TRUTHY_BLANK = {'toString': function () { return ''; }};

	function Shader(type, shaderSource) {
		this._shaderSource = shaderSource;
		this._context = null;
		this.type = type;
		this.shader = null;
		// Each of these is a hash object {'name': 'dataType'}
		this.attributes = {};
		this.uniforms = {};
		this.varyings = {};
	}

	// Redefine here for independence from the WebGL context
	Shader.FRAGMENT_SHADER = 0x8B30;
	Shader.VERTEX_SHADER = 0x8B31;

	Shader.prototype.getTypeString = function () {
		switch (this.type) {
			case Shader.FRAGMENT_SHADER:
				return 'fragment';
			case Shader.VERTEX_SHADER:
				return 'vertex';
			default:
				return 'unknown';
		}
	};

	// Find parameter names and types from the shader source. Each parameter
	// must be declared on a single line.
	Shader.prototype._getParameters = function () {
		var matches = this._shaderSource.match(GET_PARAMETERS_REGEX);
		for (var i = 0; i < matches.length; i++) {
			var match = matches[i];
			switch (match[1].toLowerCase()) {
				case 'attribute':
					this.attributes[match[3]] = match[2];
					break;
				case 'uniform':
					this.uniforms[match[3]] = match[2];
					break;
				case 'varying':
					this.varyings[match[3]] = match[2];
					break;
				// default: pass
			}
		}
	};

	Shader.prototype.prepare = function (gl) {
		if (this._context !== gl) {
			if (this.shader) {
				this._context.deleteShader(this.shader);
				this.shader = null;
				this._context = null;
			}
			if (gl) {
				var shader = gl.createShader(this.type);
				gl.shaderSource(shader, this._shaderSource);
				gl.compileShader(shader);
				if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
					throw new Error('Could not compile ' + this.getTypeString() + ' shader\n\n' + gl.getShaderInfoLog(shader));
				}
				this.shader = shader;
				this._context = gl;
			}
		}
		return this.shader;
	};

	return {
		'load': function (name, req, load, config) {
			var typeMatch = name.match(SPLIT_TYPE_REGEX);
			if (typeMatch) {
				var shaderType = typeMatch[1];
				var path = typeMatch[2];
			} else {
				var shaderType = '';
				var path = name;
			}

			var match = path.match(SPLIT_EXT_REGEX);
			if (match) {
				var modName = match[1];
				var ext = match[2];
				if (!shaderType) {
					shaderType = ext.substr(1);
				}
			} else {
				var modName = name;
				var ext = TRUTHY_BLANK;
			}

			switch (shaderType) {
				case 'fragment':
				case 'frag':
					var shaderType = Shader.FRAGMENT_SHADER;
					break;
				case 'vertex':
				case 'vert':
					var shaderType = Shader.VERTEX_SHADER;
					break;
				case '':
					req.onError(new Error('Missing shader type for shader ' + path));
				default:
					req.onError(new Error('Invalid shader type ' + shaderType));
					return;
			}

			var xhr = new XMLHttpRequest();

			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					if (xhr.status === 200) {
						load(new Shader(shaderType, xhr.responseText));
					} else {
						req.onError(new Error('Could not load shader with path ' + path));
					}
				}
			};

			xhr.open('GET', req.nameToUrl(modName, ext), true);
			xhr.send(null);
		}
	};

});