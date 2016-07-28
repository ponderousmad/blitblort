var SPLINE = (function () {
    "use strict";

    function BezierCurve() {
        this.points =  [];
    }

    BezierCurve.prototype.addPoint = function (p) {
        this.points.push(p);
    };

    BezierCurve.prototype.evaluate = function (p, points) {
        var results = [];
        points = points || this.points;
        for (var i = 1; i < points.length; ++i) {
            var prime = points[i-1].interpolate(points[i], p);
            results.push(prime);
        }
        if (results.length === 1) {
            return results;
        }
        return this.evaluate(p, results);
    };

    BezierCurve.prototype.build = function (count, out) {
        var points = out === undefined ? [] : out,
            stepSize = 1 / count;
        for (var c = 0; c <= count; ++c) {
            points.push(this.evaluate(c * stepSize)[0]);
        }
        return points;
    };

    function Spline() {
        this.segments = [];
    }

    Spline.prototype.addSegment = function (segment) {
        this.segments.push(segment);
    };

    Spline.prototype.build = function (segmentCount, out) {
        var points = out === undefined ? [] : out;
        for (var s = 0; s < this.segments.length; ++s) {
            this.segments[s].build(segmentCount, points);
        }
        return points;
    };

    return {
        BezierCurve: BezierCurve,
        Spline: Spline
    };
}());