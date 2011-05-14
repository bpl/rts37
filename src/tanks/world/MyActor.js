//////////////
// MyActor //
////////////

define(['engine/world/Actor'], function (Actor) {

	inherits(MyActor, Actor);
	function MyActor(opt /* x, y */) {
		Actor.prototype.constructor.call(this, opt.x, opt.y);
	}

	return MyActor;

});