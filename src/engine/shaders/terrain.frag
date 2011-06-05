#ifdef GL_ES
precision highp float;
#endif

varying vec4 tileColor;

void main() {
	gl_FragColor = tileColor;
}