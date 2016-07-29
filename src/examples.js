var EXAMPLES = (function () {
    "use strict";

    function SplineExample() {
        this.maximize = false;
        this.updateInDraw = true;
        this.editArea = document.getElementById("points");
        this.editing = false;
        this.editPoint = null;

        this.batch = new BLIT.Batch("images/");
        this.vertexImage = this.batch.load("vertex.png");
        this.vertexShadow = this.batch.load("vertexShadow.png");
        this.batch.commit();

        this.splines = [];

        var segment = new SPLINE.BezierCurve(),
            spline = new SPLINE.Spline();

        spline.addSegment(segment);
        segment.addPoint(new R3.V(10,  10));
        segment.addPoint(new R3.V(100, 200));
        segment.addPoint(new R3.V(200, 100));
        segment.addPoint(new R3.V(200, 200));

        this.splines.push(spline);
    }

    SplineExample.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (keyboard.wasAsciiPressed("C")) {
            this.checkpoint();
        }

        if (keyboard.wasAsciiPressed("L")) {
            this.loadCheckpoint();
        }

        if (keyboard.wasAsciiPressed("E") && keyboard.isShiftDown()) {
            this.checkpoint();
            this.editing = !this.editing;
            this.editArea.className = this.editing ? "" : "hidden";
        }

        if (pointer.activated()) {
            var stab = new R2.V(pointer.location().x, pointer.location().y);
            for (var s = 0; s < this.splines.length; ++s) {
                var spline = this.splines[s];
                for (var t = 0; t < spline.segments.length; ++t) {
                    var points = spline.segments[t].points;
                    for (var p = 0; p < points.length; ++p) {
                        if (R2.pointDistance(points[p], stab) < 10) {
                            this.editPoint = points[p];
                        }
                    }
                }
            }
        }

        if (this.editPoint) {
            if (pointer.primary) {
                this.editPoint.x = pointer.location().x;
                this.editPoint.y = pointer.location().y;
            } else {
                this.editPoint = null;
            }
        }
    };
    
    SplineExample.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);

        var center = new R2.V(width * 0.5, height * 0.5),
            handleLineStyle = "rgba(0,0,0,0.5)",
            lineStyle = "black";

        for (var s = 0; s < this.splines.length; ++s) {
            var spline = this.splines[s];
            this.drawLines(context, spline.build(20), "black");
            for (var t = 0; t < spline.segments.length; ++t) {
                var points = spline.segments[t].points;
                for (var p = 0; p < points.length; ++p) {
                    var isHandle = p == 1 || p == 2;
                    this.drawVertex(context, points[p], isHandle ? [0,1,0] : [1,0,0]);
                }
                this.drawLine(context, points[0], points[1], handleLineStyle);
                this.drawLine(context, points[2], points[3], handleLineStyle);
            }
        }
    };

    SplineExample.prototype.drawVertex = function (context, location, tint) { 
        if (this.batch.loaded) {
            BLIT.draw(context, this.vertexImage, location.x, location.y, BLIT.ALIGN.Center, null, null, BLIT.MIRROR.None, tint);
            BLIT.draw(context, this.vertexShadow, location.x, location.y, BLIT.ALIGN.Center);
        }
    };
    
    SplineExample.prototype.drawLine = function (context, start, end, style) {
        this.drawLines(context, [start, end], style);
    };

    SplineExample.prototype.drawLines = function (context, points, style) {
        context.save();
        context.strokeStyle = style || "rgba(0,0,0,.5)";
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (var p = 1; p < points.length; ++p) {
            context.lineTo(points[p].x, points[p].y);
        }
        context.stroke();
        context.restore();
    };

    SplineExample.prototype.save = function () {
        var data = {
            splines: this.splines
        };
        return JSON.stringify(data, null, 4);
    };

    SplineExample.prototype.load = function (data) {
        var splines = data.splines;
        this.splines = [];
        for (var s = 0; s < splines.length; ++s) {
            var spline = new SPLINE.Spline(),
                segments = splines[s].segments;
            this.splines.push(spline);
            for (var t = 0; t < segments.length; ++t) {
                var segment = new SPLINE.BezierCurve(),
                    points = segments[t].points;
                spline.addSegment(segment);
                for (var i = 0; i < points.length; ++i) {
                    var p = points[i];
                    segment.addPoint(new R3.V(p.x, p.y, p.z, p.w));
                }
            }
        }
    };

    SplineExample.prototype.checkpoint = function () {
        this.editArea.value = this.save();
    };

    SplineExample.prototype.loadCheckpoint = function () {
        var data = JSON.parse(this.editArea.value);
        this.load(data);
    };

    return {
        SplineExample: SplineExample
    };
}());