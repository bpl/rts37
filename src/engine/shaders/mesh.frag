#ifdef GL_ES
precision highp float;
#endif

uniform vec4 fillColor;

void main(void) {
	gl_FragColor = fillColor;
}