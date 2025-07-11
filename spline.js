var SPLINE = (function () {
    "use strict";

    // Given a set of points, and an interpolation parameter, compute
    // the curve point assuming that the points are the bezier control hull
    // of the corresponding degree.
    function evaluateBezier(parameter, points) {
        // Compute the values of the current 'depth' and write
        // results in place to the points argument.
        for (var i = 1; i < points.length; ++i) {
            points[i-1] = points[i-1].interpolate(points[i], parameter);
        }
        // Each recurse into evaluate computes one less result point.
        points.length = points.length - 1;
        if (points.length === 1) {
            return points;
        }
        return evaluateBezier(parameter, points);
    }

    // Get all the control points for this section as a single array
    function makeHull(points, prior, post) {
        var hull = [];
        if (prior) {
            hull.push(prior);
        }
        hull.push(...points);
        if (post) {
            hull.push(post);
        }
        return hull;
    }

    function tesselateBezier(hull, count, result) {
        if(hull.length < 3) {
            // Linear segment
            result.push(...hull);
        }
        var stepSize = 1 / count;
        for (var c = 0; c <= count; ++c) {
            result.push(evaluateBezier(c * stepSize, hull.slice())[0]);
        }
        return result;
    }

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

    BezierCurve.prototype.evaluate = function (parameter, prior, post) {
        return evaluateBezier(parameter, makeHull(this.points, prior, post));
    };

    BezierCurve.prototype.tesselate = function (tesselation, result, prior, post) {
        return tesselateBezier(makeHull(this.points, prior, post), tesselation, result);
    };

    BezierCurve.prototype.getData = function () {
        let pointData = [];
        for (let p = 0; p < this.points.length; ++p) {
            pointData.push({x:this.points[p].x, y:this.points[p].y});
        }
        return {
            type:"BezierCurve",
            points:pointData
        };
    }

    function Path(closed) {
        this.segments = [];
        this.closed = closed === true;
    }

    Path.prototype.addSegment = function (segment) {
        this.segments.push(segment);
    };

    Path.prototype.build = function (tesselation, out) {
        var points = out === undefined ? [] : out;
        for (var s = 0; s < this.segments.length; ++s) {
            var prior = s > 0 ? this.segments[s-1].end() : null;
            var post = this.closed && s === this.segments.length - 1 ? this.segments[0].start() : null;
            this.segments[s].tesselate(tesselation, points, prior, post);
        }
        return points;
    };

    Path.prototype.isClosed = function () {
        return this.closed;
    };

    Path.prototype.getData = function () {
        let segmentData = [];
        for (let s = 0; s < this.segments.length; ++s) {
            segmentData.push(this.segments[s].getData());
        }
        return {
            closed: this.closed,
            segments: segmentData
        };
    }

    return {
        BezierCurve: BezierCurve,
        Path: Path
    };
}());