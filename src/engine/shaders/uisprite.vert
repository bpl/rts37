#ifdef GL_ES
precision highp float;
#endif

attribute vec2 vertexPosition;

void main(void) {
	gl_Position = vec4(vertexPosition, 0, 1.0);
}