var BLOB = (function () {
    "use strict";

    function Frame(blumps, duration, next) {
        this.blumps = blump;
        this.next = next;
        this.duration = duration;
        this.remaining = duration;
    }

    function Thing(mesh) {
        this.position = R3.origin();
        this.orientation = R3.zeroQ();
        this.scale = 1;
        this.toWorld = new R3.M();
        this.toLocal = null;
        this.transformDirty = false;
        this.blumps = null;
        this.frame = null;

        this.mesh = mesh ? mesh : null;
    }

    Thing.prototype.update = function (elapsed) {
        if (this.frame) {
            if (this.frame.next) {
                this.duration -= elapsed;
                if (this.duration < 0) {
                    this.frame = this.frame.next;
                    this.blumps = this.frame.blumps;
                }
            }
        }
    };

    Thing.prototype.move = function (offset) {
        this.position.add(offset);
        this.markDirty();
    };

    Thing.prototype.rotate = function (angle, axis) {
        var delta = R3.angleAxisQ(angle, axis);
        this.orientation.times(delta);
        this.markDirty();
    };

    Thing.prototype.markDirty = function () {
        this.transformDirty = true;
        this.toLocal = null;
    };

    Thing.prototype.render = function(room, program, worldEye) {
        var m = this.getToWorld(),
            mesh = this.mesh;

        if (this.blumps) {
            var localEye = this.toLocalP(worldEye),
                eyeAngle = R2.clampAngle(Math.atan2(-localEye.x, localEye.z)),
                minAngle = 4 * Math.PI;
            for (var a = 0; a < this.blumps.length; ++a) {
                var blump = this.blumps[a],
                    angleDifference = Math.abs(R2.clampAngle(eyeAngle + blump.angle));
                if (angleDifference < minAngle) {
                    mesh = blump.mesh;
                    minAngle = angleDifference;
                }
            }
        }
        if (mesh) {
            room.drawMesh(mesh, program, m);
        }
    };

    Thing.prototype.getToWorld = function () {
        var m = this.toWorld;
        if (this.transformDirty) {
            var rotate = R3.makeRotateQ(this.orientation);
            m.setIdentity();
            m.translate(this.position);
            m.scale(this.scale);
            R3.matmul(m, rotate, m);
            this.transformDirty = false;
        }
        return m;
    };

    Thing.prototype.getToLocal = function () {
        if (this.toLocal === null) {
            this.toLocal = this.getToWorld().inverse();
        }
        return this.toLocal;
    };

    Thing.prototype.toLocalP = function (point) {
        return this.getToLocal().transformP(point);
    };

    Thing.prototype.toLocalV = function (vector) {
        return this.getToLocal().transformV(vector);
    };

    return {
        Thing: Thing
    };
}());
