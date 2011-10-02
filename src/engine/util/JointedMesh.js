// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define([
	'engine/util/gllib',
	'engine/util/Program!engine/shaders/jointedmesh.vert!engine/shaders/shadowedsolid.frag',
	'engine/util/Program!engine/shaders/jointedmesh.vert!engine/shaders/shadowmap.frag'
], function (gllib, viewProgram, shadowProgram) {

	var SPLIT_EXT_REGEX = /^([^!]+)(\.[^.\/!]+)(!.+)$/;

	// Ugly hack to work around the fact that req.nameToUrl expects that non-JS
	// files will give it an extension.
	var TRUTHY_BLANK = {'toString': function () { return ''; }};

	// Vertex array layout:
	//
	//   vec3   Vertex position
	//   vec3   Vertex normal
	//   ubyte  Joint A index
	//   ubyte  Joint A weight
	//   ubyte  Joint B index
	//   ubyte  Joint B index
	//   (UV coords will be needed soon but not quite yet.)
	//
	var VERTEX_SIZE = 12 + 12 + 4;

	// TODO: This should probably be configurable eventually
	var MAX_JOINT_COUNT = 4;

	var LITTLE_ENDIAN = new Uint16Array(new Uint8Array([0x12, 0x34]).buffer)[0] !== 0x1234;

	function JointedMesh(vertexCount, indexCount, getVerticesFunc, getIndicesFunc, opt) {
		var va = new ArrayBuffer(vertexCount * VERTEX_SIZE);
		var ia = new Uint16Array(indexCount);

		this.scaleFactor = 7;   // FIXME: Make configurable

		// Currently is expected to contain {x, y, z} tuples. Might be extended
		// with other information in the future.
		this._placeholders = (opt && opt.placeholders ? opt.placeholders : {});

		this._vertexCount = vertexCount;
		this._indexCount = indexCount;
		this._vertexArray = va;
		this._indexArray = ia;
		this._jointArray = new Float32Array(16 * MAX_JOINT_COUNT);

		this._vertexBuffer = null;
		this._indexBuffer = null;

		// Pass a temporary object as a parameter to avoid unnecessary garbage
		var vertex = {
			position: gllib.Vec3.create(),
			normal: gllib.Vec3.create(),
			jointA: 0,
			weightA: 0,   // 0-1
			jointB: 0,
			weightB: 0   // 0-1
		};
		var pos = 0;
		var vad = new DataView(va);
		getVerticesFunc(vertex, function () {
			vad.setFloat32(pos, vertex.position[0], LITTLE_ENDIAN);
			vad.setFloat32(pos + 4, vertex.position[1], LITTLE_ENDIAN);
			vad.setFloat32(pos + 8, vertex.position[2], LITTLE_ENDIAN);

			vad.setFloat32(pos + 12, vertex.normal[0], LITTLE_ENDIAN);
			vad.setFloat32(pos + 16, vertex.normal[1], LITTLE_ENDIAN);
			vad.setFloat32(pos + 20, vertex.normal[2], LITTLE_ENDIAN);

			vad.setUint8(pos + 24, vertex.jointA);
			vad.setUint8(pos + 25, Math.round(vertex.weightA * 255));

			vad.setUint8(pos + 26, vertex.jointB);
			vad.setUint8(pos + 27, Math.round(vertex.weightB * 255));

			pos += VERTEX_SIZE;
		});

		pos = 0;
		getIndicesFunc(function (index) {
			ia[pos++] = index
		});

		gllib.needsContext(function (gl) {
			this._vertexBuffer = gllib.createArrayBuffer(va);
			this._indexBuffer = gllib.createElementArrayBuffer(ia);
		}, this);
	}

	// Parameter scene is a JSON object produced by blender-webgl-exporter.
	// Object objectNames[n] will become a submesh whose transformation will be
	// fully determined by bone n.
	JointedMesh.fromJSONScene = function (scene, objectNames) {
		var unsortedObjects = scene.objs;

		var objs = objectNames.map(function (name) {
			var obj = unsortedObjects.filter(function (a) { return a.name === name; })[0];
			if (!obj) {
				throw new Error('JointedMesh.fromJSONScene: Object named "' + name + '" not found in scene');
			}
			return obj;
		});

		// Count the total number of vertices and indices
		var vertexCount = 0;
		var indexCount = 0;
		for (var i = 0; i < objs.length; ++i) {
			var mesh = objs[i].mesh;
			vertexCount += mesh.v[0].length / 3;
			indexCount += mesh.f[0].length;
		}

		// Determine placeholder locations
		var placeholders = {};
		unsortedObjects.forEach(function (obj) {
		    if (!obj.mesh.v.length) {
				placeholders[obj.name] = {
					'x': obj.mtx[1][3],
					'y': -obj.mtx[0][3],
					'z': obj.mtx[2][3]
				};
			}
		});

		return new JointedMesh(
			vertexCount,
			indexCount,
			function (vtx, pushVertex) {
				for (var i = 0; i < objs.length; ++i) {
					var mesh = objs[i].mesh;
					var positions = mesh.v[0];
					var normals = mesh.n[0];
					var vertexCount = positions.length / 3;

					for (var j = 0; j < vertexCount; ++j) {
						var base = j * 3;

						vtx.position[0] = positions[base + 2];
						vtx.position[1] = positions[base];
						vtx.position[2] = positions[base + 1];

						vtx.normal[0] = normals[base + 2];
						vtx.normal[1] = normals[base];
						vtx.normal[2] = normals[base + 1];

						vtx.jointA = i;
						vtx.weightA = 1;

						vtx.jointB = i;   // FIXME: What to put here?
						vtx.weightB = 0;

						pushVertex();
					}
				}
			},
			function (pushIndex) {
				var baseIndex = 0;
				for (var i = 0; i < objs.length; ++i) {
					var mesh = objs[i].mesh;

					var indices = mesh.f[0];
					for (var j = 0; j < indices.length; ++j) {
						pushIndex(baseIndex + indices[j]);
					}

					baseIndex += mesh.v[0].length / 3;
				}
			},
			{
				'placeholders': placeholders
			}
		);
	};

	JointedMesh.load = function (name, req, load, config) {
		var match = name.match(SPLIT_EXT_REGEX);
		if (match) {
			var modName = match[1];
			var ext = match[2];
		} else {
			var modName = name;
			var ext = TRUTHY_BLANK;
		}
		var objectNames = match[3].substr(1).split(',');

		var xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4) {
				if (xhr.status === 200) {
					var scene = JSON.parse(xhr.responseText);
					load(JointedMesh.fromJSONScene(scene, objectNames));
				} else {
					req.onError(new Error('Could not load jointed mesh with path ' + name));
				}
			}
		};

		xhr.open('GET', req.nameToUrl(modName, ext), true);
		xhr.send(null);
	};

	JointedMesh.prototype.beforeDrawInstances = function (gl, client, viewport, isShadowMap) {
		var program = (isShadowMap ? shadowProgram : viewProgram);

		var vertexBuffer = this._vertexBuffer;
		var indexBuffer = this._indexBuffer;

		gl.useProgram(program.program);

		gl.enableVertexAttribArray(program.vertexPosition);
		gl.enableVertexAttribArray(program.vertexNormal);
		gl.enableVertexAttribArray(program.vertexJointA);
		gl.enableVertexAttribArray(program.vertexWeightA);
		gl.enableVertexAttribArray(program.vertexJointB);
		gl.enableVertexAttribArray(program.vertexWeightB);

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		gl.vertexAttribPointer(program.vertexPosition, 3, gl.FLOAT, false, VERTEX_SIZE, 0);
		gl.vertexAttribPointer(program.vertexNormal, 3, gl.FLOAT, false, VERTEX_SIZE, 12);
		gl.vertexAttribPointer(program.vertexJointA, 1, gl.UNSIGNED_BYTE, false, VERTEX_SIZE, 24);
		gl.vertexAttribPointer(program.vertexWeightA, 1, gl.UNSIGNED_BYTE, true, VERTEX_SIZE, 25);
		gl.vertexAttribPointer(program.vertexJointB, 1, gl.UNSIGNED_BYTE, false, VERTEX_SIZE, 26);
		gl.vertexAttribPointer(program.vertexWeightB, 1, gl.UNSIGNED_BYTE, true, VERTEX_SIZE, 27);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

		if (isShadowMap) {
			gl.uniformMatrix4fv(program.worldToView, false, viewport.shadowWorldToView);
			gl.uniformMatrix4fv(program.projection, false, viewport.shadowProjection);
		} else {
			gl.uniformMatrix4fv(program.worldToView, false, viewport.worldToView);
			gl.uniformMatrix4fv(program.projection, false, viewport.projection);
			gl.uniformMatrix4fv(program.shadowWorldToClip, false, viewport.shadowWorldToClip);
			gl.uniform4fv(program.sunLight, viewport.sunLightView);
			gl.uniform1i(program.shadowTexture, 0);   // By application-wide convention
		}
	};

	JointedMesh.prototype.drawInstance = function (gl, color, modelToWorld, joints) {
		var program = (color ? viewProgram : shadowProgram);

		// Copy all the joint matrices to a single array to pass an a uniform
		var ja = this._jointArray;
		var pos = 0;
		for (var i = 0; i < joints.length; ++i) {
			var joint = joints[i];
			for (var j = 0; j < 16; ++j) {
				ja[pos + j] = joint[j];
			}
			pos += 16;
		}

		gl.uniformMatrix4fv(program.jointMatrices, false, ja);

		gl.uniformMatrix4fv(program.modelToWorld, false, modelToWorld);
		gl.uniform1f(program.scaleFactor, this.scaleFactor);
		if (color) {
			gl.uniform4fv(program.fillColor, color);
		}

		gl.drawElements(gl.TRIANGLES, this._indexCount, gl.UNSIGNED_SHORT, 0);
	};

	JointedMesh.prototype.afterDrawInstances = function (gl, client, viewport, isShadowMap) {
		var program = (isShadowMap ? shadowProgram : viewProgram);

		gl.disableVertexAttribArray(program.vertexWeightB);
		gl.disableVertexAttribArray(program.vertexPosition);
		gl.disableVertexAttribArray(program.vertexNormal);
		gl.disableVertexAttribArray(program.vertexJointA);
		gl.disableVertexAttribArray(program.vertexWeightA);
		gl.disableVertexAttribArray(program.vertexJointB);

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

		gl.useProgram(null);
	};

	// Gets the position of a placeholder in model space
	JointedMesh.prototype.getPlaceholderPosition = function (name, dest) {
		if (!dest) {
			dest = gllib.Vec3.create();
		}

		var ph = this._placeholders[name];
		var sf = this.scaleFactor;
		dest[0] = ph.x * sf;
		dest[1] = ph.y * sf;
		dest[2] = ph.z * sf;

		return dest;
	};

	return JointedMesh;

});