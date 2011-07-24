#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D groundTexture;

varying float vertexLightness;
varying vec2 vertexTexCoords;

void main() {
	gl_FragColor = vec4(
		texture2D(groundTexture, vertexTexCoords).rgb * vertexLightness,
		1.0
	);
}