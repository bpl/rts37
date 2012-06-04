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

define(function () {

	var mathlib = {};

	mathlib.HALF_PI = Math.PI / 2;

	// Calculates the angle between two points. The result is in radians, as follows:
	//          0
	//          |
	// 3/2 PI --a-- 1/2 PI
	//          |
	//         PI
	mathlib.angle = function (ax, ay, bx, by) {
		return Math.atan2(-(ax - bx), ay - by);
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
		return [distance * Math.sin(rad), distance * -Math.cos(rad)];
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
		var dx = ax - bx;
		var dy = ay - by;
		return Math.sqrt(dx * dx + dy * dy);
	};

	// Like distance, but takes two {x, y} objects instead
	mathlib.distanceObj = function (a, b) {
		var dx = a.x - b.x;
		var dy = a.y - b.y;
		return Math.sqrt(dx * dx + dy * dy);
	};

	// Calculates the approximate distance between two points
	mathlib.distanceApprox = function (ax, ay, bx, by) {
		return Math.abs(ax - bx) + Math.abs(ay - by);
	};

	mathlib.manhattanDistance = mathlib.distanceApprox;

	// Ensures that v lies within [min, max] by returning min if v < min, max if
	// v > max, and v otherwise.
	mathlib.constrain = function (v, min, max) {
		if (v < min) {
			return min;
		}
		if (v > max) {
			return max;
		}
		return v;
	};

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

	////////////////////////////////////////
	// Geometric primitives and routines //
	//////////////////////////////////////

	// Inlining helpers, adapted from Brandon Jones' GLMatrix

	function normalize(x, y, z) {
		var len = 1 / Math.sqrt(x*x + y*y + z*z);
		x *= len;
		y *= len;
		z *= len;
		return [x, y, z];
	}

	function cross(x1, y1, z1, x2, y2, z2) {
		var x = y1*z2 - z1*y2;
		var y = z1*x2 - x1*z2;
		var z = x1*y2 - y1*x2;
		return [x, y, z];
	}

	/**
	 * @lends Plane
	 */
	mathlib.Plane = {

		/**
		 * Constructs a new three-dimensional plane. The plane is represented as
		 * parameters to the generalized planed equation.
		 * @param {Plane} [plane] Plane to copy the contents from
		 * @constructs
		 */
		create: function (plane) {
			var dest = new Float32Array(4);

			if (plane) {
				dest[0] = plane[0];
				dest[1] = plane[1];
				dest[2] = plane[2];
				dest[3] = plane[3];
			}

		    return dest;
		},

		/**
		 * Creates a plane defined by three points on the plane. The result will
		 * be written to an existing Plane object or optionally to a new Plane
		 * object.
		 * @param {number} x1
		 * @param {number} y1
		 * @param {number} z1
		 * @param {number} x2
		 * @param {number} y2
		 * @param {number} z2
		 * @param {number} x3
		 * @param {number} y3
		 * @param {number} z3
		 * @param {Plane} [dest]
		 * @returns {Plane} dest or a new plane object
		 */
		fromPoints: function (x1, y1, z1, x2, y2, z2, x3, y3, z3, dest) {
			if (!dest) {
				dest = new Float32Array(4);
			}

			// The math is from Essential Mathematics for Games & Interactive
			// Application (2nd ed.), p. 81-82.

			// Given points P, Q, R on the plane

		    // u = Q - P
			var ux = x2 - x1;
			var uy = y2 - y1;
			var uz = z2 - z1;

			// v = R - P
			var vx = x3 - x1;
			var vy = y3 - y1;
			var vz = z3 - z1;

			// n = cross(u, v)
			var a = uy*vz - uz*vy;
			var b = uz*vx - ux*vz;
			var c = ux*vy - uy*vx;

			// normalize(n)
			var len = 1 / Math.sqrt(a*a + b*b + c*c);
			a *= len;
			b *= len;
			c *= len;

			dest[0] = a;
			dest[1] = b;
			dest[2] = c;
			dest[3] = -(a*x1 + b*y1 + c*z1);

			return dest;
		},

		/**
		 * Creates a plane defined by three points on the plane. The result will
		 * be written to an existing Plane object or optionally to a new Plane
		 * object.
		 * @param {Vec3} p1
		 * @param {Vec3} p2
		 * @param {Vec3} p3
		 * @param {Plane} [dest]
		 * @returns {Plane} dest or a new plane object
		 */
		fromPointsVec3: function (p1, p2, p3, dest) {
			return this.fromPoints(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2], dest);
		},

		/**
		 * Distance from a plane to a point. The sign of the result tells which
		 * side of the plane the point lies. 0 means that the point lies on the
		 * plane. Use Math.abs() to get absolute distance if that is what you
		 * need.
		 * @param {Plane} plane
		 * @param {number} px
		 * @param {number} py
		 * @param {number} pz
		 * @returns {number} Distance from the point to the plane, with the sign indicating which side of the plane the point lies.
		 */
		pointTest: function (plane, px, py, pz) {
			// ax + by + cz + d
			return plane[0]*px + plane[1]*py + plane[2]*pz + plane[3];
		},

		/**
		 * Distance from a plane to a point. The sign of the result tells which
		 * side of the plane the point lies. 0 means that the point lies on the
		 * plane. Use Math.abs() to get absolute distance if that is what you
		 * need.
		 * @param {Plane} plane
		 * @param {Vec3} point
		 * @returns {number} Distance from the point to the plane, with the sign indicating which side of the plane the point lies.
		 */
		pointTestVec3: function (plane, point) {
			// ax + by + cz + d
			return plane[0]*point[0] + plane[1]*point[1] + plane[2]*point[2] + plane[3];
		},

		getX: function (plane, y, z) {
			return (-plane[1]*y + -plane[2]*z - plane[3]) / plane[0];
		},

		getY: function (plane, x, z) {
			return (-plane[0]*x + -plane[2]*z - plane[3]) / plane[1];
		},

		getZ: function (plane, x, y) {
			return (-plane[0]*x + -plane[1]*y - plane[3]) / plane[2];
		}

	};

	return mathlib;

});