#ifdef GL_ES
precision highp float;
#endif

attribute vec2 textureCoord;

uniform sampler2D spriteTex;

void main(void) {
	gl_FragColor = texture2D(spriteTex, textureCoord);
}