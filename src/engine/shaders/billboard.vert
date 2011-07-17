#ifdef GL_ES
precision highp float;
#endif

attribute vec3 anchorPosition;
attribute float msecsLive;
attribute vec2 deltaPosition;

uniform mat4 worldToView;
uniform mat4 projection;

uniform float scaleFactor;
uniform float lifetime;
uniform vec4 fillColor;

varying vec4 vertexColor;

void main(void) {
	vec4 vertexPosition = vec4(anchorPosition.xy + deltaPosition.xy * scaleFactor, anchorPosition.z, 1.0);
	gl_Position = projection * (worldToView * vertexPosition);

	vertexColor = fillColor * (1.0 - (msecsLive / lifetime));
}