// Wraps a WebGL program to make it easier to work with parameters and to
// recreate the program if the context is lost.

define(function () {

	function Program(/* ...shaders */) {
		this._context = null;
		this.shaders = [];
		for (var i = 0; i < arguments.length; i++) {
			this.shaders.push(arguments[i]);
		}
		this.program = null;
		// When the program is prepared, an instance property will be created
		// for the location of each attribute, uniform and varying.
	}

	// Make sure we don't accidentally create attribute and uniform location
	// properties that conflict with built-in properties.
	Program._NULL_PROGRAM = new Program();

	Program.prototype.prepare = function (gl) {
		if (this._context !== gl) {
			if (this.program) {
				this._context.deleteProgram(this.program);
				this.program = null;
				this._context = null;
			}
			if (gl) {
				var program = gl.createProgram();
				for (var i = 0; i < this.shaders.length; i++) {
					gl.attachShader(program, this.shaders[i].prepare(gl));
				}
				gl.linkProgram(program);
				if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
					throw new Error('Could not link shader program\n\n' + gl.getProgramInfoLog(program));
				}
				this.program = program;
				this._context = gl;
				this._createLocationProperties(gl);
			}
		}
		return this.program;
	};

	Program.prototype._createLocationProperties = function (gl) {
		var inputs = this._collectInputs('attributes');
		for (var name in inputs) {
			if (name in Program._NULL_PROGRAM) {
				throw new Error('Attribute name ' + name + ' conflicts with a built-in property');
			}
			this[name] = gl.getAttribLocation(this.program, name);
			if (this[name] < 0) {
				throw new Error('Could not find location for attribute ' + name);
			}
		}
		inputs = this._collectInputs('uniforms');
		for (var name in inputs) {
			if (name in Program._NULL_PROGRAM) {
				throw new Error('Uniform name ' + name + ' conflicts with a built-in property');
			}
			this[name] = gl.getUniformLocation(this.program, name);
			if (this[name] < 0) {
				throw new Error('Could not find location for uniform ' + name);
			}
		}
	};

	Program.prototype._collectInputs = function (propertyName) {
		var result = {};
		for (var i = 0; i < this.shaders.length; i++) {
			var inputs = this.shaders[i][propertyName];
			for (var name in inputs) {
				// Any type mismatches should already be a link error
				result[name] = inputs[name];
			}
		}
		return result;
	};

	return Program;

});