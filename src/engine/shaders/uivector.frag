#ifdef GL_ES
precision highp float;
#endif

varying vec4 varFillColor;

void main(void) {
	gl_FragColor = varFillColor;
}