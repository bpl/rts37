#ifdef GL_ES
precision highp float;
#endif

varying vec2 v_textureCoord;

uniform sampler2D spriteTexture;

void main(void) {
	gl_FragColor = texture2D(spriteTexture, v_textureCoord);
}