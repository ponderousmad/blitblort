var LINEAR = (function () {
    "use strict";
    
    var linear = {},
        COLINEAR_TOLERANCE = 1e-5;

    function Vec(x, y) {
        this.x = x;
        this.y = y;
    }
    
    linear.Vec = Vec;

    Vec.prototype.clone = function () {
        return new Vec(this.x, this.y);
    };

    Vec.prototype.set = function (x, y) {
        this.x = x;
        this.y = y;
    };

    Vec.prototype.copy = function (v) {
        this.x = v.x;
        this.y = v.y;
    };

    Vec.prototype.add = function (v) {
        this.x += v.x;
        this.y += v.y;
    };

    Vec.prototype.addScaled = function (v, s) {
        this.x += v.x * s;
        this.y += v.y * s;
    };

    Vec.prototype.sub = function (v) {
        this.x -= v.x;
        this.y -= v.y;
    };

    Vec.prototype.scale = function (s) {
        this.x *= s;
        this.y *= s;
    };

    Vec.prototype.lengthSq = function () {
        return this.x * this.x + this.y * this.y;
    };

    Vec.prototype.length = function () {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    };

    Vec.prototype.normalize = function () {
        var length = this.length();
        this.x /= length;
        this.y /= length;
    };
    
    Vec.prototype.dot = function (v) {
        return this.x * v.x + this.y * v.y;
    };
    
    Vec.prototype.toString = function () {
        return "(" + this.x + ", " + this.y + ")";
    };

    linear.scaleVector = function (p, s) {
        return new Vec(p.x * s, p.y * s);
    };

    linear.addVectors = function (a, b) {
        return new Vec(a.x + b.x, a.y + b.y);
    };

    function subVectors(a, b) {
        return new Vec(a.x - b.x, a.y - b.y);
    }
    linear.subVectors = subVectors;

    linear.pointDistanceSq = function (a, b) {
        var xDiff = a.x - b.x,
            yDiff = a.y - b.y;
        return xDiff * xDiff + yDiff * yDiff;
    };

    linear.pointDistance = function (a, b) {
        return Math.sqrt(linear.pointDistanceSq(a, b));
    };

    linear.vectorNormalize = function (v) {
        var length = v.length();
        return new Vec(v.x / length, v.y / length);
    };

    linear.angleToVector = function (angle) {
        return new Vec(Math.cos(angle), Math.sin(angle));
    };

    linear.parseVector = function (data) {
        return new Vec(parseFloat(data.x), parseFloat(data.y));
    };

    linear.clampAngle = function (angle) {
        while (angle < -Math.PI) {
            angle += 2 * Math.PI;
        }

        while (angle > Math.PI) {
            angle -= 2 * Math.PI;
        }
        return angle;
    };

    function tolEqual(a, b, tol) {
        return Math.abs(a - b) <= tol;
    }
    linear.tolEqual = tolEqual;

    function relEqual(a, b, tol) {
        tol *= Math.max(Math.abs(a), Math.abs(b));
        return tolEqual(a, b, tol);
    }
    linear.relEqual = relEqual;

    linear.vectorRelEqual = function (a, b, tol) {
        tol *= Math.max(Math.max(Math.abs(a.x), Math.abs(b.x)), Math.max(Math.abs(a.y), Math.abs(b.y)));
        return tolEqual(a.x, b.x, tol) && tolEqual(a.y, b.y, tol);
    };
    
    function determinant(v1, v2) {
        return v1.x * v2.y - v1.y * v2.x;
    }
    linear.determinant = determinant;

    function checkAligned(v1, v2, tolerance) {
        return tolEqual(determinant(v1, v2), 0, tolerance);
    }
    linear.checkAligned = checkAligned;
    
    linear.angle = function (v1, v2) {
        return Math.acos(v1.dot(v2) / (v1.length() * v2.length()));
    };

    linear.linesIntersectPD = function (start1, d1, start2, d2) {
        if (checkAligned(d1, d2, COLINEAR_TOLERANCE)) {
            return checkAligned(d1, subVectors(start1, start2), COLINEAR_TOLERANCE);
        }
        return true;
    };
    
    linear.linesIntersectPP = function (start1, end1, start2, end2) {
        return linear.linesIntersectPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2));
    };
    
    linear.intersectLinesPD = function (start1, d1, start2, d2, intersection) {
        var between = subVectors(start1, start2),
            denom = determinant(d1, d2);
            
        intersection.copy(start1);
        if (tolEqual(denom, 0, COLINEAR_TOLERANCE)) {
            return checkAligned(d1, between, COLINEAR_TOLERANCE);
        }

        intersection.addScaled(d1, determinant(d2, between) / denom);
        return true;
    };
    
    linear.intersectLinesPP = function (start1, end1, start2, end2, intersection) {
        return linear.intersectLinesPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2), intersection);
    };
    
    function inSegment(parameter) {
        return (0 <= parameter && parameter <= 1);
    }

    linear.inSegmentPD = function (start, direction, point) {
        var diffX = point.x - start.x,
            diffY = point.y - start.y;
        if (diffX !== 0) {
            return inSegment(diffX / direction.x);
        } else if (diffY !== 0) {
            return inSegment(diffY / direction.y);
        }
        return false;
    };
    
    linear.segmentsIntersectPDT = function (start1, d1, start2, d2, tolerance) {
        var between = subVectors(start1, start2),
            denom = determinant(d1, d2);

        if (tolEqual(denom, 0, tolerance)) {
            // Lines are parallel, can't intersect, but may overlap.
            if (!checkAligned(d1, between, tolerance)) {
                return false;
            }

            // There is overlap if the start or end of segment 2 is in segment 1, or if segment 2 contains all of segment 1.
            return linear.inSegmentPD(start1, d1, start2) || linear.inSegmentPD(start1, d1, start2 + d2) || linear.inSegmentPD(start2, d2, start1);
        }

        return inSegment(determinant(d1, between) / denom) &&
               inSegment(determinant(d2, between) / denom);
    };
    
    linear.segmentsIntersectPD = function (start1, d1, start2, d2) {
        return linear.segmentsIntersectPDT(start1, d1, start2, d2, COLINEAR_TOLERANCE);
    };
    
    linear.segmentsIntersectPPT = function (start1, end1, start2, end2, tolerance) {
        return linear.segmentsIntersectPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2), tolerance);
    };
    
    linear.segmentsIntersectPP = function (start1, end1, start2, end2) {
        return linear.segmentsIntersectPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2), COLINEAR_TOLERANCE);
    };
    
    linear.intersectSegmentsPDT = function (start1, d1, start2, d2, intersection, tolerance) {
        var between = subVectors(start1, start2),
            denom = determinant(d1, d2);

        intersection.copy(start1);
        if (tolEqual(denom, 0, tolerance)) {
            // Lines are parallel, can't intersect, but may overlap.
            if (!checkAligned(d1, between, tolerance)) {
                return false;
            }

            // There is overlap if the start or end of segment 2 is in segment 1, or if segment 2 contains all of segment 1.
            if (linear.inSegmentPD(start1, d1, start2)) {
                intersection.copy(start2);
                return true;
            }
            if (linear.inSegmentPD(start1, d1, linear.addVectors(start2, d2))) {
                intersection.copy(start2);
                intersection.add(d2);
                return true;
            }

            if (linear.inSegmentPD(start2, d2, start1)) {
                return true;
            }
            return false;
        }

        var t1 = determinant(d2, between) / denom,
            t2 = determinant(d1, between) / denom;
        intersection.addScaled(d1, t1);
        return inSegment(t1) && inSegment(t2);
    };
    
    linear.intersectSegmentsPD = function (start1, d1, start2, d2, intersection) {
        return linear.intersectSegmentsPDT(start1, d1, start2, d2, intersection, COLINEAR_TOLERANCE);
    };
    
    linear.intersectSegmentsPPT = function (start1, end1, start2, end2, intersection, tolerance) {
        return linear.intersectSegmentsPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2), intersection, tolerance);
    };
    
    linear.intersectSegmentsPP = function (start1, end1, start2, end2, intersection) {
        return linear.intersectSegmentsPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2), intersection, COLINEAR_TOLERANCE);
    };
    
    function Segment(a, b, c, d) {
        if (isNaN(a)) {
            this.start = a;
            this.end = b;
        } else {
            this.start = new Vec(a, b);
            this.end = new Vec(c, d);
        }
    }
    
    Segment.prototype.direction = function () {
        var dir = subVectors(this.end, this.start);
        dir.normalize();
        return dir;
    };
    
    Segment.prototype.normal = function () {
        var dir = this.direction();
        dir.set(-dir.y, dir.x);
        return dir;
    };
    
    Segment.prototype.directedNormal = function () {
        var normal = this.normal();
        if (determinant(this.direction(), normal) >= 0) {
            normal.scale(-1);
        }
        return normal;
    };
    
    Segment.prototype.length = function () {
        return linear.pointDistance(this.end, this.start);
    };
    
    Segment.prototype.intersects = function (other) {
        return linear.segmentsIntersectPP(this.start, this.end, other.start, other.end);
    };
    
    Segment.prototype.intersectsT = function (other, tolerance) {
        return linear.segmentsIntersectPPT(this.start, this.end, other.start, other.end, tolerance);
    };
    
    Segment.prototype.findIntersection = function (other, intersection) {
        return linear.intersectSegmentsPP(this.start, this.end, other.start, other.end, intersection);
    };
    
    Segment.prototype.findIntersectionT = function (other, tolerance, intersection) {
        return linear.intersectSegmentsPPT(this.start, this.end, other.start, other.end, tolerance, intersection);
    };
    
    Segment.prototype.extendAtStart = function (length) {
        var s = this.start.clone();
        s.addScaled(this.direction(), -length);
        return new Segment(s, this.end);
    };
    
    Segment.prototype.extendAtEnd = function (length) {
        var e = this.end.clone();
        e.addScaled(this.direction(), length);
        return new Segment(this.start, e);
    };

    Segment.prototype.extendBoth = function (length) {
        var s = this.start.clone(),
            e = this.end.clone(),
            dir = this.direction();
        s.addScaled(dir, -length);
        e.addScaled(dir, length);
        return new Segment(s, e);
    };

    Segment.prototype.shift = function (offset) {
        var s = this.start.clone(),
            e = this.end.clone();
        s.add(offset);
        e.add(offset);
        return new Segment(s, e);
    };
    
    Segment.prototype.closestPoint = function (center) {
        var closest = new Vec(0, 0),
            normal = this.normal(),
            dir = this.direction();
        if (!linear.intersectLinesPD(this.start, dir, center, normal, closest)) {
            // Degenerate line segment.
            return { point: this.start, atEnd: true };
        }
        // Is the closest point inside the line segment?
        var fromStart = linear.subVectors(closest, this.start),
            fromEnd = linear.subVectors(closest, this.end);
        if (fromStart.dot(dir) >= 0 && fromEnd.dot(dir) < 0) {
            return { point: closest, atEnd: false };
        }
        if (linear.pointDistanceSq(center, this.start) < linear.pointDistanceSq(center, this.end)) {
            return { point: this.start, atEnd: true };
        } else {
            return { point: this.end, atEnd: true };
        }
    };
    
    linear.Segment = Segment;
    
    var AABox = function (left, top, width, height) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
        this.right = left + width;
        this.bottom = top + height;
    };
    
    AABox.prototype.contains = function (p) {
        return this.left <= p.x && p.x <= this.right && this.top <= p.y && p.y <= this.bottom;
    };
    
    AABox.prototype.inflated = function (w, h) {
        return new AABox(this.left - w, this.top - h, this.width + 2 * w, this.height + 2 * h);
    };
    
    linear.AABox = AABox;
    
    linear.ZERO = new Vec(0, 0);
    
    function testSuite() {
        var vecTests = [
        ];
        
        TEST.run("Vector", vecTests);
    }
    linear.testSuite = testSuite;
    
    return linear;
}());
