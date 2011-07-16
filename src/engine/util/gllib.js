// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(function () {

	var gllib = {};

	gllib.createArrayBuffer = function (gl, array, usage) {
		var buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, array, usage || gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		return buffer;
	};

	gllib.createElementArrayBuffer = function (gl, array, usage) {
		var buffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array, usage || gl.STATIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
		return buffer;
	};

	return gllib;

});