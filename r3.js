var R3 = (function () {
    const D3 = 3;
    const D4 = 4;
    const TOLERANCE = 1e-6;

    function at(row, column) {
        return row * D4 + column;
    }

    function clamp(v, min, max) {
        return Math.max(Math.min(v, max), min);
    }

    class V extends Object {
        constructor(x, y, z) {
            super();
            this.x = x || 0;
            this.y = y || 0;
            this.z = z || 0;
        }

        copy() {
            return new V(this.x, this.y, this.z);
        }

        copyTo(array, offset) {
            array[offset + 0] = this.x;
            array[offset + 1] = this.y;
            array[offset + 2] = this.z;
            return offset + D3;
        }

        pushOn(array) {
            array.push(this.x);
            array.push(this.y);
            array.push(this.z);
        }

        set(x, y, z) {
            this.x = x || 0;
            this.y = y || 0;
            this.z = z || 0;
        }

        v(i, w) {
            switch(i) {
                case 0: return this.x;
                case 1: return this.y;
                case 2: return this.z;
                case 3: return w || 0;
            }
        }

        setAt(i, value) {
            switch(i) {
                case 0: this.x = value; return;
                case 1: this.y = value; return;
                case 2: this.z = value; return;
            }
        }

        scale(s) {
            this.x *= s;
            this.y *= s;
            this.z *= s;
        }

        scaled(s) {
            return new V(this.x * s, this.y * s, this.z * s);
        }

        add(v) {
            this.x += v.x;
            this.y += v.y;
            this.z += v.z;
        }

        addScaled(v, s) {
            this.x += s * v.x;
            this.y += s * v.y;
            this.z += s * v.z;
        }

        interpolate(v, p) {
            return new V(
                this.x * (1 - p) + v.x * p,
                this.y * (1 - p) + v.y * p,
                this.z * (1 - p) + v.z * p
            );
        }

        sub(v) {
            this.x -= v.x;
            this.y -= v.y;
            this.z -= v.z;
        }

        lengthSq() {
            return this.x * this.x + this.y * this.y + this.z * this.z;
        }

        length() {
            return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        }

        normalize() {
            const length = this.length();
            if (length === 0) {
                return;
            }
            this.x /= length;
            this.y /= length;
            this.z /= length;
        }

        normalized() {
            const length = this.length();
            if (length) {
                return new V(this.x / length, this.y / length, this.z / length);
            }
            return new V();
        }

        dot(v) {
            return this.x * v.x + this.y * v.y + this.z * v.z;
        }

        cross(v) {
            return new V(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x, 0);
        }

        projectedOnV(v) {
            return v.scaled(this.dot(v) / v.lengthSq());
        }
    }

    function pointDistanceSq(a, b) {
        let xDiff = a.x - b.x,
            yDiff = a.y - b.y,
            zDiff = a.z - b.z;
        return xDiff * xDiff + yDiff * yDiff + zDiff * zDiff;
    }

    function pointDistance(a, b) {
        return Math.sqrt(pointDistanceSq(a, b));
    }

    function addVectors(a, b) {
        return new V(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    function subVectors(a, b) {
        return new V(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    function vectorOntoPlane(v, normal) {
        return subVectors(v, v.projectedOnV(normal));
    }

    function closestPointOnLine(aOrigin, aDir, bOrigin, bDir) {
        let offset = R3.subVectors(bOrigin, bOrigin),
            dBA = bDir.dot(aDir),
            denominator = 1 - dBA * dBA;

        if (abs(denominator) < 1e-8) {
            return R3.origin();
        }

        let dOffB = offset.dot(bDir),
            dOffA = offset.dot(aDir),
            numerator = dOffA - dOffB * dBA;

        return R3.addVectors(a, aDir.scaled(numerator / denominator));
    }

    class Q extends Object {
        constructor(x, y, z, w) {
            super();
            this.x = x || 0;
            this.y = y || 0;
            this.z = z || 0;
            if (!w || w === 1) {
                w = Math.sqrt(1 - (this.x * this.x + this.y * this.y + this.z * this.z));
            }
            this.w = w || 1;
        }

        copy() {
            return new Q(this.x, this.y, this.z, this.w);
        }

        set(x, y, z, w) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;
        }

        setAll(values) {
            this.x = values[0];
            this.y = values[1];
            this.z = values[2];
            this.w = values[3];
        }

        static qmul(a, b, target) {
            // from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm
            let x =  a.x * b.w + a.y * b.z - a.z * b.y + a.w * b.x,
                y = -a.x * b.z + a.y * b.w + a.z * b.x + a.w * b.y,
                z =  a.x * b.y - a.y * b.x + a.z * b.w + a.w * b.z,
                w = -a.x * b.x - a.y * b.y - a.z * b.z + a.w * b.w;

            if (target) {
                target.set(x, y, z, w);
                return target;
            }
            return new Q(x, y, z, w);
        }

        times(other) {
           Q.qmul(this, other, this);
        }

        invert() {
            const squareSum = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
            this.x /= -squareSum;
            this.y /= -squareSum;
            this.z /= -squareSum;
            this.w /= squareSum;
        }

        inverse() {
            const squareSum = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
            return new Q(
                this.x /= -squareSum,
                this.y /= -squareSum,
                this.z /= -squareSum,
                this.w /= squareSum
            );
        }
    }

    function angleAxisQ(angle, axis) {
        // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm
        // assumes axis is normalized
        const s = Math.sin(angle/2);
        return new Q(axis.x * s, axis.y * s, axis.z * s, Math.cos(angle/2));
    }

    function eulerToQ(x, y, z) {
        let cosX = Math.cos(x / 2),    cosY = Math.cos(y / 2),    cosZ = Math.cos(z / 2),
            sinX = Math.sin(x / 2),    sinY = Math.sin(y / 2),    sinZ = Math.sin(z / 2);

        return new Q(
            sinX * cosY * cosZ + cosX * sinY * sinZ,
            cosX * sinY * cosZ - sinX * cosY * sinZ,
            cosX * cosY * sinZ + sinX * sinY * cosZ,
            cosX * cosY * cosZ - sinX * sinY * sinZ
        );
    }

    class M extends Object {
        constructor(values) {
            super();
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

        at(row, column) {
            return this.m[at(row, column)];
        }

        setAt(row, column, value) {
            this.m[at(row, column)] = value || 0;
        }

        setAll(values) {
            for (let i = 0; i < values.length; ++i) {
                this.m[i] = values[i];
            }
        }

        setIdentity() {
            for (let r = 0; r < D4; ++r) {
                for (let c = 0; c < D4; ++c) {
                    this.setAt(r, c, r == c ? 1 : 0);
                }
            }
        }

        equals(other, tolerance) {
            tolerance = tolerance || TOLERANCE;
            for (let r = 0; r < D4; ++r) {
                for (let c = 0; c < D4; ++c) {
                    if (Math.abs(this.at(r, c) - other.at(r, c)) > tolerance) {
                        return false;
                    }
                }
            }
            return true;
        }

        translate(v) {
            this.m[at(3, 0)] += v.x;
            this.m[at(3, 1)] += v.y;
            this.m[at(3, 2)] += v.z;
        }

        scale(s) {
            for (let i = 0; i < D3; ++i) {
                this.m[at(i, i)] *= s;
            }
        }

        scaleBy(v) {
            this.m[at(0, 0)] *= v.x;
            this.m[at(1, 1)] *= v.y;
            this.m[at(2, 2)] *= v.z;
        }

        isAffine(tolerance) {
            let x = new V(this.at(0, 0), this.at(0, 1), this.at(0, 2)),
                y = new V(this.at(1, 0), this.at(1, 1), this.at(1, 2)),
                z = new V(this.at(2, 0), this.at(2, 1), this.at(2, 2)),
                xScale = x.length(),
                yScale = y.length(),
                zScale = z.length();
            tolerance = tolerance || TOLERANCE;

            if (Math.abs(yScale - xScale) > tolerance) {
                return false;
            }
            if (Math.abs(zScale - xScale) > tolerance) {
                return false;
            }
            x.scale(1.0/xScale);
            y.scale(1.0/yScale);
            z.scale(1.0/zScale);

            if (Math.abs(x.dot(y)) > tolerance) {
                return false;
            }
            if (Math.abs(x.dot(z)) > tolerance) {
                return false;
            }
            if (Math.abs(y.dot(z)) > tolerance) {
                return false;
            }

            return true;
        }

        // Adapted from setFromRotationMatrix in
        // https://github.com/mrdoob/three.js/blob/dev/src/math/Euler.js
        extractEuler(order, tolerance) {
            let x = 0.0, y = 0.0, z = 0.0;
            tolerance = tolerance || TOLERANCE;
            if (order === "XYZ" || !order) {
                let m20 = this.m[at(2, 0)];
                y = Math.asin(clamp(m20, -1, 1));
                if ((1 - Math.abs(m20)) > tolerance) {
                    x = Math.atan2(-this.m[at(2, 1)], this.m[at(2, 2)]);
                    z = Math.atan2(-this.m[at(1, 0)], this.m[at(0, 0)]);
                } else {
                    x = Math.atan2( this.m[at(1, 2)], this.m[at(1, 1)]);
                }
            } else if (order === "ZYX") {
                let m02 = this.m[at(0, 2)];
                y = Math.asin(-clamp(m02, - 1, 1));
                if ((1 - Math.abs(m02)) > tolerance) {
                    x = Math.atan2( this.m[at(1, 2)], this.m[at(2, 2)]);
                    z = Math.atan2( this.m[at(0, 1)], this.m[at(0, 0)]);
                } else {
                    z = Math.atan2(-this.m[at(1, 0)], this.m[at(1, 1)]);
                }
            } else if (order === "YXZ") {
                let m21 = this.m[at(2, 1)];
                x = Math.asin(-clamp(m21, -1, 1));
                if ((1 - Math.abs(m21)) > tolerance) {
                    y = Math.atan2( this.m[at(2, 0)], this.m[at(2, 2)]);
                    z = Math.atan2( this.m[at(0, 1)], this.m[at(1, 1)]);
                } else {
                    y = Math.atan2(-this.m[at(0, 2)], this.m[at(0, 0)]);
                }
            } else if (order === "ZXY") {
                let m12 = this.m[at(1, 2)];
                x = Math.asin(clamp(m12, -1, 1));
                if ((1 - Math.abs(m12)) > tolerance) {
                    y = Math.atan2(-this.m[at(0, 2)], this.m[at(2, 2)]);
                    z = Math.atan2(-this.m[at(1, 0)], this.m[at(1, 1)]);
                } else {
                    z = Math.atan2( this.m[at(0, 1)], this.m[at(0, 0)]);
                }
            } else if (order === "YZX") {
                let m01 = this.m[at(0, 1)];
                z = Math.asin(clamp(m01, -1, 1));
                if ((1 - Math.abs(m01)) > tolerance) {
                    x = Math.atan2(-this.m[at(2, 1)], this.m[at(1, 1)]);
                    y = Math.atan2(-this.m[at(0, 2)], this.m[at(0, 0)]);
                } else {
                    y = Math.atan2( this.m[at(2, 0)], this.m[at(2, 2)]);
                }
            } else if (order === "XZY") {
                let m10 = this.m[at(1, 0)];
                z = Math.asin(-clamp(m10, -1, 1));
                if ((1 - Math.abs(m10)) > tolerance) {
                    x = Math.atan2( this.m[at(1, 2)], this.m[at(1, 1)]);
                    y = Math.atan2( this.m[at(2, 0)], this.m[at(0, 0)]);
                } else {
                    x = Math.atan2(-this.m[at(2, 1)], this.m[at(2, 2)]);
                }
            } else {
                console.log("Unknown order");
            }
            return new V(x, y, z, 0);
        }

        // Adapted from setFromRotationMatrix in
        // https://github.com/mrdoob/three.js/blob/dev/src/math/Quaternion.js
        // Assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
        extractQuaternion() {
            // http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm
            let m = this.m,
                m11 = m[0], m12 = m[4], m13 = m[8],
                m21 = m[1], m22 = m[5], m23 = m[9],
                m31 = m[2], m32 = m[6], m33 = m[10],
                trace = m11 + m22 + m33,
                s = 0;
            if (trace > 0) {
                s = 0.5 / Math.sqrt( trace + 1.0 );
                return new Q(
                    ( m32 - m23 ) * s,
                    ( m13 - m31 ) * s,
                    ( m21 - m12 ) * s,
                    0.25 / s
                );
            } else if ( m11 > m22 && m11 > m33 ) {
                s = 2.0 * Math.sqrt( 1.0 + m11 - m22 - m33 );
                return new Q(
                    0.25 * s,
                    ( m12 + m21 ) / s,
                    ( m13 + m31 ) / s,
                    ( m32 - m23 ) / s
                );
            } else if ( m22 > m33 ) {
                s = 2.0 * Math.sqrt( 1.0 + m22 - m11 - m33 );
                return new Q(
                    ( m12 + m21 ) / s,
                    0.25 * s,
                    ( m23 + m32 ) / s,
                    ( m13 - m31 ) / s
                );
            } else {
                s = 2.0 * Math.sqrt( 1.0 + m33 - m11 - m22 );
                return new Q(
                    ( m13 + m31 ) / s,
                    ( m23 + m32 ) / s,
                    0.25 * s,
                    ( m21 - m12 ) / s
                );
            }
        }

        // Based on http://paulbourke.net/miscellaneous/determinant/
        determinant(c) {
            c = c || 0; // Arbitrarily choose column c for calculating the determinant.
            let det = 0;
            for (let r = 0; r < D4; ++r) {
                det += this.m[at(r, c)] * Math.pow(-1, c + r) * this.minor(r, c);
            }
            return det;
        }

        static skipIndex(skip, offset) {
            offset = offset % D3;
            return offset < skip ? offset : offset + 1;
        }

        minor(row, column, c) {
            // https://en.wikipedia.org/wiki/Minor_(linear_algebra)
            // Calculate the Minor, which is the determinant of the matrix
            // obtained by ommiting the specified row and column
            c = c || 0; // Arbitrarily choosen column for calculating the determinant from [0,D3)
            let det = 0,
                cA = M.skipIndex(column, c + 0),
                cB = M.skipIndex(column, c + 1),
                cC = M.skipIndex(column, c + 2),
                c0 = Math.min(cB, cC),
                c1 = Math.max(cB, cC);
            for (let r = 0; r < D3; ++r) {
                let rA = M.skipIndex(row, r + 0),
                    rB = M.skipIndex(row, r + 1),
                    rC = M.skipIndex(row, r + 2),
                    r0 = Math.min(rB, rC),
                    r1 = Math.max(rB, rC),
                    det2x2 = this.m[at(r0, c0)] * this.m[at(r1, c1)] -
                            this.m[at(r1, c0)] * this.m[at(r0, c1)];
                det += this.m[at(rA, cA)] * Math.pow(-1, c + r) * det2x2;
            }
            return det;
        }

        // Also based on http://paulbourke.net/miscellaneous/determinant/
        inverse() {
            let det = this.determinant();

            if (det === 0) {
                // If the determinant zero, no inverse exists.
                return null;
            }
            let inv = new M(),
                scale = 1 / det;

            for (let c = 0; c < D4; ++c) {
                for (let r = 0; r < D4; ++r) {
                    let cofactor = Math.pow(-1, r + c) * this.minor(c, r);
                    inv.m[at(r, c)] = cofactor * scale;
                }
            }
            return inv;
        }

        transpose() {
            for (let c = 0; c < D4; ++c) {
                for (let r = c + 1; r < D4; ++r) {
                    let atRC = this.m[at(r, c)];
                    this.m[at(r, c)] = this.m[at(c, r)];
                    this.m[at(c, r)] = atRC;
                }
            }
        }

        transposed(out) {
            let t = new M();
            for (let c = 0; c < D4; ++c) {
                for (let r = 0; r < D4; ++r) {
                    t.m[at(r, c)] = this.m[at(c, r)];
                }
            }
            return t;
        }

        static makeTranslate(v) {
            let m = new M();
            m.translate(v);
            return m;
        }

        static makeScale(s) {
            let m = new M();

            if (s && s instanceof V) {
                m.scaleBy(s);
            } else {
                m.scale(s);
            }
            return m;
        }

        static makeRotateX(theta) {
            let c = Math.cos(theta),
                s = Math.sin(theta);

            return new M([
                1, 0, 0, 0,
                0, c, s, 0,
                0,-s, c, 0,
                0, 0, 0, 1
            ]);
        }

        static makeRotateY(theta) {
            let c = Math.cos(theta),
                s = Math.sin(theta);

            return new M([
                c, 0,-s, 0,
                0, 1, 0, 0,
                s, 0, c, 0,
                0, 0, 0, 1
            ]);
        }

        static makeRotateZ(theta) {
            let c = Math.cos(theta),
                s = Math.sin(theta);

            return new M([
                c, s, 0, 0,
            -s, c, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
        }

        static makeRotateQ(q) {
            let x2 = q.x + q.x,     y2 = q.y + q.y,     z2 = q.z + q.z,
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

        static matmul(a, b, target) {
            let result = null;
            if (target && target != a && target != b) {
                result = target;
                target = null;
            } else {
                result = new M();
            }

            for (let c = 0; c < D4; ++c) {
                for (let r = 0; r < D4; ++r) {
                    let value = 0.0;
                    for (let k = 0; k < D4; ++k) {
                        value += a.at(k, c) * b.at(r, k);
                    }
                    result.m[at(r, c)] = value;
                }
            }

            if (target) {
                target.m = result.m;
                return target;
            }

            return result;
        }

        times(other) {
            return M.matmul(this, other, this);
        };

        transform(v, w) {
            let result = new V();
            for (let c = 0; c < D3; ++c) {
                let value = 0;
                for (let r = 0; r < D4; ++r) {
                    value += v.v(r, w) * this.at(r, c);
                }
                result.setAt(c, value);
            }
            return result;
        };

        transformV(v) {
            return this.transform(v, 0);
        };

        transformP(v) {
            return this.transform(v, 1);
        };

        static perspective(fieldOfView, aspectRatio, near, far) {
            let scale = 1.0 / (near - far),
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
        static perspectiveFOV(fov, near, far) {
            let right = Math.tan(fov.rightDegrees * R2.DEG_TO_RAD),
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
    }

    function qToEuler(q, order) {
        return M.makeRotateQ(q).extractEuler(order);
    }

    class AABox extends Object {
        constructor() {
            super();
            this.min = null;
            this.max = null;
        }

        contains(p) {
            if (this.min === null) {
                return false;
            }
            for (let d = 0; d < D3; ++d) {
                if (p.v(d) < this.min.v(d)) {
                    return false;
                }
                if (p.v(d) > this.max.v(d)) {
                    return false;
                }
            }
            return true;
        };

        envelope(p) {
            if (p instanceof AABox) {
                if (p.min) {
                    this.envelope(p.min);
                    this.envelope(p.max);
                }
            } else if (this.min === null) {
                this.min = p.copy();
                this.max = p.copy();
            } else {
                for (let d = 0; d < D3; ++d) {
                    let value = p.v(d);
                    if (value < this.min.v(d)) {
                        this.min.setAt(d, value);
                    }
                    if (value > this.max.v(d)) {
                        this.max.setAt(d, value);
                    }
                }
            }
        };

        center() {
            if (this.min === null) {
                return null;
            }
            let c = this.min.copy();
            c.add(this.max);
            c.scale(0.5);
            return c;
        };
    }

    function testSuite() {
        function testEqualsV(v, x, y, z, tolerance) {
            if (tolerance !== undefined) {
                TEST.tolEquals(v.x, x, tolerance);
                TEST.tolEquals(v.y, y, tolerance);
                TEST.tolEquals(v.z, z, tolerance);
            } else {
                TEST.equals(v.x, x);
                TEST.equals(v.y, y);
                TEST.equals(v.z, z);
            }
        }

        let vectorTests = [
            function testConstruct() {
                let v = new V();
                testEqualsV(v, 0, 0, 0);

                let ones = new V(1,1,1);
                testEqualsV(ones, 1, 1, 1);
            },

            function testLength() {
                let zero = new V(0, 0, 0),
                    one = new V(1, 0, 0),
                    v = new V(3, 4, 12);

                TEST.tolEquals(zero.lengthSq(), 0);
                TEST.tolEquals(zero.length(), 0);
                TEST.tolEquals(one.lengthSq(), 1);
                TEST.tolEquals(one.length(), 1);
                TEST.tolEquals(v.lengthSq(), 13 * 13);
                TEST.tolEquals(v.length(), 13);
            },

            function testNormalize() {
                let one = new V(1, 0, 0),
                    ones = new V(1, 1, 1),
                    zero = new V(),
                    v = new V(3, 4, 12),
                    n = ones.normalized(),
                    invRoot3 = 1 / Math.sqrt(3);

                one.normalize();
                testEqualsV(one, 1, 0, 0);

                testEqualsV(ones, 1, 1, 1);
                testEqualsV(n, invRoot3, invRoot3, invRoot3);

                testEqualsV(zero.normalized(), 0, 0, 0);
                zero.normalize();
                testEqualsV(zero, 0, 0, 0);

                testEqualsV(v.normalized(), 3 / 13, 4 / 13, 12 / 13, TOLERANCE);
                v.normalize();
                testEqualsV(v, 3 / 13, 4 / 13, 12 / 13, TOLERANCE);
            },

            function testScale() {
                let v = new V(1, -2, 0),
                    zero = new V();
                v.scale(-2);
                testEqualsV(v, -2, 4, 0);
                zero.scale(27);
                testEqualsV(zero, 0, 0, 0);
            },

            function testArithmetic() {
                let a = new V(1, 1, 1),
                    b = new V(3, 4, 12),
                    zero = new V(0, 0, 0),
                    r = addVectors(a, b);

                testEqualsV(r, 4, 5, 13, 1);
                testEqualsV(addVectors(a, zero), a.x, a.y, a.z);
                testEqualsV(subVectors(a, b), -2, -3, -11);

                r = a.copy();
                r.add(b);
                testEqualsV(r, 4, 5, 13);

                r = a.copy();
                r.add(zero);
                testEqualsV(r, a.x, a.y, a.z);

                r = a.copy();
                r.sub(b);
                testEqualsV(r, -2, -3, -11);

                r = a.copy();
                r.sub(zero);
                testEqualsV(r, a.x, a.y, a.z);

                r = a.copy();
                r.addScaled(b, -2);
                testEqualsV(r, -5, -7, -23);
            },

            function testProducts() {
                let zero = new V(),
                    xAxis = new V(1, 0, 0),
                    yAxis = new V(0, 1, 0),
                    bisector = new V(1, 1, 0),
                    thirty = new V(0, Math.sqrt(3), 1),
                    tolerance = 1e-4;

                TEST.equals(zero.dot(xAxis), 0);
                TEST.equals(xAxis.dot(yAxis), 0);
                TEST.equals(xAxis.dot(xAxis), 1);
                TEST.tolEquals(xAxis.dot(bisector), Math.sqrt(2) * Math.cos(Math.PI/4), tolerance);
                TEST.tolEquals(bisector.dot(xAxis), Math.sqrt(2) * Math.cos(Math.PI/4), tolerance);
                TEST.tolEquals(yAxis.dot(thirty), 2 * Math.cos(Math.PI/6), tolerance);

                testEqualsV(zero.cross(xAxis), 0, 0, 0);
                testEqualsV(xAxis.cross(yAxis), 0, 0, 1);
                testEqualsV(xAxis.cross(xAxis), 0, 0, 0);
                testEqualsV(xAxis.cross(bisector), 0, 0, Math.sqrt(2) * Math.sin(Math.PI/4), tolerance);
                testEqualsV(bisector.cross(xAxis), 0, 0,-Math.sqrt(2) * Math.sin(Math.PI/4), tolerance);
                testEqualsV(yAxis.cross(thirty), 2 * Math.sin(Math.PI/6), 0, 0, tolerance);
            }
        ];

        let quaternionTests = [
            function testConstruct() {
                let zero = new Q(),
                    q = new Q(0.6, 0, 0, 0.8),
                    r = new Q(0.6, 0, 0);

                testEqualsV(zero, 0, 0, 0, 1);
                testEqualsV(q, 0.6, 0, 0, 0.8);
                testEqualsV(r, 0.6, 0, 0, 0.8);
            },
            
            function testAngleAxisQ() {
                let xAxis = angleAxisQ(Math.PI/4, new V(1, 0, 0));
                testEqualsV(xAxis, Math.sin(Math.PI/8), 0, 0, Math.cos(Math.PI/8));

                let angle = Math.PI/6,
                    q = angleAxisQ(Math.PI/6, new V(1, -1, 0.5));
                testEqualsV(q, Math.sin(angle/2),
                              -Math.sin(angle/2),
                               Math.sin(angle/2) / 2,
                               Math.cos(angle/2));
            }
        ];

        let matrixTests = [
            function testConstruct() {
                let m = new M(),
                    c = 0, r = 0;

                for (c = 0; c < D4; ++c) {
                    for (r = 0; r < D4; ++r) {
                        TEST.equals(m.at(r, c), r == c ? 1 : 0);
                    }
                }

                let indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
                    a = new M(indices);
                for (c = 0; c < D4; ++c) {
                    for (r = 0; r < D4; ++r) {
                        TEST.equals(a.at(r, c), at(r, c));
                    }
                }
                m.setAll(indices);
                TEST.isTrue(a.equals(m));
            },

            function testTranslate() {
                let t = M.makeTranslate(new V(2, 3, 4)),
                    v = new V(1, 1, 1);

                testEqualsV(t.transformP(v), 3, 4, 5);
                testEqualsV(t.transformV(v), 1, 1, 1);
            },

            function testScale() {
                let uniformScale = M.makeScale(10),
                    v = new V(1, 1, 1);

                testEqualsV(uniformScale.transformP(v), 10, 10, 10);
                testEqualsV(uniformScale.transformV(v), 10, 10, 10);

                let nonUniformScale = M.makeScale(new V(2, 4, 6));

                testEqualsV(nonUniformScale.transformP(v), 2, 4, 6);
                testEqualsV(nonUniformScale.transformV(v), 2, 4, 6);
            },

            function testRotateEuler() {
                let rotX = M.makeRotateX(Math.PI / 2),
                    v = new V(1, 1, 1, 0);

                testEqualsV(rotX.transformP(v), 1, -1, 1, TOLERANCE);
                testEqualsV(rotX.transformV(v), 1, -1, 1, TOLERANCE);
                testEqualsV(rotX.extractEuler(), Math.PI / 2, 0, 0);

                let rotY = M.makeRotateY(Math.PI / 4),
                    root2 = Math.sqrt(2);

                testEqualsV(rotY.transformP(v), root2, 1, 0, TOLERANCE);
                testEqualsV(rotY.transformV(v), root2, 1, 0,TOLERANCE);
                testEqualsV(rotY.extractEuler(), 0, Math.PI / 4, 0, TOLERANCE);

                let rotZ = M.makeRotateZ(Math.PI);

                testEqualsV(rotZ.transformP(v), -1, -1, 1, TOLERANCE);
                testEqualsV(rotZ.transformV(v), -1, -1, 1, TOLERANCE);
                testEqualsV(rotZ.extractEuler(), 0, 0, Math.PI, TOLERANCE);
            },

            function testRotateQ() {
                let i = M.makeRotateQ(new Q());

                testEqualsV(i.transformP(new V(1, 2, 3)), 1, 2, 3);

                let xAxis = angleAxisQ(Math.PI / 2, new V(1, 0, 0)),
                    rotX = M.makeRotateQ(xAxis);

                testEqualsV(rotX.transformP(new V(1, 1, 1)), 1, -1, 1, TOLERANCE);
                testEqualsV(rotX.transformV(new V(1, 1, 1)), 1, -1, 1, TOLERANCE);
                testEqualsV(rotX.extractEuler(), Math.PI / 2, 0, 0, TOLERANCE);
            },

            function testMultiply() {
                let rot = M.makeRotateX(Math.PI / 2),
                    offset = new V(10, 10, -10),
                    trans = M.makeTranslate(offset),
                    transB = M.makeTranslate(new V(5, -4, 3)),
                    rt = M.matmul(rot, trans),
                    tr = M.matmul(trans, rot),
                    tt = M.matmul(trans, transB),
                    v = new V(1, 1, 1);

                testEqualsV(tr.transformP(v), 11, 9, -9, TOLERANCE);
                testEqualsV(tr.transformV(v), 1, -1, 1, TOLERANCE);

                testEqualsV(rt.transformP(v), 11, 9, 11, TOLERANCE);
                testEqualsV(rt.transformV(v), 1, -1, 1, TOLERANCE);

                testEqualsV(offset, tr.at(3, 0), tr.at(3, 1), tr.at(3, 2));

                testEqualsV(tt.transformP(v), 16, 7, -6, TOLERANCE);
                testEqualsV(tt.transformV(v), 1, 1, 1, TOLERANCE);
                testEqualsV(new V(15, 6, -7), tt.at(3, 0), tt.at(3, 1), tt.at(3, 2));
            },

            function testDeterminant() {
                let v = new V(1, -2, 3),
                    a = Math.PI / 2,
                    q = eulerToQ(a, 0, -Math.PI / 3),
                    s = 5;

                TEST.equals(new M().determinant(), 1);
                TEST.equals(M.makeTranslate(v).determinant(), 1);
                TEST.tolEquals(M.makeRotateX(a).determinant(), 1, TOLERANCE);
                TEST.tolEquals(M.makeRotateQ(q).determinant(), 1, TOLERANCE);
                TEST.tolEquals(M.makeScale(s).determinant(), s * s * s, TOLERANCE);
            },

            function testInverse() {
                let v = new V(1, -2, 3),
                    a = Math.PI / 2,
                    q = eulerToQ(a, 0, -Math.PI / 3),
                    s = 5;

                TEST.isTrue(new M().inverse().equals(new M()));
                TEST.isTrue(M.makeTranslate(v).inverse().equals(M.makeTranslate(v.scaled(-1))));
                TEST.isTrue(M.makeRotateX(a).inverse().equals(M.makeRotateX(-a)));
                TEST.isTrue(M.makeRotateQ(q).inverse().equals(M.makeRotateQ(q.inverse())));
                TEST.isTrue(M.makeScale(s).inverse().equals(M.makeScale(1 / s)));
            }
        ];

        let aaboxTests = [
            function testEmpty() {
                let box = new AABox();
                TEST.isNull(box.min);
                TEST.isNull(box.max);
                TEST.isNull(box.center());
                TEST.isFalse(box.contains(new V()));
            },

            function testPoint() {
                let originBox = new AABox(),
                    pointBox = new AABox(),
                    p = new V(5, -1, 2);

                originBox.envelope(new V());
                TEST.isTrue(originBox.contains(new V()));
                TEST.isFalse(originBox.contains(p));
                testEqualsV(originBox.center(), 0, 0, 0);

                pointBox.envelope(p);
                TEST.isTrue(pointBox.contains(p));
                TEST.isFalse(pointBox.contains(new V()));
                testEqualsV(pointBox.center(), p.x, p.y, p.z);
            },

            function testPoints() {
                let box = new AABox();
                    points = [new V(), new V(5, -1, 2), new V(1, 1, -4)];

                for (let p = 0; p < points.length; ++p) {
                    let point = points[p];
                    TEST.isFalse(box.contains(point));
                    box.envelope(point);
                    TEST.isTrue(box.contains(point));
                }

                TEST.isTrue(box.contains(new V(1, 1, 1)));
                TEST.isTrue(box.contains(new V(2, 0, 0)));
                TEST.isFalse(box.contains(new V(5, -1, 2.01)));
                testEqualsV(box.center(), 2.5, 0, -1);
            }
        ];

        TEST.run("R3 Vector", vectorTests);
        TEST.run("Quaternion", quaternionTests);
        TEST.run("R3 Matrix", matrixTests);
        TEST.run("R3 AABox", aaboxTests);
    }

    return {
        M: M,
        V: V,
        Q: Q,
        AABox: AABox,
        identity: function () { return new M(); },
        origin: function () { return new V(); },
        toOrigin: function (v) { return v.scaled(-1); },
        zeroQ: function () { return new Q(0, 0, 0, 1); },
        makeTranslate: M.makeTranslate,
        makeScale: M.makeScale,
        makeRotateX: M.makeRotateX,
        makeRotateY: M.makeRotateY,
        makeRotateZ: M.makeRotateZ,
        makeRotateQ: M.makeRotateQ,
        matmul: M.matmul,
        perspective: M.perspective,
        perspectiveFOV: M.perspectiveFOV,
        qmul: Q.qmul,
        angleAxisQ: angleAxisQ,
        eulerToQ: eulerToQ,
        qToEuler: qToEuler,
        pointDistanceSq: pointDistanceSq,
        pointDistance: pointDistance,
        addVectors: addVectors,
        subVectors: subVectors,
        vectorOntoPlane: vectorOntoPlane,
        closestPointOnLine: closestPointOnLine,
        testSuite: testSuite
    };
}());
