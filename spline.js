var SPLINE = (function () {
    "use strict";

    class LineSegment extends Object {
        constructor(start, end) {
            super();
            // Note, start will be null except for first segment and end will be null for last if closed
            this.startPoint = start ? start : undefined;
            this.endPoint = end ? end : undefined;
        }

        start() { return this.startPoint; };
        end() { return this.endPoint; };

        evaluate(parameter, prior, post) {
            let start = proir || this.startPoint,
                end = post || this.endPoint,
                segment = new start.space().Segment(start, end);
            return segment.interpolate(parameter);
        };

        tesselate(tesselation, result, prior, post) {
            if (!prior) {
                result.push(this.startPoint)
            }
            result.push(post || this.endPoint);
        };

        controlPoints() {
            let points = [];
            if (this.startPoint) {
                points.push(this.startPoint);
            }
            if (this.endPoint) {
                points.push(this.endPoint);
            }
            return points;
        }

        getData() {
            return {
                type:"LineSegment",
                start: this.startPoint ? this.startPoint.getData() : undefined,
                end: this.endPoint ? this.endPoint.getData() : undefined
            };
        }
    }

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

    class BezierCurve extends Object {
        constructor() {
            super();
            this.points =  [];
        }

        addPoint(p) {
            this.points.push(p);
        };

        start() { return this.points[0]; };
        end() { return this.points[this.points.length - 1]; };

        evaluate(parameter, prior, post) {
            return evaluateBezier(parameter, makeHull(this.points, prior, post));
        };

        tesselate(tesselation, result, prior, post) {
            return tesselateBezier(makeHull(this.points, prior, post), tesselation, result);
        };

        controlPoints() { return this.points; }

        getData() {
            let pointData = [];
            for (const point of this.points) {
                pointData.push(point.getData());
            }
            return {
                type:"BezierCurve",
                points:pointData
            };
        }
    }

    class Path extends Object {
        constructor(closed) {
            super();
            this.segments = [];
            this.closed = closed === true;
        }

        addSegment(segment) {
            this.segments.push(segment);
        };

        build(tesselation, out) {
            var points = out === undefined ? [] : out;
            for (var s = 0; s < this.segments.length; ++s) {
                var prior = s > 0 ? this.segments[s-1].end() : null;
                var post = this.closed && s === this.segments.length - 1 ? this.segments[0].start() : null;
                this.segments[s].tesselate(tesselation, points, prior, post);
            }
            return points;
        };

        isClosed() { return this.closed; };
        setClosed(closed) { this.closed = closed; }

        getSegments() { return this.segments; }

        getData() {
            let segmentData = [];
            for (let s = 0; s < this.segments.length; ++s) {
                segmentData.push(this.segments[s].getData());
            }
            return {
                closed: this.closed,
                segments: segmentData
            };
        }
    }

    return {
        LineSegment: LineSegment,
        BezierCurve: BezierCurve,
        Path: Path
    };
}());