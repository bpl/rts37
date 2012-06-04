// Copyright © 2012 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

define(['engine/util', 'engine/util/Event', 'engine/world/Player', 'engine/world/Map', 'engine/world/UnitType'], function (util, Event, Player, Map, UnitType) {

	const STATE_WAITING = 0;
	const STATE_LOADING_DOCUMENT = 1;
	const STATE_LOADING_ASSETS = 2;
	const STATE_READY = 3;

	// Scenario will call these members of the delegate, in this order:
	//
	// - addPlayer(player:Player)
	// - setMap(map:Map)
	// - addUnitType(unitTypeName:string, unitType:UnitType)
	// - createUnit(unitType:object, opt:object)
	// - setLocalPlayerId(actorId:number)
	//
	// Scenario will also report asset loading progress by using these named
	// global events:
	//
	// - willLoadAsset(assetName:string, queued:number, loaded:number)
	// - didLoadAsset(assetName:string, queued:number, loaded:number)
	// - didLoadAllAssets(loaded:number)

	function Scenario(delegate) {
		util.assert(typeof delegate === 'object' && delegate != null, 'Scenario: delegate is not an object');

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
		util.assert(this.state === STATE_WAITING, 'Scenario.load: scenario is already known');
		util.assert(typeof gameSpec === 'object' && gameSpec != null, 'Scenario.load: gameSpec must be an object');
		util.assert(typeof gameSpec['scenarioLocation'] === 'string', 'Scenario.load: scenario location must be a non-empty string');
		util.assert(typeof gameSpec['scenarioName'] === 'string', 'Scenario.load: scenario reference must be a non-empty string');
		util.assert(gameSpec['players'] != null && gameSpec['players'].length > 0, 'Scenario.load: Players must be specified');
		util.assert(localPlayerId > 0 && typeof localPlayerId === 'number', 'Scenario.load: local player ID must be a positive number');
		this.state = STATE_LOADING_DOCUMENT;

		var players = gameSpec['players'];
		for (var i = 0; i < players.length; ++i) {
			this.delegate.addPlayer(new Player(players[i]));
		}

		require(['engine/util/json!' + gameSpec['scenarioLocation']], function (scenarioDocument) {
			// FIXME: Optionally report this type of errors back to the server
			util.assert(gameSpec['scenarioName'] in scenarioDocument, 'Scenario.load: scenario not found in scenario document');
			this.loadAssets(scenarioDocument[gameSpec['scenarioName']], localPlayerId);
		}.bind(this));
	};

	Scenario.prototype.loadAssets = function (scenario, localPlayerId) {
		util.assert(this.state < STATE_LOADING_ASSETS, 'Scenario.loadAssets: asset loading has already started');
		this.state = STATE_LOADING_ASSETS;

		var unitTypes = new util.Map();

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
			this.delegate.setMap(map);
			didLoadAsset.call(this, mapImageLocation);
			didLoadAsset.call(this, groundTextureImageLocation);
		}.bind(this));

		// Load and create unit types
		var unitTypeSpecs = scenario['unitTypes'];
		for (var key in unitTypeSpecs) {
			if (util.hop(unitTypeSpecs, key)) {
				var unitTypeSpec = unitTypeSpecs[key];
				// Here we are assuming that the scenario file is from a trusted source
				// TODO: Maybe allow scenarios but not classes from an untrusted source
				// TODO: Use let to fix the parameters when it is more widely supported
				(function (key, unitTypeSpec) {
					var unitClassName = unitTypeSpec['class'];
					willLoadAsset.call(this, unitClassName);
					require([unitClassName], function (unitClass) {
						var unitType = new UnitType(unitClass, unitTypeSpec);
						this.delegate.addUnitType(key, unitType);
						unitTypes.set(key, unitType);
						didLoadAsset.call(this, unitClassName);
					}.bind(this));
				}.call(this, key, unitTypeSpec));
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
				var unitType = unitTypes.get(unitTypeName);
				util.assert(unitType, 'Scenario.loadAssets: Unknown unit type ' + unitTypeName);
				this.delegate.createUnit(unitType, unitSpec);
			}

			// Set the local player
			this.delegate.setLocalPlayerId(localPlayerId);

			this.state = STATE_READY;
		}
	};

	return Scenario;

})