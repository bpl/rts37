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

define(['dep/glmatrix/glmatrix', 'engine/util/mathlib', 'engine/util/Event'], function (glmatrix, mathlib, Event) {

	var _gl = null;

	var gllib = {};

	gllib._contextProvided = new Event();

	gllib.createArrayBuffer = function (arrayOrNumber, usage) {
		// TODO: Unnecessary micro-optimization? Maybe just rename _gl to gl and use it directly?
		var gl = _gl;
		if (!gl) {
			throw new Error('gllib.createArrayBuffer: WebGL context has not been provided');
		}
		var buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, arrayOrNumber, usage || gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		return buffer;
	};

	gllib.createElementArrayBuffer = function (arrayOrNumber, usage) {
		var gl = _gl;
		if (!gl) {
			throw new Error('gllib.createElementArrayBuffer: WebGL context has not been provided');
		}
		var buffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrayOrNumber, usage || gl.STATIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
		return buffer;
	};

	gllib.needsContext = function (callback, context) {
		gllib._contextProvided.register(callback, context);
		if (_gl) {
			callback.call(context || null, _gl);
		}
	};

	gllib.provideContext = function (gl) {
		if (_gl !== gl) {
			_gl = gl;
			gllib._contextProvided.emit(gl);
		}
	};

	gllib.guard = function (result) {
		var error = _gl.getError();
		if (error) {
			var errors = [error];
			while ((error = _gl.getError())) {
				errors.push(error);
			}
			throw new Error('WebGL error: ' + errors.join(', '));
		}
		return result;
	};

	// Shortcuts to glmatrix to simplify imports
	gllib.Vec3 = glmatrix.Vec3;
	gllib.Vec4 = glmatrix.Vec4;
	gllib.Mat3 = glmatrix.Mat3;
	gllib.Mat4 = glmatrix.Mat4;
	gllib.Quat4 = glmatrix.Quat4;

	// Shortcuts to mathlib to simplify imports
	gllib.Plane = mathlib.Plane;

	return gllib;

});