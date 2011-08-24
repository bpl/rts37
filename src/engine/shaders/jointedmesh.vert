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
uniform mat4 shadowWorldToClip;

uniform mat4 jointMatrices[MAX_JOINT_COUNT];

uniform vec4 sunLight;

varying float v_vertexLightness;
varying vec4 v_shadowPosition;

void main(void) {
	vec4 scaledPosition = vec4(scaleFactor * vertexPosition, 1.0);
	vec4 positionA = jointMatrices[int(vertexJointA)] * scaledPosition;
	vec4 positionB = jointMatrices[int(vertexJointB)] * scaledPosition;
	vec4 weightedPosition = positionA * vertexWeightA + positionB * vertexWeightB;

	vec4 worldPosition = modelToWorld * weightedPosition;
	gl_Position = projection * (worldToView * worldPosition);
	v_shadowPosition = shadowWorldToClip * worldPosition;

	vec4 normalJoint = jointMatrices[int(vertexJointA)] * vec4(vertexNormal, 0.0);
	vec3 normalInView = normalize((worldToView * (modelToWorld * normalJoint)).xyz);
	float sunLightIncidence = max(0.0, dot(normalInView, sunLight.xyz));
	v_vertexLightness = mix(1.0, sunLightIncidence, sunLight.w);
}