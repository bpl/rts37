#ifdef GL_ES
precision highp float;
#endif

attribute vec3 vertexPosition;
attribute vec3 vertexNormal;

uniform float tileSize;
uniform vec2 blockPosition;

uniform mat4 worldToView;
uniform mat4 projection;

uniform vec4 sunLight;

varying vec4 vertexColor;

void main() {
	vec4 worldPosition = vec4(blockPosition + vertexPosition.xy, vertexPosition.z, 1.0);
	gl_Position = projection * (worldToView * worldPosition);

	vec3 normalInView = normalize((worldToView * vec4(vertexNormal, 0.0)).xyz);
	float sunLightIncidence = max(0.0, dot(normalInView, sunLight.xyz));
	vertexColor = vec4(vec3(0.0, 0.6, 0.0) * mix(1.0, sunLightIncidence, sunLight.w), 1.0);
}