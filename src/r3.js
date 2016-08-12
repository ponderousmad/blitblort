var R3 = (function () {
    var D3 = 3,
        D4 = 4;

    function at(i, j) {
        return i + j * D4;
    }

    function clamp(v, min, max) {
        return Math.max(Math.min(v, max), min);
    }

    function M(values) {
        if (!values) {
            values = [
                1,0,0,0,
                0,1,0,0,
                0,0,1,0,
                0,0,0,1
            ];
        } else if (values.length != D4 * D4) {
            throw "Wrong number of values for matrix initialization.";
        }
        this.m = new Float32Array(values);
    }

    M.prototype.at = function (i, j) {
        return this.m[at(i, j)];
    };

    M.prototype.setAt = function (i, j, value) {
        this.m[at(i, j)] = value || 0;
    };

    M.prototype.setAll = function (values) {
        for (var i = 0; i < values.length; ++i) {
            this.m[i] = values[i];
        }
    };

    M.prototype.translate = function (v) {
        this.m[at(0, 3)] += v.x;
        this.m[at(1, 3)] += v.y;
        this.m[at(2, 3)] += v.z;
    };

    M.prototype.scale = function (s) {
        for (var i = 0; i < D3; ++i) {
            this.m[at(i,i)] *= s;
        }
    };

    M.prototype.scaleBy = function (v) {
        this.m[at(0,0)] *= v.x;
        this.m[at(1,1)] *= v.y;
        this.m[at(2,2)] *= v.z;
    };

    // Adapted from setFromRotationMatrix in
    // https://github.com/mrdoob/three.js/blob/dev/src/math/Euler.js
    M.prototype.extractEuler = function (order) {
        var x = 0.0, y = 0.0, z = 0.0;
        if (order === "XYZ" || !order) {
            var m02 = this.m[at(0, 2)];
            y = Math.asin(clamp(m02, -1, 1));
            if (Math.abs(m02) < 0.99999) {
                x = Math.atan2(-this.m[at(1, 2)], this.m[at(2, 2)]);
                z = Math.atan2(-this.m[at(0, 1)], this.m[at(0, 0)]);
            } else {
                x = Math.atan2( this.m[at(2, 1)], this.m[at(1, 1)]);
            }
        } else if (order === "ZYX") {
            var m20 = this.m[at(2, 0)];
            y = Math.asin(-clamp(m20, - 1, 1));
            if (Math.abs(m20) < 0.99999 ) {
                x = Math.atan2( this.m[at(2, 1)], this.m[at(2, 2)]);
                z = Math.atan2( this.m[at(1, 0)], this.m[at(0, 0)]);
            } else {
                z = Math.atan2(-this.m[at(0, 1)], this.m[at(1, 1)]);
            }
        } else if (order === "YXZ") {
            var m12 = this.m[at(1, 2)];
            x = Math.asin(-clamp(m12, -1, 1));
            if (Math.abs(m12) < 0.99999) {
                y = Math.atan2( this.m[at(0, 2)], this.m[at(2, 2)]);
                z = Math.atan2( this.m[at(1, 0)], this.m[at(1, 1)]);
            } else {
                y = Math.atan2(-this.m[at(2, 0)], this.m[at(0, 0)]);
            }
        } else if (order === "ZXY") {
            var m21 = this.m[at(2, 1)];
            x = Math.asin(clamp(m21, -1, 1));
            if (Math.abs(m21) < 0.99999) {
                y = Math.atan2(-this.m[at(2, 0)], this.m[at(2, 2)]);
                z = Math.atan2(-this.m[at(0, 1)], this.m[at(1, 1)]);
            } else {
                z = Math.atan2( this.m[at(1, 0)], this.m[at(0, 0)]);
            }
        } else if (order === "YZX") {
            var m10 = this.m[at(1, 0)];
            z = Math.asin(clamp(m10, -1, 1));
            if (Math.abs(m10) < 0.99999) {
                x = Math.atan2(-this.m[at(1, 2)], this.m[at(1, 1)]);
                y = Math.atan2(-this.m[at(2, 0)], this.m[at(0, 0)]);
            } else {
                y = Math.atan2( this.m[at(0, 2)], this.m[at(2, 2)]);
            }
        } else if (order === "XZY") {
            var m01 = this.m[at(0, 1)];
            z = Math.asin(-clamp(m01, -1, 1));
            if (Math.abs(m01) < 0.99999) {
                x = Math.atan2( this.m[at(2, 1)], this.m[at(1, 1)]);
                y = Math.atan2( this.m[at(0, 2)], this.m[at(0, 0)]);
            } else {
                x = Math.atan2(-this.m[at(1, 2)], this.m[at(2, 2)]);
            }
        } else {
            console.log("Unknown order");
        }
        return new V(x, y, z);
    };

    // Based on http://paulbourke.net/miscellaneous/determinant/
    M.prototype.determinant = function (i) {
        i = i || 0; // Arbitrarily choose column i for calculating the determinant.
        var det = 0;
        for (var j = 0; j < D4; ++j) {
            det += this.m[at(i, j)] * Math.pow(-1, i + j) * this.minor(i, j);
        }
        return det;
    };

    function skipIndex(skip, offset) {
        offset = offset % D3;
        return offset < skip ? offset : offset + 1;
    }

    M.prototype.minor = function (column, row, i) {
        // https://en.wikipedia.org/wiki/Minor_(linear_algebra)
        // Calculate the Minor, which is the determinant of the matrix
        // obtained by ommiting the specified row and column
        i = i || 0; // Arbitrarily choosen column for calculating the determinant.
        var det = 0,
            iA = skipIndex(column, i + 0),
            iB = skipIndex(column, i + 1),
            iC = skipIndex(column, i + 2);
        for (var j = 0; j < D3; ++j) {
            var jA = skipIndex(row, j + 0),
                jB = skipIndex(row, j + 1),
                jC = skipIndex(row, j + 2);
                det2x2 = this.m[at(iB, jB)] * this.m[at(iC, jC)] -
                         this.m[at(iB, jC)] * this.m[at(iC, jB)];
            det += this.m[at(iA, jA)] * Math.pow(-1, i + j) * det2x2;
        }
        return det;
    };

    // Also based on http://paulbourke.net/miscellaneous/determinant/
    M.prototype.inverse = function (skipI, skipJ) {
        var det = this.determinant();

        if (det === 0) {
            // If the determinant zero, no inverse exists.
            return null;
        }
        var inv = new M(),
            scale = 1 / det;

        for (var i = 0; i < D4; ++i) {
            for (var j = 0; j < D4; ++j) {
                var adjuct = this.minorDeterminant(j, i);
                inv.m[at(i, j)] = Math.pow(-1, i + j) * adjuct * scale;
            }
        }
        return inv;
    };

    M.prototype.transpose = function (out) {
        for (var i = 0; i < D4; ++i) {
            for (var j = i + 1; j < D4; ++j) {
                var mIJ = this.m[at(i,j)];
                this.m[at(i, j)] = this.m[at(j, i)];
                this.m[at(j, i)] = mIJ;
            }
        }
    };

    M.prototype.transposed = function (out) {
        var t = new M();
        for (var i = 0; i < D4; ++i) {
            for (var j = 0; j < D4; ++j) {
                t.m[at(i, j)] = this.m[at(j, i)];
            }
        }
        return t;
    };

    function makeRotateX(theta) {
        var c = Math.cos(theta),
            s = Math.sin(theta);

        return new M([
            1, 0, 0, 0,
            0, c,-s, 0,
            0, s, c, 0,
            0, 0, 0, 1
        ]);
    }

    function makeRotateY(theta) {
        var c = Math.cos(theta),
            s = Math.sin(theta);

        return new M([
            c, 0, s, 0,
            0, 1, 0, 0,
           -s, 0, c, 0,
            0, 0, 0, 1
        ]);
    }

    function makeRotateZ(theta) {
        var c = Math.cos(theta),
            s = Math.sin(theta);

        return new M([
            c,-s, 0, 0,
            s, c, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    }

    function matmul(a, b, target) {
        var result = null;
        if (target && target != a && target != b) {
            result = target;
            target = null;
        } else {
            result = new M();
        }

        for (var i = 0; i < D4; ++i) {
            for (var j = 0; j < D4; ++j) {
                var value = 0.0;
                for (var k = 0; k < D4; ++k) {
                    value += a.at(i, k) * b.at(k, j);
                }
                result.m[at(i, j)] = value;
            }
        }

        if (target) {
            target.m = result.m;
            return target;
        }

        return result;
    }

    M.prototype.times = function (other) {
        return matmul(this, other, this);
    };

    M.prototype.transformV = function (v) {
        var result = new V();
        for (var i = 0; i < D4; ++i) {
            var value = 0;
            for (var j = 0; j < D4; ++j) {
                value += v.v(j) * this.at(j, i);
            }
            result.setAt(i, value);
        }
        return result;
    };

    function V(x, y, z, w) {
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
        this.w = w === undefined ? 1 : w;
    }

    V.prototype.copy = function () {
        return new V(this.x, this.y, this.z, this.w);
    };

    V.prototype.copyTo = function (array, offset, includeW) {
        array[offset + 0] = this.x;
        array[offset + 1] = this.y;
        array[offset + 2] = this.z;
        if (includeW) {
            array[offset + 3] = this.w;
            return offset + D4;
        }
        return offset + D3;
    };

    V.prototype.pushOn = function (array) {
        array.push(this.x);
        array.push(this.y);
        array.push(this.z);
    };

    V.prototype.set = function (x, y, z, w) {
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
        if (w !== undefined) {
            this.w = w;
        }
    };

    V.prototype.v = function (i) {
        switch(i) {
            case 0: return this.x;
            case 1: return this.y;
            case 2: return this.z;
            case 3: return this.w;
        }
    };

    V.prototype.setAt = function (i, value) {
        switch(i) {
            case 0: this.x = value; return;
            case 1: this.y = value; return;
            case 2: this.z = value; return;
            case 3: this.w = value; return;
        }
    };

    V.prototype.scale = function (s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
    };

    V.prototype.add = function (v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        this.w = Math.max(0, this.w - v.w);
    };

    V.prototype.addScaled = function (v, s) {
        this.x += s * v.x;
        this.y += s * v.y;
        this.z += s * v.z;
        this.w = Math.max(0, this.w - v.w);
    };

    V.prototype.interpolate = function (v, p) {
        return new V(
            this.x * (1 - p) + v.x * p,
            this.y * (1 - p) + v.y * p,
            this.z * (1 - p) + v.z * p,
            Math.max(this.w, v.w)
        );
    };

    V.prototype.sub = function (v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        this.w = Math.max(0, this.w - v.w);
    };

    V.prototype.lengthSq = function () {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    };

    V.prototype.length = function () {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    };

    V.prototype.normalize = function () {
        var length = this.length();
        this.x /= length;
        this.y /= length;
        this.z /= length;
    };

    V.prototype.normalized = function () {
        var length = this.length();
        return new V(this.x / length, this.y / length, this.z / length, this.w);
    };

    function pointDistanceSq(a, b) {
        var xDiff = a.x - b.x,
            yDiff = a.y - b.y,
            zDiff = a.z - b.z;
        return xDiff * xDiff + yDiff * yDiff + zDiff * zDiff;
    }

    function pointDistance(a, b) {
        return Math.sqrt(pointDistanceSq(a, b));
    }

    function addVectors(a, b) {
        return new V(a.x + b.x, a.y + b.y, a.z + b.z, Math.min(1, a.w + b.w));
    }

    function subVectors(a, b) {
        return new V(a.x - b.x, a.y - b.y, a.z - b.z, Math.max(0, a.z - b.z));
    }

    function Q(x, y, z, w) {
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
        if (!w || w === 1) {
            w = Math.sqrt(1 - (this.x * this.x + this.y * this.y + this.z * this.z));
        }
        this.w = w || 1;
    }

    Q.prototype.copy = function () {
        return new Q(this.x, this.y, this.z, this.w);
    };

    Q.prototype.set = function (x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    };

    Q.prototype.setAll = function (values) {
        this.x = values[0];
        this.y = values[1];
        this.z = values[2];
        this.w = values[3];
    };

    function qmul(a, b, target) {
        // from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm
        var x =  a.x * b.w + a.y * b.z - a.z * b.y + a.w * b.x,
            y = -a.x * b.z + a.y * b.w + a.z * b.x + a.w * b.y,
            z =  a.x * b.y - a.y * b.x + a.z * b.w + a.w * b.z,
            w = -a.x * b.x - a.y * b.y - a.z * b.z + a.w * b.w;

        if (target) {
            target.set(x, y, z, w);
            return target;
        }
        return new Q(x, y, z, w);
    }

    Q.prototype.times = function (other) {
        qmul(this, other, this);
    };

    Q.prototype.invert = function () {
        var squareSum = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
        this.x /= -squareSum;
        this.y /= -squareSum;
        this.z /= -squareSum;
        this.w /= squareSum;
    };

    Q.prototype.inverse = function () {
        var squareSum = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
        return new Q(
            this.x /= -squareSum,
            this.y /= -squareSum,
            this.z /= -squareSum,
            this.w /= squareSum
        );
    };

    function angleAxisQ(angle, axis) {
        // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm
        // assumes axis is normalized
        var s = Math.sin(angle/2);
        return new Q(axis.x * s, axis.y * s, axis.z * s, Math.cos(angle/2));
    }

    function eulerToQ(x, y, z) {
        var cosX = Math.cos(x / 2),    cosY = Math.cos(y / 2),    cosZ = Math.cos(z / 2),
            sinX = Math.sin(x / 2),    sinY = Math.sin(y / 2),    sinZ = Math.sin(z / 2);

        return new Q(
            sinX * cosY * cosZ + cosX * sinY * sinZ,
            cosX * sinY * cosZ - sinX * cosY * sinZ,
            cosX * cosY * sinZ + sinX * sinY * cosZ,
            cosX * cosY * cosZ - sinX * sinY * sinZ
        );
    }

    function makeRotateQ(q) {
        var x2 = q.x + q.x,     y2 = q.y + q.y,     z2 = q.z + q.z,
            xx = q.x * x2,      xy = q.x * y2,      xz = q.x * z2,
            yy = q.y * y2,      yz = q.y * z2,      zz = q.z * z2,
            wx = q.w * x2,      wy = q.w * y2,      wz = q.w * z2;

        return new M([
            1 - ( yy + zz ), xy + wz,         xz - wy,         0,
            xy - wz,         1 - ( xx + zz ), yz + wx,         0,
            xz + wy,         yz - wx,         1 - ( xx + yy ), 0,
            0,               0,               0,               1
        ]);
    }

    function qToEuler(q, order) {
        return makeRotateQ(q).extractEuler(order);
    }

    var AABox = function () {
        this.min = null;
        this.max = null;
    };

    AABox.prototype.contains = function (p) {
        if (this.min === null) {
            return false;
        }
        for (var d = 0; d < D3; ++d) {
            if (p.v(d) < this.min.v(d)) {
                return false;
            }
            if (p.v(d) > this.max.v(d)) {
                return false;
            }
        }
        return true;
    };

    AABox.prototype.envelope = function (p) {
        if(p instanceof AABox) {
            if (p.min) {
                this.envelope(p.min);
                this.envelope(p.max);
            }
        } else if (this.min === null) {
            this.min = p.copy();
            this.max = p.copy();
        } else {
            for (var d = 0; d < D3; ++d) {
                var value = p.v(d);
                if (value < this.min.v(d)) {
                    this.min.setAt(d, value);
                }
                if (value > this.max.v(d)) {
                    this.max.setAt(d, value);
                }
            }
        }
    };

    AABox.prototype.center = function () {
        if (this.min === null) {
            return null;
        }
        var c = this.min.copy();
        c.add(this.max);
        c.scale(0.5);
        return c;
    };

    function perspective(fieldOfView, aspectRatio, near, far) {
        var scale = 1.0 / (near - far),
            f = Math.tan((Math.PI - fieldOfView) / 2);

        return new M([
            f, 0,               0,                      0,
            0, f * aspectRatio, 0,                      0,
            0, 0,               (near + far) * scale,  -1,
            0, 0,               near * far * scale * 2, 0
        ]);
    }

    // Perspective matrix for VR FOV
    // From https://github.com/toji/gl-matrix/blob/master/src/gl-matrix/mat4.js
    function perspectiveFOV(fov, near, far) {
        var right = Math.tan(fov.rightDegrees * R2.DEG_TO_RAD),
            left  = Math.tan(fov.leftDegrees  * R2.DEG_TO_RAD),
            up    = Math.tan(fov.upDegrees    * R2.DEG_TO_RAD),
            down  = Math.tan(fov.downDegrees  * R2.DEG_TO_RAD),
            xRange = right - left,
            yRange = up - down,
            xScale = 1.0 / (right + left),
            yScale = 1.0 / (up + down),
            zScale = 1.0 / (near - far);

        return new M([
            2 * xScale,      0,               0,             0,
            0,               2 * yScale,      0,             0,
            xRange * xScale, yRange * yScale, far * zScale, -1,
            0,               0,        near * far * zScale,  0
        ]);
    }

    function testSuite() {
        var vectorTests = [
            function testConstruct() {
                var v = new V();

                TEST.equals(v.x, 0);
                TEST.equals(v.y, 0);
                TEST.equals(v.z, 0);
                TEST.equals(v.w, 1);

                var ones = new V(1,1,1);

                TEST.equals(ones.x, 1);
                TEST.equals(ones.y, 1);
                TEST.equals(ones.z, 1);
                TEST.equals(ones.w, 1);
            },

            function testLength() {
                var v = new V(3, 4, 12);
                TEST.tolEquals(v.lengthSq(), 13 * 13);
                TEST.tolEquals(v.length(), 13);
            },

            function testNormalize() {
                var v = new V(1, 0, 0);

                v.normalize();

                TEST.equals(v.x, 1);
                TEST.equals(v.y, 0);
                TEST.equals(v.z, 0);
                TEST.equals(v.w, 1);

                var a = new V(1, 1, 1),
                    n = a.normalized();

                TEST.equals(a.x, 1);
                TEST.equals(a.y, 1);
                TEST.equals(a.z, 1);
                TEST.equals(a.w, 1);

                TEST.tolEquals(n.x, 1 / Math.sqrt(3));
                TEST.tolEquals(n.y, 1 / Math.sqrt(3));
                TEST.tolEquals(n.z, 1 / Math.sqrt(3));
                TEST.tolEquals(n.w, 1);
            },

            function testScale() {
                var v = new V(1, -2, 0);
                v.scale(-2);
                TEST.equals(v.x, -2);
                TEST.equals(v.y, 4);
                TEST.equals(v.z, 0);
                TEST.equals(v.w, 1);
            }
        ];

        var matrixTests = [
        ];

        var aaboxTests = [
        ];

        var quaternionTests = [
        ];

        TEST.run("R3 Vector", vectorTests);
        TEST.run("R3 Matrix", matrixTests);
        TEST.run("R3 AABox", aaboxTests);
        TEST.run("Quaternion", quaternionTests);
    }

    return {
        M: M,
        V: V,
        Q: Q,
        AABox: AABox,
        newPoint: function (x, y, z) { return new V(x, y, z, 0); },
        identity: function () { return new M(); },
        origin: function () { return new V(); },
        toOrigin: function (v) { var o = new V(); o.sub(v); return o; },
        zeroQ: function () { return new Q(0, 0, 0, 1); },
        makeRotateX: makeRotateX,
        makeRotateY: makeRotateY,
        makeRotateZ: makeRotateZ,
        makeRotateQ: makeRotateQ,
        matmul: matmul,
        qmul: qmul,
        angleAxisQ: angleAxisQ,
        eulerToQ: eulerToQ,
        qToEuler: qToEuler,
        pointDistanceSq: pointDistanceSq,
        pointDistance: pointDistance,
        addVectors: addVectors,
        subVectors: subVectors,
        perspective: perspective,
        perspectiveFOV: perspectiveFOV,
        testSuite: testSuite
    };
}());
