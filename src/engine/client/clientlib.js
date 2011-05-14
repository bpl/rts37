define(
	[
		'engine/client/Button',
		'engine/client/Client',
		'engine/client/Connection',
		'engine/client/PerformanceIndicator',
		'engine/client/Viewport',
		'engine/client/Widget'
	],
	function (
		Button,
		Client,
		Connection,
		PerformanceIndicator,
		Viewport,
		Widget
	) {
		return {
			'Button': Button,
			'Client': Client,
			'Connection': Connection,
			'PerformanceIndicator': PerformanceIndicator,
			'Viewport': Viewport,
			'Widget': Widget
		};
	}
);