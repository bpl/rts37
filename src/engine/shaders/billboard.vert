#ifdef GL_ES
precision highp float;
#endif

attribute vec3 anchorPosition;
attribute float msecsLive;
attribute vec2 deltaPosition;

uniform mat4 worldToView;
uniform mat4 projection;

uniform vec3 modelToWorldRight;
uniform vec3 modelToWorldUp;
uniform vec3 modelToWorldLook;

uniform float scaleFactor;
uniform float lifetime;
uniform float framesAcross;
uniform float numFrames;
uniform float minAlpha;

varying vec2 vertexTexCoords;
varying float vertexAlpha;

void main(void) {
	mat4 modelToWorld = mat4(
		vec4(modelToWorldRight, 0.0),
		vec4(modelToWorldUp, 0.0),
		vec4(modelToWorldLook, 0.0),
		vec4(anchorPosition, 1.0)
	);

	vec4 vertexPosition = vec4(
		deltaPosition.xy * scaleFactor,
		0.0,
		1.0
	);

	gl_Position = projection * (worldToView * modelToWorld * vertexPosition);

	float liveFract = msecsLive / lifetime;

	float currentFrame = min(floor(numFrames * liveFract), numFrames - 1.0);
	float framePos = currentFrame / framesAcross;
	float frameSize = 1.0 / framesAcross;

	vertexTexCoords = vec2(
		(deltaPosition.x + 1.0) * 0.5 + fract(framePos) * framesAcross,
		(deltaPosition.y + 1.0) * 0.5 + floor(framePos)
	) * frameSize;

	vertexAlpha = mix(minAlpha, 1.0, 1.0 - liveFract);
}