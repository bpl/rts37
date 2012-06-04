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

define(['engine/util/gllib', 'engine/util/Program!engine/shaders/mesh.vert!engine/shaders/mesh.frag'], function (gllib, shaderProgram) {

	var GET_PARAMETERS_REGEX = /^(\w+)[ \t]+(\w+)[ \t]+(\w+);$/gm;
	var SPLIT_EXT_REGEX = /^(.+)(\.[^.\/]+)$/;

	// Ugly hack to work around the fact that req.nameToUrl expects that non-JS
	// files will give it an extension.
	var TRUTHY_BLANK = {'toString': function () { return ''; }};

	function Mesh(mesh) {
		this._vertexArray = Mesh._generateVertexArray(mesh);
		this._indexArray = Mesh._generateIndexArray(mesh);

		this._vertexBuffer = null;
		this._indexBuffer = null;
		gllib.needsContext(function (gl) {
			this._vertexBuffer = gllib.createArrayBuffer(this._vertexArray);
			this._indexBuffer = gllib.createElementArrayBuffer(this._indexArray);
		}, this);
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

	Mesh._generateVertexArray = function (mesh) {
		var positions = mesh.v[0];
		var normals = mesh.n[0];

		var vertexCount = positions.length / 3;

		// Reserve space for positions and normals
		var result = new Float32Array(vertexCount * 6);

		// Interleave positions and normals
		var resIdx = 0;
		for (var i = 0; i < vertexCount; ++i) {
			var base = i * 3;
			result[resIdx++] = positions[base + 2];
			result[resIdx++] = positions[base];
			result[resIdx++] = positions[base + 1];
			result[resIdx++] = normals[base + 2];
			result[resIdx++] = normals[base];
			result[resIdx++] = normals[base + 1];
		}

		return result;
	};

	Mesh._generateIndexArray = function (mesh) {
		return new Uint16Array(mesh.f[0]);
	};

	Mesh.prototype.beforeDrawInstances = function (gl, client, viewport) {
		var vertexBuffer = this._vertexBuffer;
		var indexBuffer = this._indexBuffer;
		var program = shaderProgram;

		gl.useProgram(program.program);

		gl.enableVertexAttribArray(program.vertexPosition);
		gl.enableVertexAttribArray(program.vertexNormal);
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		gl.vertexAttribPointer(program.vertexPosition, 3, gl.FLOAT, false, 4 * 6, 0);
		gl.vertexAttribPointer(program.vertexNormal, 3, gl.FLOAT, false, 4 * 6, 4 * 3);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

		gl.uniformMatrix4fv(program.worldToView, false, viewport.worldToView);
		gl.uniformMatrix4fv(program.projection, false, viewport.projection);
		gl.uniform4fv(program.sunLight, viewport.sunLightView);
		gl.uniform1f(program.scaleFactor, 7);   // FIXME: Make configurable
	};

	Mesh.prototype.draw = function (gl, viewport, mtw, color) {
		var program = shaderProgram;

		gl.uniformMatrix4fv(program.modelToWorld, false, mtw);
		gl.uniform4fv(program.fillColor, color);

		gl.drawElements(gl.TRIANGLES, this._indexArray.length, gl.UNSIGNED_SHORT, 0);
	};

	Mesh.prototype.afterDrawInstances = function (gl, client, viewport) {
		var program = shaderProgram;

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
		gl.disableVertexAttribArray(program.vertexNormal);
		gl.disableVertexAttribArray(program.vertexPosition);
		gl.useProgram(null);
	};

	return Mesh;

});