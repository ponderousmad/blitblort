var BLOB = (function () {
    "use strict";

    function TextureCache(batch, setupTexture) {
        this.batch = batch;
        this.setupTexture = setupTexture;
        this.textures = {
        };
    }

    TextureCache.prototype.cache = function (resource) {
        var cached = this.textures[resource],
            self = this;
        if (cached) {
            return cached;
        }

        cached = {
            resource: resource
        };
        this.textures[resource] = cached;
        cached.image = batch.load(resource, function (image) {
            cached.texture = self.setupTexture(image);
        });
    };

    function Frame(blumps, duration, next) {
        this.blumps = blumps;
        this.next = next || null;
        this.duration = duration;
    }

    function Flipbook(data, textureCache) {
        this.frames = [];
        for (var f = 0; f < data.frames.length; ++f) {
            var frameData = data.frames[f];
            this.frames.push({
                mesh: WGL.makeBillboard(null)
            });
        }
    }

    Flipbook.prototype.constructMeshes = function () {

    };

    function Thing(mesh) {
        this.position = R3.origin();
        this.orientation = R3.zeroQ();
        this.scale = 1;
        this.toWorld = new R3.M();
        this.toLocal = null;
        this.transformDirty = false;
        this.blumps = null;
        this.frame = null;
        this.frames = null;
        this.remaining = 0;
        this.billboardUp = null;

        this.mesh = mesh ? mesh : null;
    }

    Thing.prototype.setFrames = function (frames, index) {
        if (frames) {
            this.frames = frames;
        } else {
            frames = this.frames;
        }
        this.frame = frames[index];
        this.blumps = this.frame.blumps;
        this.remaining = this.frame.duration;
    };

    Thing.prototype.update = function (elapsed) {
        if (this.frame) {
            if (this.frame.next !== null) {
                this.remaining -= elapsed;
                if (this.remaining < 0) {
                    this.setFrames(null, this.frame.next);
                }
            }
        }
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
        this.transformDirty = true;
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

    Thing.prototype.render = function(room, program, worldEye, boundTexture) {
        var m = this.billboardUp ? this.alignBillboard(worldEye) : this.getToWorld(),
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
            room.drawMesh(mesh, program, m, boundTexture);
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
        Frame: Frame,
        Thing: Thing
    };
}());
