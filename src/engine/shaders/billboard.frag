#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D fillTexture;

varying vec2 vertexTexCoords;
varying float vertexAlpha;

void main(void) {
	vec4 sampledColor = texture2D(fillTexture, vertexTexCoords);
	gl_FragColor = vec4(sampledColor.rgb, sampledColor.a * vertexAlpha);
}