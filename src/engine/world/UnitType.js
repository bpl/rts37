// Copyright © 2011 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted

define(['engine/util', 'engine/world/GroundMovement'], function (util, GroundMovement) {

	var DEFAULT_GROUND_MOVEMENT = new GroundMovement();

	function UnitType(unitClass, opt) {
		this.unitClass = unitClass;
		this.movement = opt.movement || DEFAULT_GROUND_MOVEMENT;
		this.speed = opt.speed || 30 * 1024;
		this.rotationSpeed = opt.rotationSpeed || 3;
		this.firingRadius = opt.firingRadius || 300 * 1024;
		this.collisionRadius = opt.collisionRadius || 20 * 1024;
	}

	return UnitType;

});