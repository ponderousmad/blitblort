var SPLINE = (function () {
    "use strict";

    function S() {
        this.points =  [
            new R2.V(10, 10),
            new R2.V(10, 20),
            new R2.V(10, 20),
            new R2.V(10, 20)
        ];
    }

    S.prototype.evaluate = function (p, points) {
        var results = [];
        points = points || this.points;
        for (var i = 1; i < points.length; ++i) {
            var prime = points[i-1].interpolate(points[i], p);
            results.push(prime);
        }
        if (results.length > 1) {
            results = this.evaluate(p, results);
        }
        return results;
    }

    return {
        S: S
    };
}());