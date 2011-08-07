#ifdef GL_ES
precision highp float;
#endif

// TODO: This should probably be configurable somewhere
#define MAX_JOINT_COUNT 4

attribute vec3 vertexPosition;
attribute vec3 vertexNormal;

attribute float vertexJointA;
attribute float vertexWeightA;
attribute float vertexJointB;
attribute float vertexWeightB;

uniform float scaleFactor;

uniform mat4 modelToWorld;
uniform mat4 worldToView;
uniform mat4 projection;

uniform mat4 jointMatrices[MAX_JOINT_COUNT];

uniform vec4 sunLight;
uniform vec4 fillColor;

varying vec4 vertexColor;

void main(void) {
	vec4 scaledPosition = vec4(scaleFactor * vertexPosition, 1.0);
	vec4 positionA = jointMatrices[int(vertexJointA)] * scaledPosition;
	vec4 positionB = jointMatrices[int(vertexJointB)] * scaledPosition;
	vec4 weightedPosition = positionA * vertexWeightA + positionB * vertexWeightB;

	gl_Position = projection * (worldToView * (modelToWorld * weightedPosition));

	vec3 normalInView = normalize((worldToView * (modelToWorld * vec4(vertexNormal, 0.0))).xyz);
	float sunLightIncidence = max(0.0, dot(normalInView, sunLight.xyz));
	vertexColor = vec4(fillColor.rgb * mix(1.0, sunLightIncidence, sunLight.w), 1.0);
}