// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['dep/glmatrix/glmatrix', 'engine/util/gllib', 'engine/util/Program!tanks/shaders/solid.vert!tanks/shaders/solid.frag'], function (glmatrix, gllib, shaderProgram) {

	// To be used as a mixin

	// FIXME: Mixin turned out to be a silly way to go about this. Convert
	// everything to Mesh (or something else) instead.

	function SolidMesh(meshSingleton) {
		this.meshSingleton = meshSingleton;
		this.modelToWorld = glmatrix.Mat4.identity(glmatrix.Mat4.create());

		if (!meshSingleton.solidMeshBufferInitialized) {
			gllib.needsContext(function (gl) {
				meshSingleton.triangleBuffer = gllib.createArrayBuffer(gl, meshSingleton.TRIANGLE_VERTICES);
			}, meshSingleton);
			meshSingleton.solidMeshBufferInitialized = true;
		}
	}

	SolidMesh.prototype.drawMesh = function (gl, client, viewport) {
		var triangleBuffer = this.meshSingleton.triangleBuffer;
		var vertices = this.meshSingleton.TRIANGLE_VERTICES;

		var wtc = viewport.worldToClip;
		var mtw = this.modelToWorld;
		var factor = client.factor;
		var angleRad = (this.angle - this.dflAngle * factor);
		// Rotation
		mtw[0] = Math.cos(angleRad);
		mtw[4] = -Math.sin(angleRad);
		mtw[1] = Math.sin(angleRad);
		mtw[5] = Math.cos(angleRad);
		// Translation
		mtw[12] = (this.x - this.dflX * factor) / 1024;
		mtw[13] = (this.y - this.dflY * factor) / 1024;

		var program = shaderProgram;

		gl.useProgram(program.program);
		gl.enableVertexAttribArray(program.vertexPosition);
		gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuffer);
		gl.vertexAttribPointer(program.vertexPosition, 3, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		gl.uniformMatrix4fv(program.modelToWorld, false, mtw);
		gl.uniformMatrix4fv(program.worldToClip, false, wtc);
		gl.uniform4fv(program.fillColor, this.getMeshColor(client));

		gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 3);

		gl.disableVertexAttribArray(program.vertexPosition);
		gl.useProgram(null);
	};

	SolidMesh.prototype.getMeshColor = function (client) {
		// Provided here for documentation purposes
		// Please return an array of 4 floats in range 0..1
	};

	return SolidMesh;

});