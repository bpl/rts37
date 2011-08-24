#ifdef GL_ES
precision highp float;
#endif

uniform vec4 fillColor;

varying float v_vertexLightness;

void main(void) {
	gl_FragColor = vec4(fillColor.rgb * v_vertexLightness, 1.0);
}