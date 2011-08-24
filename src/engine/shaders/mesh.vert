#ifdef GL_ES
precision highp float;
#endif

attribute vec3 vertexPosition;
attribute vec3 vertexNormal;

uniform float scaleFactor;

uniform mat4 modelToWorld;
uniform mat4 worldToView;
uniform mat4 projection;

uniform vec4 sunLight;

varying float v_vertexLightness;

void main(void) {
	gl_Position = projection * (worldToView * (modelToWorld * vec4(scaleFactor * vertexPosition, 1.0)));

	vec3 normalInView = normalize((worldToView * (modelToWorld * vec4(vertexNormal, 0.0))).xyz);
	float sunLightIncidence = max(0.0, dot(normalInView, sunLight.xyz));
	v_vertexLightness = mix(1.0, sunLightIncidence, sunLight.w);
}