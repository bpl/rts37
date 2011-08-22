#ifdef GL_ES
precision highp float;
#endif

attribute vec3 vertexPosition;
attribute vec3 vertexNormal;

uniform float tileSize;
uniform vec2 blockPosition;

uniform mat4 worldToView;
uniform mat4 projection;
uniform mat4 shadowWorldToClip;

uniform vec4 sunLight;

varying float vertexLightness;
varying vec2 vertexTexCoords;
varying vec4 v_shadowPosition;

void main() {
	vec4 worldPosition = vec4(blockPosition + vertexPosition.xy, vertexPosition.z, 1.0);
	gl_Position = projection * (worldToView * worldPosition);
	v_shadowPosition = shadowWorldToClip * worldPosition;

	vec3 normalInView = normalize((worldToView * vec4(vertexNormal, 0.0)).xyz);
	float sunLightIncidence = max(0.0, dot(normalInView, sunLight.xyz));
	vertexLightness = sunLightIncidence * 2.5 - 0.75;

	vertexTexCoords = vertexPosition.xy / tileSize / 16.0;
}