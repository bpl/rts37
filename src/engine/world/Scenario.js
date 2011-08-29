// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util/Event', 'engine/world/Player', 'engine/world/Map'], function (Event, Player, Map) {

	const STATE_WAITING = 0;
	const STATE_LOADING_DOCUMENT = 1;
	const STATE_LOADING_ASSETS = 2;
	const STATE_READY = 3;

	// Scenario will call these members of the delegate, in this order:
	//
	// - addPlayer(player:Player)
	// - setMap(map:Map)
	// - addUnitType(unitTypeName:string, unitType:class of Actor)
	// - createActor(type:object, opt:object)
	// - setLocalPlayerId(actorId:number)
	//
	// Scenario will also report asset loading progress by using these named
	// global events:
	//
	// - willLoadAsset(assetName:string, queued:number, loaded:number)
	// - didLoadAsset(assetName:string, queued:number, loaded:number)
	// - didLoadAllAssets(loaded:number)

	function Scenario(delegate) {
		assert(typeof delegate === 'object' && delegate != null, 'Scenario: delegate is not an object');

		this.delegate = delegate;

		this.state = STATE_WAITING;
		this.assetsQueued = 0;
		this.assetsLoaded = 0;
		this.everythingQueued = false;
		this.everythingLoaded = false;

		this.willLoadAsset = new Event('willLoadAsset');
		this.didLoadAsset = new Event('didLoadAsset');
		this.didLoadAllAssets = new Event('didLoadAllAssets');
	}

	Scenario.prototype.load = function (gameSpec, localPlayerId) {
		assert(this.state === STATE_WAITING, 'Scenario.load: scenario is already known');
		assert(typeof gameSpec === 'object' && gameSpec != null, 'Scenario.load: gameSpec must be an object');
		assert(typeof gameSpec['scenarioLocation'] === 'string', 'Scenario.load: scenario location must be a non-empty string');
		assert(typeof gameSpec['scenarioName'] === 'string', 'Scenario.load: scenario reference must be a non-empty string');
		assert(gameSpec['players'] != null && gameSpec['players'].length > 0, 'Scenario.load: Players must be specified');
		assert(localPlayerId > 0 && typeof localPlayerId === 'number', 'Scenario.load: local player ID must be a positive number');
		this.state = STATE_LOADING_DOCUMENT;

		var players = gameSpec['players'];
		for (var i = 0; i < players.length; ++i) {
			this.delegate.addPlayer(new Player(players[i]));
		}

		var that = this;
		require(['engine/util/json!' + gameSpec['scenarioLocation']], function (scenarioDocument) {
			// FIXME: Optionally report this type of errors back to the server
			assert(gameSpec['scenarioName'] in scenarioDocument, 'Scenario.load: scenario not found in scenario document');
			that.loadAssets(scenarioDocument[gameSpec['scenarioName']], localPlayerId);
		});
	};

	Scenario.prototype.loadAssets = function (scenario, localPlayerId) {
		assert(this.state < STATE_LOADING_ASSETS, 'Scenario.loadAssets: asset loading has already started');
		this.state = STATE_LOADING_ASSETS;

		var that = this;
		var unitTypes = {};

		// Load and create the map
		var mapImageLocation = scenario['map']['mapImage'];
		var groundTextureImageLocation = scenario['map']['groundTextureImage'];
		willLoadAsset.call(this, mapImageLocation);
		willLoadAsset.call(this, groundTextureImageLocation);
		require([
			'engine/util/Image!' + mapImageLocation,
			'engine/util/Image!' + groundTextureImageLocation
		], function (mapImage, groundTextureImage) {
			var map = new Map(mapImage, groundTextureImage);
			that.delegate.setMap(map);
			didLoadAsset.call(that, mapImageLocation);
			didLoadAsset.call(that, groundTextureImageLocation);
		});

		// Load and create unit types
		var unitTypeSpecs = scenario['unitTypes'];
		for (var key in unitTypeSpecs) {
			if (Object.prototype.hasOwnProperty.call(unitTypeSpecs, key)) {
				var unitTypeSpec = unitTypeSpecs[key];
				var unitClass = unitTypeSpec['class'];
				// Here we are assuming that the scenario file is from a trusted source
				// TODO: Maybe allow scenarios but not classes from an untrusted source
				// TODO: Use bind or let to fix parameters
				(function (key, unitClass) {
					willLoadAsset.call(that, unitClass);
					require([unitClass], function (unitType) {
						that.delegate.addUnitType(key, unitType);
						unitTypes[key] = unitType;
						didLoadAsset.call(that, unitClass);
					});
				}(key, unitClass));
			}
		}

		this.everythingQueued = true;
		checkEverythingLoaded.call(this);

		function willLoadAsset(assetName) {
			++this.assetsQueued;

			this.willLoadAsset.emit(assetName, this.assetsQueued, this.assetsLoaded);
		}

		function didLoadAsset(assetName) {
			++this.assetsLoaded;

			this.didLoadAsset.emit(assetName, this.assetsQueued, this.assetsLoaded);

			checkEverythingLoaded.call(this);
		}

		function checkEverythingLoaded() {
			if (this.everythingQueued && this.assetsLoaded === this.assetsQueued) {
				// Initialize the world when all assets have been loaded
				didLoadEverything.call(this);
				// Let the progress delegate know that all assets have been
				// downloaded.
				this.everythingLoaded = true;
				this.didLoadAllAssets.emit(this.assetsLoaded);
			}
		}

		function didLoadEverything() {
			// Create starting units
			var startingUnits = scenario['startingUnits'];
			for (var i = 0; i < startingUnits.length; ++i) {
				var unitSpec = startingUnits[i];
				var unitTypeName = unitSpec['$type'];
				assert(Object.prototype.hasOwnProperty.call(unitTypes, unitTypeName), 'Scenario.loadAssets: Unknown unit type ' + unitTypeName);
				this.delegate.createActor(unitTypes[unitTypeName], unitSpec);
			}

			// Set the local player
			this.delegate.setLocalPlayerId(localPlayerId);

			this.state = STATE_READY;
		}
	};

	return Scenario;

})