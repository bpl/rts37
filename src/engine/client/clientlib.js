// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(
	[
		'engine/client/Button',
		'engine/client/Client',
		'engine/client/Connection',
		'engine/client/Viewport',
		'engine/client/Widget'
	],
	function (
		Button,
		Client,
		Connection,
		Viewport,
		Widget
	) {
		return {
			'Button': Button,
			'Client': Client,
			'Connection': Connection,
			'Viewport': Viewport,
			'Widget': Widget
		};
	}
);