define(function () {

	var mathlib = {};

	mathlib.HALF_PI = Math.PI / 2;

	// Calculates the angle between two points. The result is in radians, as follows:
	//        1/2 PI
	//          |
	//    PI  --a--  0
	//          |
	//       -1/2 PI
	// FIXME: The diagram may be incorrect. The results are between -PI and +PI
	mathlib.angleRaw = function (ax, ay, bx, by) {
		return Math.atan2(by - ay, bx - ax);
	};

	// Calculates the angle between two points. The result is in radians, as follows:
	//          0
	//          |
	// 3/2 PI --a-- 1/2 PI
	//          |
	//         PI
	mathlib.angle = function (ax, ay, bx, by) {
		return mathlib.normalizeAngle(Math.atan2(ay - by, ax - bx) - Math.PI / 2);
	};

	// Rotates a point
	mathlib.rotate = function (px, py, rad, ox, oy) {
		return [(px - ox) * Math.cos(rad) - (py - oy) * Math.sin(rad),
			(px - ox) * Math.sin(rad) + (py - oy) * Math.cos(rad)];
	};

	// Calculates a point certain distance and angle from origo. The angle is specified
	// in radians, as follows:
	//          0
	//          |
	// 3/2 PI --a-- 1/2 PI
	//          |
	//         PI
	// See http://www.cgafaq.info/wiki/2D_Point_Rotation
	mathlib.anglePoint = function (rad, distance) {
		rad += Math.PI / 2;
		return [-1 * distance * Math.cos(rad), -1 * distance * Math.sin(rad)];
	};

	// Converts an angle expressed in radians to range [ 0, 2 PI [
	mathlib.normalizeAngle = function (rad) {
		while (rad < 0) {
			rad += Math.PI * 2;
		}
		while (rad >= Math.PI * 2) {
			rad -= Math.PI * 2;
		}
		return rad;
	};

	// Calculates the difference between two angles. The result is expressed radians,
	// as follows:
	//           0
	//           |
	// -1/2 PI --1-- 1/2 PI
	//           |
	//          PI
	mathlib.angleDelta = function (rad1, rad2) {
		var angleDelta = rad2 - rad1;
		if (angleDelta > Math.PI) {
			angleDelta -= Math.PI * 2;
		} else if (angleDelta < -Math.PI) {
			angleDelta += Math.PI * 2;
		}
		return angleDelta;
	};

	mathlib.isInsideArc = function (arcStart, arcWidth, angle) {
		// FIXME: Does this work in all cases?
		return angle >= arcStart && angle < arcStart + arcWidth;
	};

	// Multiply an angle in radians by this to convert it to degrees
	mathlib.RAD_TO_DEG = 180 / Math.PI;

	// Multiply an angle in degrees by this to convert it to radians
	mathlib.DEG_TO_RAD = Math.PI / 180;

	// Calculates the distance between two points
	mathlib.distance = function (ax, ay, bx, by) {
		return Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));
	};

	// Calculates the approximate distance between two points
	mathlib.distanceApprox = function (ax, ay, bx, by) {
		return Math.abs(ax - bx) + Math.abs(ay - by);
	};

	mathlib.manhattanDistance = mathlib.distanceApprox;

	/////////////////////////////
	// Fixed point arithmetic //
	///////////////////////////

	// Functions for working with fixed point numbers having scaling factor of 1/1024. Using fixed
	// point is necessary for maintaining cross-platform compatibility.
	//
	// Tips and tricks
	//
	// Division and multiplication discarding the remainder, if x is an integer:
	// x / 1024 ~= x >> 10
	// x * 1024 ~= x << 10
	//
	// Removing the decimal part without a call to Math.*:
	// x >> 0

	mathlib.mul = function (a, b) {
		// FIXME: Check precedence
		return a * b >> 10;
	};

	mathlib.div = function (a, b) {
		// Here we need to use Math.round, because that gives us the best probability for
		// getting the same final result on all platforms. FIXME: Really?
		// FIXME: Check precedence
		return Math.round(a << 10 / b);
	};

	//////////
	// Vec //
	////////

	function Vec(x, y) {
		this.x = x || 0;
		this.y = y || 0;
	}

	mathlib.Vec = Vec;

	return mathlib;

});