#ifdef GL_ES
precision highp float;
#endif

void main(void) {
	float normalizedDistance = gl_FragCoord.z;
	gl_FragColor = vec4(normalizedDistance, normalizedDistance, normalizedDistance, 1.0);
}