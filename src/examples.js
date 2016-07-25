var EXAMPLES = (function () {
    "use strict";

    function SplineExample() {
        this.maximize = false;
        this.updateInDraw = true;
        this.editArea = document.getElementById("points");
        this.editing = false;

        this.batch = new BLIT.Batch("images/");
        this.vertexImage = this.batch.load("vertex.png");
        this.vertexShadow = this.batch.load("vertexShadow.png");
        this.batch.commit();
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
    };
    
    SplineExample.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);

        var center = new R2.V(width * 0.5, height * 0.5)

        this.drawLine(context, center, new R2.V(width, height));
        this.drawLine(context, center, new R2.V(0, height), "rgba(255,0,0,1)");

        if (this.batch.loaded) {
            BLIT.draw(context, this.vertexImage, center.x, center.y, BLIT.ALIGN.Center, null, null, BLIT.MIRROR.None, [0,1,0]);
            BLIT.draw(context, this.vertexShadow, center.x, center.y, BLIT.ALIGN.Center);
        }
    };

    SplineExample.prototype.drawLine = function (context, start, end, style) {
        context.save();
        context.strokeStyle = style || "rgba(0,0,0,.5)";
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
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