var SPLINE = (function () {
    "use strict";

    function BezierCurve() {
        this.points =  [];
    }

    BezierCurve.prototype.addPoint = function (p) {
        this.points.push(p);
    };

    BezierCurve.prototype.start = function () {
        return this.points[0];
    };

    BezierCurve.prototype.end = function () {
        return this.points[this.points.length - 1];
    };

    function interpolate(a, b, parameter, results) {
        results.push(a.interpolate(b, parameter));
    }

    BezierCurve.prototype.evaluate = function (parameter, points, prior, post) {
        var results = [];
        points = points || this.points;
        if (prior) {
            interpolate(prior, this.start(), parameter, results);
        }
        for (var i = 1; i < points.length; ++i) {
            interpolate(points[i-1], points[i], parameter, results);
        }
        if (post) {
            interpolate(this.end(), post, parameter, results);
        }
        if (results.length === 1) {
            return results;
        }
        return this.evaluate(parameter, results);
    };

    BezierCurve.prototype.build = function (count, out, prior, post) {
        var result = out === undefined ? [] : out;
        if (this.points.length === 0) {
            if (prior && post) {
                result.push(prior);
                result.push(post);
            } else {
                throw new Error("Expected both prior and post (assuming this is last linear closed segment)");
            }

        } else if (this.points.length == 1) {
            if (prior) {
                result.push(prior);
            }
            result.push(this.points[0]);
            if (post) {
                result.push(post);
            }

        } else if (result.length == 2 && !(prior || post)) {
            result.push(...this.points);
        }

        var stepSize = 1 / count;
        for (var c = 0; c <= count; ++c) {
            result.push(this.evaluate(c * stepSize, undefined, prior, post)[0]);
        }
        return result;
    };

    function Spline(closed) {
        this.segments = [];
        this.closed = closed;
    }

    Spline.prototype.addSegment = function (segment) {
        this.segments.push(segment);
    };

    Spline.prototype.build = function (tesselation, out) {
        var points = out === undefined ? [] : out;
        for (var s = 0; s < this.segments.length; ++s) {
            var prior = s > 0 ? this.segments[s-1].end() : null;
            var post = this.closed && s === this.segments.length - 1 ? this.segments[0].start() : null;
            this.segments[s].build(tesselation, points, prior, post);
        }
        return points;
    };

    Spline.prototype.isClosed = function () {
        return this.closed;
    };

    return {
        BezierCurve: BezierCurve,
        Spline: Spline
    };
}());