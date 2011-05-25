#ifdef GL_ES
precision highp float;
#endif

attribute vec3 vertexPosition;

uniform mat4 modelToWorld;
uniform mat4 worldToClip;

void main(void) {
	gl_Position = worldToClip * modelToWorld * vec4(vertexPosition, 1.0);
}