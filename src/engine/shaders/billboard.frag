#ifdef GL_ES
precision highp float;
#endif

varying vec4 vertexColor;

void main(void) {
	gl_FragColor = vertexColor;
}