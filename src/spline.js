var SPLINE = (function () {
    "use strict";

    function S() {
        this.points =  [
            new R2.V(10, 10),
            new R2.V(100, 200),
            new R2.V(200, 100),
            new R2.V(200, 200)
        ];
    }

    S.prototype.evaluate = function (p, points) {
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
    }

    S.prototype.build = function (count) {
        var points = [],
            stepSize = 1 / (count + 1)
        for (var c = 0; c <= count; ++c) {
            points.push(this.evaluate(c * stepSize)[0]);
        }
        return points;
    };

    return {
        S: S
    };
}());