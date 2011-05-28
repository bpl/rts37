#ifdef GL_ES
precision highp float;
#endif

attribute vec2 vertexPosition;

attribute vec4 fillColor;

varying vec4 varFillColor;

void main(void) {
	gl_Position = vec4(vertexPosition, 0, 1.0);
	varFillColor = fillColor;
}