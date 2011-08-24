#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D shadowTexture;

uniform vec4 sunLight;
uniform vec4 fillColor;

varying float v_vertexLightness;
varying vec4 v_shadowPosition;

void main(void) {
	float shadowZ = texture2D(shadowTexture, (v_shadowPosition.xy + 1.0) * 0.5).r;
	float modelZ = (v_shadowPosition.z + 1.0) * 0.5;

	float lightness = (shadowZ + 0.001 > modelZ ? v_vertexLightness : 1.0 - sunLight.w);

	gl_FragColor = vec4(fillColor.rgb * lightness, 1.0);
}