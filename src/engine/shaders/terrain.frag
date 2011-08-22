#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D groundTexture;
uniform sampler2D shadowTexture;

varying float vertexLightness;
varying vec2 vertexTexCoords;
varying vec4 v_shadowPosition;

void main() {
	float shadowZ = texture2D(shadowTexture, (v_shadowPosition.xy + 1.0) * 0.5).r;
	float groundZ = (v_shadowPosition.z + 1.0) * 0.5;

	float lightness = (shadowZ > groundZ ? vertexLightness : 0.3);

	gl_FragColor = vec4(
		texture2D(groundTexture, vertexTexCoords).rgb * lightness,
		1.0
	);
}