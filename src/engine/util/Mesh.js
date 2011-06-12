// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/webgllib', 'engine/util/Program!engine/shaders/mesh.vert!engine/shaders/mesh.frag'], function (webgllib, shaderProgram) {

	var GET_PARAMETERS_REGEX = /^(\w+)[ \t]+(\w+)[ \t]+(\w+);$/gm;
	var SPLIT_EXT_REGEX = /^(.+)(\.[^.\/]+)$/;

	// Ugly hack to work around the fact that req.nameToUrl expects that non-JS
	// files will give it an extension.
	var TRUTHY_BLANK = {'toString': function () { return ''; }};

	function Mesh(mesh) {
		this._vertexCount = Mesh._getVertexCount(mesh);
		this._vertexArray = Mesh._generateVertexArray(mesh);
		this._indexArray = Mesh._generateIndexArray(mesh);

		this._vertexBuffer = null;
		this._indexBuffer = null;
	}

	Mesh.load = function (name, req, load, config) {
		var match = name.match(SPLIT_EXT_REGEX);
		if (match) {
			var modName = match[1];
			var ext = match[2];
		} else {
			var modName = name;
			var ext = TRUTHY_BLANK;
		}

		var xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4) {
				if (xhr.status === 200) {
					var scene = JSON.parse(xhr.responseText);
					load(new Mesh(scene.objs[0].mesh));
				} else {
					req.onError(new Error('Could not load mesh with path ' + name));
				}
			}
		};

		xhr.open('GET', req.nameToUrl(modName, ext), true);
		xhr.send(null);
	};

	Mesh._getVertexCount = function (mesh) {
		return mesh.v[0].length / 3;
	};

	Mesh._generateVertexArray = function (mesh) {
		var positions = mesh.v[0]:
		var normals = mesh.n[0];

		var vertices = positions.length / 3;

		// Reserve space for positions and normals
		var result = new Float32Array(vertices * 6);

		// Interleave positions and normals
		var resIdx = 0;
		var posIdx = 0;
		var norIdx = 0;
		for (var i = 0; i < vertices; ++i) {
			result[resIdx++] = positions[posIdx++];
			result[resIdx++] = positions[posIdx++];
			result[resIdx++] = positions[posIdx++];
			result[resIdx++] = normals[norIdx++];
			result[resIdx++] = normals[norIdx++];
			result[resIdx++] = normals[norIdx++];
		}

		return result;
	};

	Mesh._generateIndexArray = function (mesh) {
		return new Uint16Array(mesh.f[0]);
	};

	Mesh.prototype.draw = function (gl, wtc, mtw, color) {
		// FIXME: Put this somewhere else. This must be recreated if the WebGL
		// context is lost.
		var vertexBuffer = this._vertexBuffer;
		var indexBuffer = this._indexBuffer;
		if (!vertexBuffer) {
			vertexBuffer = webgllib.createArrayBuffer(gl, this._vertexArray);
			this._vertexBuffer = vertexBuffer;
			indexBuffer = webgllib.createElementArrayBuffer(gl, this._indexArray);
			this._indexBuffer = indexBuffer;
		}

		var program = shaderProgram;

		gl.useProgram(program.prepare(gl));
		gl.enableVertexAttribArray(program.vertexPosition);
//		gl.enableVertexAttribArray(program.vertexNormal);
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		gl.vertexAttribPointer(program.vertexPosition, 3, gl.FLOAT, false, 4 * 3, 0);
//		gl.vertexAttribPointer(program.vertexNormal, 3, gl.FLOAT, false, 4 * 3, 4 * 3);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

		gl.uniformMatrix4fv(program.modelToWorld, false, mtw);
		gl.uniformMatrix4fv(program.worldToClip, false, wtc);
		gl.uniform4fv(program.fillColor, color);

		gl.drawElements(gl.TRIANGLES, this._vertexCount * 3, gl.UNSIGNED_SHORT, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
//		gl.disableVertexAttribArray(program.vertexNormal);
		gl.disableVertexAttribArray(program.vertexPosition);
		gl.useProgram(null);
	};

	return Mesh;

});