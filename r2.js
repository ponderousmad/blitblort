var R2 = (function () {
    "use strict";

    let r2 = {},
        COLINEAR_TOLERANCE = 1e-5;
    r2.DEG_TO_RAD = Math.PI / 180;
    r2.RAD_TO_DEG = 1 / r2.DEG_TO_RAD;
    r2.QUARTER_TURN = Math.PI / 2;
    r2.HALF_TURN = Math.PI / 2;
    r2.FULL_CIRCLE = 2 * Math.PI;

    class V extends Object {
        constructor(x, y) {
            super();
            this.x = x || 0;
            this.y = y || 0;
        }
        clone() {
            return new V(this.x, this.y);
        }

        set(x, y) {
            this.x = x;
            this.y = y;
        }

        copy(v) {
            this.x = v.x;
            this.y = v.y;
        }

        add(v) {
            this.x += v.x;
            this.y += v.y;
        }

        addScaled(v, s) {
            this.x += v.x * s;
            this.y += v.y * s;
        }

        sub(v) {
            this.x -= v.x;
            this.y -= v.y;
        }

        scale(s) {
            this.x *= s;
            this.y *= s;
        }

        scaled(s) {
            return new R2.V(this.x * s, this.y * s);
        }

        lengthSq() {
            return this.x * this.x + this.y * this.y;
        }

        length() {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        }

        normalize() {
            const length = this.length();
            this.x /= length;
            this.y /= length;
        }

        normalized() {
            const length = this.length();
            return new V(this.x / length, this.y / length);
        }

        dot(v) {
            return this.x * v.x + this.y * v.y;
        }

        cross(v) {
            return this.x * v.y - this.y * v.x;
        }

        interpolate(v, p) {
            return new V(
                this.x * (1 - p) + v.x * p,
                this.y * (1 - p) + v.y * p
            );
        }

        toString() {
            return "(" + this.x + ", " + this.y + ")";
        }
    }

    r2.V = V;

    r2.scaleVector = function (p, s) {
        return new V(p.x * s, p.y * s);
    };

    r2.addVectors = function (a, b) {
        return new V(a.x + b.x, a.y + b.y);
    };

    function subVectors(a, b) {
        return new V(a.x - b.x, a.y - b.y);
    }
    r2.subVectors = subVectors;

    r2.pointDistanceSq = function (a, b) {
        let xDiff = a.x - b.x,
            yDiff = a.y - b.y;
        return xDiff * xDiff + yDiff * yDiff;
    };

    r2.pointDistance = function (a, b) {
        return Math.sqrt(r2.pointDistanceSq(a, b));
    };

    r2.angleToVector = function (angle) {
        return new V(Math.cos(angle), Math.sin(angle));
    };

    r2.parseVector = function (data) {
        return new V(parseFloat(data.x), parseFloat(data.y));
    };

    r2.clamp = function (value, min, max) {
        return Math.min(max, Math.max(min, value));
    };

    r2.clampAngle = function (angle) {
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
    r2.tolEqual = tolEqual;

    function relEqual(a, b, tol) {
        tol *= Math.max(Math.abs(a), Math.abs(b));
        return tolEqual(a, b, tol);
    }
    r2.relEqual = relEqual;

    r2.vectorRelEqual = function (a, b, tol) {
        tol *= Math.max(Math.max(Math.abs(a.x), Math.abs(b.x)), Math.max(Math.abs(a.y), Math.abs(b.y)));
        return tolEqual(a.x, b.x, tol) && tolEqual(a.y, b.y, tol);
    };

    function determinant(v1, v2) {
        return v1.x * v2.y - v1.y * v2.x;
    }
    r2.determinant = determinant;

    function checkAligned(v1, v2, tolerance) {
        return tolEqual(determinant(v1, v2), 0, tolerance);
    }
    r2.checkAligned = checkAligned;

    r2.angle = function (v1, v2) {
        return Math.acos(v1.dot(v2) / (v1.length() * v2.length()));
    };

    r2.linesIntersectPD = function (start1, d1, start2, d2) {
        if (checkAligned(d1, d2, COLINEAR_TOLERANCE)) {
            return checkAligned(d1, subVectors(start1, start2), COLINEAR_TOLERANCE);
        }
        return true;
    };

    r2.linesIntersectPP = function (start1, end1, start2, end2) {
        return r2.linesIntersectPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2));
    };

    r2.intersectLinesPD = function (start1, d1, start2, d2, intersection) {
        let between = subVectors(start1, start2),
            denom = determinant(d1, d2);

        intersection.copy(start1);
        if (tolEqual(denom, 0, COLINEAR_TOLERANCE)) {
            return checkAligned(d1, between, COLINEAR_TOLERANCE);
        }

        intersection.addScaled(d1, determinant(d2, between) / denom);
        return true;
    };

    r2.intersectLinesPP = function (start1, end1, start2, end2, intersection) {
        return r2.intersectLinesPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2), intersection);
    };

    function inSegment(parameter) {
        return (0 <= parameter && parameter <= 1);
    }

    r2.inSegmentPD = function (start, direction, point) {
        let diffX = point.x - start.x,
            diffY = point.y - start.y;
        if (diffX !== 0) {
            return inSegment(diffX / direction.x);
        } else if (diffY !== 0) {
            return inSegment(diffY / direction.y);
        }
        return false;
    };

    r2.segmentsIntersectPDT = function (start1, d1, start2, d2, tolerance) {
        let between = subVectors(start1, start2),
            denom = determinant(d1, d2);

        if (tolEqual(denom, 0, tolerance)) {
            // Lines are parallel, can't intersect, but may overlap.
            if (!checkAligned(d1, between, tolerance)) {
                return false;
            }

            // There is overlap if the start or end of segment 2 is in segment 1, or if segment 2 contains all of segment 1.
            return r2.inSegmentPD(start1, d1, start2) || r2.inSegmentPD(start1, d1, start2 + d2) || r2.inSegmentPD(start2, d2, start1);
        }

        return inSegment(determinant(d1, between) / denom) &&
               inSegment(determinant(d2, between) / denom);
    };

    r2.segmentsIntersectPD = function (start1, d1, start2, d2) {
        return r2.segmentsIntersectPDT(start1, d1, start2, d2, COLINEAR_TOLERANCE);
    };

    r2.segmentsIntersectPPT = function (start1, end1, start2, end2, tolerance) {
        return r2.segmentsIntersectPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2), tolerance);
    };

    r2.segmentsIntersectPP = function (start1, end1, start2, end2) {
        return r2.segmentsIntersectPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2), COLINEAR_TOLERANCE);
    };

    r2.intersectSegmentsPDT = function (start1, d1, start2, d2, intersection, tolerance) {
        let between = subVectors(start1, start2),
            denom = determinant(d1, d2);

        intersection.copy(start1);
        if (tolEqual(denom, 0, tolerance)) {
            // Lines are parallel, can't intersect, but may overlap.
            if (!checkAligned(d1, between, tolerance)) {
                return false;
            }

            // There is overlap if the start or end of segment 2 is in segment 1, or if segment 2 contains all of segment 1.
            if (r2.inSegmentPD(start1, d1, start2)) {
                intersection.copy(start2);
                return true;
            }
            if (r2.inSegmentPD(start1, d1, r2.addVectors(start2, d2))) {
                intersection.copy(start2);
                intersection.add(d2);
                return true;
            }

            if (r2.inSegmentPD(start2, d2, start1)) {
                return true;
            }
            return false;
        }

        let t1 = determinant(d2, between) / denom,
            t2 = determinant(d1, between) / denom;
        intersection.addScaled(d1, t1);
        return inSegment(t1) && inSegment(t2);
    };

    r2.intersectSegmentsPD = function (start1, d1, start2, d2, intersection) {
        return r2.intersectSegmentsPDT(start1, d1, start2, d2, intersection, COLINEAR_TOLERANCE);
    };

    r2.intersectSegmentsPPT = function (start1, end1, start2, end2, intersection, tolerance) {
        return r2.intersectSegmentsPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2), intersection, tolerance);
    };

    r2.intersectSegmentsPP = function (start1, end1, start2, end2, intersection) {
        return r2.intersectSegmentsPD(start1, subVectors(end1, start1), start2, subVectors(end2, start2), intersection, COLINEAR_TOLERANCE);
    };

    class Segment extends Object {
        constructor(a, b, c, d) {
            if (isNaN(a)) {
                this.start = a;
                this.end = b;
            } else {
                this.start = new V(a, b);
                this.end = new V(c, d);
            }
        }

        direction() {
            let dir = subVectors(this.end, this.start);
            dir.normalize();
            return dir;
        }

        normal() {
            let dir = this.direction();
            dir.set(-dir.y, dir.x);
            return dir;
        }

        directedNormal() {
            let normal = this.normal();
            if (determinant(this.direction(), normal) >= 0) {
                normal.scale(-1);
            }
            return normal;
        }

        angle() {
            let dir = this.direction();
            return Math.atan2(dir.y, dir.x);
        }

        length() {
            return r2.pointDistance(this.end, this.start);
        }

        interpolate(t) {
            return r2.addVectors(this.start.scaled(t), this.end.scaled(1-t));
        }

        intersects(other) {
            return r2.segmentsIntersectPP(this.start, this.end, other.start, other.end);
        }

        intersectsT(other, tolerance) {
            return r2.segmentsIntersectPPT(this.start, this.end, other.start, other.end, tolerance);
        }

        findIntersection(other, intersection) {
            return r2.intersectSegmentsPP(this.start, this.end, other.start, other.end, intersection);
        }

        findIntersectionT(other, tolerance, intersection) {
            return r2.intersectSegmentsPPT(this.start, this.end, other.start, other.end, tolerance, intersection);
        }

        extendAtStart(length) {
            let s = this.start.clone();
            s.addScaled(this.direction(), -length);
            return new Segment(s, this.end);
        }

        extendAtEnd(length) {
            let e = this.end.clone();
            e.addScaled(this.direction(), length);
            return new Segment(this.start, e);
        }

        extendBoth(length) {
            let s = this.start.clone(),
                e = this.end.clone(),
                dir = this.direction();
            s.addScaled(dir, -length);
            e.addScaled(dir, length);
            return new Segment(s, e);
        }

        shift(offset) {
            let s = this.start.clone(),
                e = this.end.clone();
            s.add(offset);
            e.add(offset);
            return new Segment(s, e);
        }

        closestPoint(center) {
            let closest = new V(0, 0),
                normal = this.normal(),
                dir = this.direction();
            if (!r2.intersectLinesPD(this.start, dir, center, normal, closest)) {
                // Degenerate line segment.
                return { point: this.start, atEnd: true };
            }
            // Is the closest point inside the line segment?
            let fromStart = r2.subVectors(closest, this.start),
                fromEnd = r2.subVectors(closest, this.end);
            if (fromStart.dot(dir) >= 0 && fromEnd.dot(dir) < 0) {
                return { point: closest, atEnd: false };
            }
            if (r2.pointDistanceSq(center, this.start) < r2.pointDistanceSq(center, this.end)) {
                return { point: this.start, atEnd: true };
            } else {
                return { point: this.end, atEnd: true };
            }
        }
    }

    r2.Segment = Segment;

    class AABox extends Object {
        constructor(left, top, width, height) {
            super();
            this.left = left;
            this.top = top;
            this.width = width;
            this.height = height;
            this.right = left + width;
            this.bottom = top + height;
        };

        contains(p) {
            return this.left <= p.x && p.x <= this.right && this.top <= p.y && p.y <= this.bottom;
        };

        inflated(w, h) {
            return new AABox(this.left - w, this.top - h, this.width + 2 * w, this.height + 2 * h);
        };

        interpolate(p) {
            return new r2.V(this.left + this.width * p.x, this.top + this.height * p.y);
        };
    }

    r2.AABox = AABox;

    r2.ZERO = new V(0, 0);

    function testSuite() {
        let vectorTests = [
            function testConstruct() {
                let v = new V();

                TEST.equals(v.x, 0);
                TEST.equals(v.y, 0);

                let ones = new V(1, 1);

                TEST.equals(ones.x, 1);
                TEST.equals(ones.y, 1);
            },

            function testLength() {
                let v = new V(3, 4);
                TEST.tolEquals(v.lengthSq(), 25);
                TEST.tolEquals(v.length(), 5);
            },

            function testNormalize() {
                let v = new V(1, 0);

                v.normalize();

                TEST.equals(v.x, 1);
                TEST.equals(v.y, 0);

                let a = new V(1, 1),
                    n = a.normalized();

                TEST.equals(a.x, 1);
                TEST.equals(a.y, 1);

                TEST.tolEquals(n.x, 1 / Math.sqrt(2));
                TEST.tolEquals(n.y, 1 / Math.sqrt(2));
            },

            function testScale() {
                let v = new V(1, -2);
                v.scale(-2);
                TEST.equals(v.x, -2);
                TEST.equals(v.y, 4);
            },

            function testCopy() {
                let v = new V(1, -2),
                    w = v.clone();

                TEST.equals(v.x, w.x);
                TEST.equals(v.y, w.y);

                w.set(0, 0);
                TEST.equals(w.x, 0);
                TEST.equals(w.y, 0);
                TEST.notEquals(v.x, w.x);
                TEST.notEquals(v.y, w.y);

                v.copy(w);
                TEST.equals(v.x, 0);
                TEST.equals(v.y, 0);
            }
        ];

        let intersectTests = [
        ];

        let segmentTests = [
        ];

        let aaboxTests = [
        ];

        TEST.run("R2 Vector", vectorTests);
        TEST.run("R2 Intersect", intersectTests);
        TEST.run("R2 Segment", segmentTests);
        TEST.run("R2 AABOX", aaboxTests);
    }
    r2.testSuite = testSuite;

    return r2;
}());
