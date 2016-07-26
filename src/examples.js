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

        this.splines = [
            new SPLINE.S()
        ];
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
                for (var p = 0; p < spline.points.length; ++p) {
                    if (R2.pointDistance(spline.points[p], stab) < 10) {
                        this.editPoint = spline.points[p];
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

        var center = new R2.V(width * 0.5, height * 0.5)

        for (var s = 0; s < this.splines.length; ++s) {
            var spline = this.splines[s];
            this.drawLines(context, spline.build(20), "rgba(0,0,0,1)");
            for (var p = 0; p < spline.points.length; ++p) {
                var isHandle = p == 1 || p == 2;
                this.drawVertex(context, spline.points[p], isHandle ? [0,1,0] : [1,0,0]);
            }
            this.drawLine(context, spline.points[0], spline.points[1], "rgba(0,0,0,0.5)");
            this.drawLine(context, spline.points[2], spline.points[3], "rgba(0,0,0,0.5)");
        }
    }

    SplineExample.prototype.drawVertex = function (context, location, tint) { 
        if (this.batch.loaded) {
            BLIT.draw(context, this.vertexImage, location.x, location.y, BLIT.ALIGN.Center, null, null, BLIT.MIRROR.None, tint);
            BLIT.draw(context, this.vertexShadow, location.x, location.y, BLIT.ALIGN.Center);
        }
    };
    
    SplineExample.prototype.drawLine = function (context, start, end, style) {
        this.drawLines(context, [start, end], style);
    }

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
        var data = {};
        return JSON.stringify(data);
    };

    SplineExample.prototype.load = function (data) {
        console.log("Loaded");
    };

    SplineExample.prototype.checkpoint = function () {
        this.editArea.value = this.save();
    };

    SplineExample.prototype.loadCheckpoint = function () {
        data = JSON.parse(this.editArea.value);
        this.load(data);
    };

    return {
        SplineExample: SplineExample
    };
}());