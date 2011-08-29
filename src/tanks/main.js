// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

// Bootstrap

define(['jquery', 'engine/client/clientlib', 'tanks/MyViewport', 'tanks/world/MyGame'], function ($, clientlib, MyViewport, MyGame) {

	var Button = clientlib.Button,
		Client = clientlib.Client,
		Connection = clientlib.Connection;

	function initGame(isLocal) {
		var splash = document.getElementById('splash');
		var canvas = document.getElementById('screen');
		var performanceIndicator = document.getElementById('performance');

		splash.parentNode.removeChild(splash);
		assert(canvas, 'initGame: canvas not found');
		var game = new MyGame(isLocal);
		game.setTicksPerSecond(5);
		game.setCappedToFps(30);
		var client = new Client(game, canvas);

		// User interface controls

		var viewport = new MyViewport(client, {
			'x': 0, 'y': 0,
			'width': 500, 'height': 500
		});
		client.add(viewport);

		client.onDraw.register(function () {
			performanceIndicator.firstChild.nodeValue =
					'permitted ' + game.lastPermittedTick +
					', processed ' + game.lastProcessedTick +
					', sinceTick ' + padToThree(game.msecsSinceTick) +
					', sinceDrawn ' + padToThree(client.msecsSinceDrawn);
		});

		/*
		var testButton = new Button(client, {
			'width': 40, 'height': 40,
			'caption': 'Test',
			'callback': function () {
				alert('Leave me alone!');
			}
		});
		client.add(testButton);
		*/

		// Resize canvas and viewport to match window size

		client.onresizewindow = function (evt) {
			var nw = window.innerWidth;
			var nh = window.innerHeight;
			canvas.width = nw;
			canvas.height = nh;
			viewport.resize(nw, nh);
//			testButton.move(10, nh - testButton.height - 10);
		};
		client.onresizewindow();

		// Pollute the global scope for debugging purposes
		// TODO: Come up with a cleaner way to surface these
		gGame = game;
		gClient = client;
		gViewport = viewport;

		return game;
	}

	require.ready(function () {

		$('.tabs a').live('click', function (evt) {
			var $this = $(this);
			var $tabs = $this.closest('.tabs');
			if (!$tabs.length) {
				return;
			}
			evt.preventDefault();
			if ($this.hasClass('selected')) {
				return;
			}
			$tabs.find('li').each(function (idx, elm) {
				var sheet = document.getElementById(this.firstChild.href.match(/#(.*)$/)[1]);
				if (sheet) {
					$(this).toggleClass('selected', this.firstChild === evt.target);
					$(sheet).toggleClass('hidden', this.firstChild !== evt.target);
				}
			});
		});

		$('#create-remote-game').click(function () {
			var gameSpecString = $('#f-create-spec').val();
			var gameId = $('#f-create-gameId').val();
			var playerId = $('#f-create-playerId').val();
			var game = initGame(false);
			var connection = new Connection(game, 'ws://localhost:8000/?game=' + escape(gameId) + '&player=' + escape(playerId) + '&spec=' + escape(gameSpecString));
			connection.setLogging(true);
			game.setConnection(connection);
		});

		$('#join-remote-game').click(function () {
			var gameId = $('#f-join-gameId').val(),
				playerId = $('#f-join-playerId').val(),
				game = initGame(false),
				connection = new Connection(game, 'ws://localhost:8000/?game=' + escape(gameId) + '&player=' + escape(playerId));
			connection.setLogging(true);
			game.setConnection(connection);
		});

		$('#start-local-game').click(function () {
			var gameSpecString = $('#f-local-spec').val();
			var playerIdString = $('#f-local-playerId').val();
			try {
				var gameSpec = JSON.parse(gameSpecString);
			} catch (e) {
				alert('Parse error in initial game state. Check console for details.');
				throw e;
			}
			var game = initGame(true);
			game.loadScenario(gameSpec, Number(playerIdString));
		});

	});

});