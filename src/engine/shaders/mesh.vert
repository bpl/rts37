#ifdef GL_ES
precision highp float;
#endif

attribute vec3 vertexPosition;

uniform float scaleFactor;

uniform mat4 modelToWorld;
uniform mat4 worldToClip;

void main(void) {
	gl_Position = worldToClip * (modelToWorld * (vec4(scaleFactor * vertexPosition, 1.0)));
}