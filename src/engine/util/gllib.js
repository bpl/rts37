// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/Event'], function (Event) {

	var gllib = {};

	gllib._gl = null;

	gllib._contextProvided = new Event();

	gllib.createArrayBuffer = function (gl, arrayOrNumber, usage) {
		var buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, arrayOrNumber, usage || gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		return buffer;
	};

	gllib.createElementArrayBuffer = function (gl, arrayOrNumber, usage) {
		var buffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrayOrNumber, usage || gl.STATIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
		return buffer;
	};

	gllib.needsContext = function (callback, context) {
		this._contextProvided.register(callback, context);
		if (this._gl) {
			callback.call(context || null, this._gl);
		}
	};

	gllib.provideContext = function (gl) {
		if (this._gl !== gl) {
			this._gl = gl;
			this._contextProvided.emit(gl);
		}
	};

	return gllib;

});