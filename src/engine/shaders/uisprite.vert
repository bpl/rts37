#ifdef GL_ES
precision highp float;
#endif

attribute vec2 vertexPosition;
attribute vec2 vertexTexCoord;

varying vec2 v_textureCoord;

void main(void) {
	gl_Position = vec4(vertexPosition, 0.0, 1.0);
	v_textureCoord = vertexTexCoord;
}