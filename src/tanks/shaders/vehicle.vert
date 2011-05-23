#ifdef GL_ES
precision highp float;
#endif

attribute vec3 vertexPosition;

void main(void) {
	gl_Position = vec4(vertexPosition, 1.0);
}