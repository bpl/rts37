#ifdef GL_ES
precision highp float;
#endif

attribute vec2 xyPosition;

attribute float zPosition;

uniform float tileSize;

uniform mat4 worldToClip;

uniform vec2 blockPosition;

varying vec4 tileColor;

void main() {
	vec4 worldPosition = vec4(blockPosition + xyPosition, zPosition, 1.0);
	gl_Position = worldToClip * worldPosition;
	tileColor = vec4(0.0, 0.2 + zPosition / 20.0, 0.0, 1.0);
}