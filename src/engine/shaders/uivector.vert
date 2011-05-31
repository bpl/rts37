#ifdef GL_ES
precision highp float;
#endif

attribute vec4 vertexPosition;

attribute vec4 fillColor;

varying vec4 varFillColor;

void main(void) {
	gl_Position = vertexPosition;
	varFillColor = fillColor;
}