var BLOB = (function () {
    "use strict";

    function Flip(data, textureCache) {
        this.frames = [];
        for (var a = 0; a < data.length; ++a) {
            var entry = data[a],
                cachedTexture = textureCache.cache(entry.image);
            for (var f = 0; f < entry.frames.length; ++f) {
                this.frames.push({
                    cachedTexture: cachedTexture,
                    coords: entry.frames[f]
                });
            }
        }
    }

    Flip.prototype.constructMeshes = function () {
        for (var f = 0; f < this.frames.length; ++f) {
            var frame = this.frames[f];
            frame.mesh = WGL.makePlane(frame.coords);
            frame.mesh.texture = frame.cachedTexture.texture;
        }
    };

    Flip.prototype.setupPlayback = function (frameTime, loop, offset) {
        var time = offset ? offset : 0,
            flip = this;
        return {
            elapsed: time,
            timePerFrame: frameTime,
            fractionComplete: time / (frameTime * this.frames.length),
            loop: loop === true,
            update: function (elapsed) { return flip.updatePlayback(elapsed, this); },
            mesh: function () { return flip.mesh(this); },
            setup: function () { flip.constructMeshes(); }
        };
    };

    Flip.prototype.updatePlayback = function (elapsed, playback) {
        var totalLength = playback.timePerFrame * this.frames.length;
        playback.elapsed += elapsed;
        if(playback.loop) {
            playback.elapsed = playback.elapsed % totalLength;
        }
        if (playback.elapsed > totalLength) {
            playback.fractionComplete = 1;
            return true;
        } else {
            playback.fractionComplete = playback.elapsed / totalLength;
            return false;
        }
    };

    Flip.prototype.mesh = function (playback) {
        var index = Math.min(this.frames.length - 1, Math.floor(playback.elapsed / playback.timePerFrame));
        return this.frames[index].mesh;
    };

    function Thing(mesh, parent) {
        this.position = R3.origin();
        this.orientation = R3.zeroQ();
        this.scale = 1;
        this.toWorld = new R3.M();
        this.toLocal = null;
        this.transformID = 0;
        this.transformTargetID = 1;
        this.transformParentID = 1;
        this.billboardUp = null;
        this.parent = parent || null;

        this.mesh = mesh ? mesh : null;
    }

    Thing.prototype.setParent = function (thing) {
        this.parent = thing;
        this.markDirty();
    };

    Thing.prototype.setBillboardUp = function (up) {
        this.billboardUp = up.normalized();
    };

    Thing.prototype.move = function (offset) {
        this.position.add(offset);
        this.markDirty();
    };

    Thing.prototype.setPosition = function (position) {
        this.position.set(position.x, position.y, position.z);
        this.markDirty();
    };

    Thing.prototype.rotate = function (angle, axis) {
        var delta = R3.angleAxisQ(angle, axis);
        this.orientation.times(delta);
        this.markDirty();
    };

    Thing.prototype.setOrientation = function (orientation) {
        this.orientation = orientation.copy();
        this.markDirty();
    };

    Thing.prototype.scaleBy = function (scaleFactor) {
        this.scale *= scaleFactor;
        this.markDirty();
    };

    Thing.prototype.markDirty = function () {
        this.transformTargetID = (this.transformTargetID + 1) % 10000;
        this.toLocal = null;
    };

    Thing.prototype.alignBillboard = function (worldEye) {
        var forward = R3.subVectors(worldEye, this.position);
        forward.normalize();
        var right = forward.cross(this.billboardUp);
        right.normalize();
        var up = right.cross(forward);
        up.normalize();

        var posX = -right.dot(this.position);
        var posY = -up.dot(this.position);
        var posZ = forward.dot(this.position);

        var m = new R3.M([
            right.x, up.x, -forward.x, 0,
            right.y, up.y, -forward.y, 0,
            right.z, up.z, -forward.z, 0,
            posX, posY, posZ, 1
        ]); 

        R3.matmul(m.inverse(), R3.makeScale(this.scale), m);
        return m;
    };

    Thing.prototype.renderTransform = function (worldEye) {
        return this.billboardUp ? this.alignBillboard(worldEye) : this.getToWorld();
    };

    Thing.prototype.render = function(room, program) {
        var m = this.renderTransform(room.viewer.position),
            mesh = this.mesh;

        if (this.blumps) {
            var localEye = this.toLocalP(room.viewer.position),
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

    Thing.prototype.checkDirty = function (currentID) {
        currentID = currentID || this.transformID;
        if (currentID != this.transformTargetID) {
            return true;
        }
        return this.parent && this.parent.checkDirty(this.transformParentID);
    };

    Thing.prototype.getToWorld = function () {
        var m = this.toWorld;
        if (this.checkDirty()) {
            var rotate = R3.makeRotateQ(this.orientation);
            m.setIdentity();
            m.translate(this.position);
            m.scale(this.scale);
            R3.matmul(m, rotate, m);
            if (this.parent) {
                R3.matmul(this.parent.getToWorld(), m, m);
                this.transformParentID = this.parent.transformID;
            }
            this.transformID = this.transformTargetID;
        }
        return m;
    };

    Thing.prototype.getToLocal = function () {
        if (this.toLocal === null || this.checkDirty()) {
            this.toLocal = this.getToWorld().inverse();
        }
        return this.toLocal;
    };

    Thing.prototype.toWorldP = function (point) {
        return this.getToWorld().transformP(point);
    };

    Thing.prototype.toWorldV = function (vector) {
        return this.getToWorld().transformV(vector);
    };

    Thing.prototype.toLocalP = function (point) {
        return this.getToLocal().transformP(point);
    };

    Thing.prototype.toLocalV = function (vector) {
        return this.getToLocal().transformV(vector);
    };

    function findThingFacing(things, eye) {
        var minAngle = 2 * Math.PI,
            minThing = null,
            forward = new R3.V(0, 0, 1);
        for (var t = 0; t < things.length; ++t) {
            var thing = things[t],
                thingDir = thing.toWorldV(forward),
                toEye = R3.subVectors(eye, thing.position);
            thingDir.normalize();
            toEye.normalize();
            var angle = Math.abs(R2.clampAngle(Math.acos(thingDir.dot(toEye))));
            if (angle < minAngle) {
                minThing = thing;
                minAngle = angle;
            }
        }
        return minThing;
    }

    function Anim(frameTime, loop) {
        this.things = null;
        this.frame = 0;
        this.frames = [];
        this.frameTime = frameTime || 100;
        this.loop = loop || false;
        this.remaining = this.frameTime;
    }

    Anim.prototype.addFrame = function (things, duration) {
        this.frames.push({
            things: things,
            duration: duration || this.frameTime
        });
        if (!this.things) {
            this.things = things;
        }
    };

    Anim.prototype.makePingPong = function () {
        for (var extra = this.frames.length - 2; extra > 1; --extra) {
            var toCopy = this.frames[extra];
            this.addFrame(toCopy.things, toCopy.duration);
        }
    };

    Anim.prototype.update = function (elapsed) {
        this.remaining -= elapsed;
        if (this.remaining < 0) {
            if (this.frames < (this.frames.length - 1) || this.loop) {
                this.frame = (this.frame + 1) % this.frames.length;
                var next = this.frames[this.frame];
                this.things = next.things;
                this.remaining = next.duration;
            }
        }
    };

    Anim.prototype.renderFacing = function (room, program) {
        var facingThing = findThingFacing(this.things, room.viewer.position);
        if (facingThing) {
            facingThing.render(room, program);
        }
        return facingThing;
    };

    Anim.prototype.renderAll = function (room, program) {
        for (var t = 0; t < this.things.length; ++t) {
            this.things[t].render(room, program);
        }
    };

    return {
        Flip: Flip,
        Thing: Thing,
        Anim: Anim
    };
}());
