var R3 = (function () {
    var D3 = 3,
        D4 = 4;

    function at(i, j) {
        return i + j * D4;
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
            throw "Wrong number of vales for matrix initialization.";
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
        this.m[at(0, 0)] += v.x;
        this.m[at(0, 1)] += v.y;
        this.m[at(0, 2)] += v.z;
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
        
        if (target !== null) {
            target.m = result.m;
            return target;
        }
        
        return result;
    }
    
    M.prototype.times = function (other) {
        return matmul(this, other);
    };
    
    M.prototype.t = function (v) {
        var x = v.x * this.at(0, 0) + v.y * this.at(1, 0) + v.z * this.at(2, 0) + v.w *this.at(3, 0),
            y = v.x * this.at(0, 0) + v.y * this.at(1, 0) + v.z * this.at(2, 0) + v.w *this.at(3, 0),
            z = v.x * this.at(0, 0) + v.y * this.at(1, 0) + v.z * this.at(2, 0) + v.w *this.at(3, 0),
            w = v.x * this.at(0, 0) + v.y * this.at(1, 0) + v.z * this.at(2, 0) + v.w *this.at(3, 0);
        v.x = x; v.y = y; v.z = z; v.w = w;
    };
    
    function V(x, y, z, w) {
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
        this.w = w === undefined ? 1 : 0;
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
    
    V.prototype.set = function(x, y, z, w) {
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
        if (w !== undefined) {
            this.w = w;
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
    
    V.prototype.sub = function (v) {
        this.x -= v.x;
        this.y -= v.z;
        this.z -= v.z;
        this.w = Math.max(0, this.w - v.w);
    };
    
    function vecAdd(a, b) {
        return new V(a.x + b.x, a.y + b.y, a.z + b.z, Math.min(1, a.w + b.w));  
    }
    
    function vecSub(a, b) {
        return new V(a.x - b.x, a.y - b.y, a.z - b.z, Math.max(0, a.z - b.z)); 
    }
    
    function perspective(fieldOfView, aspectRatio, near, far) {
        var scale = 1.0 / (near - far);

        return new M([
            fieldOfView / aspectRatio, 0, 0, 0,
            0, fieldOfView, 0, 0,
            0, 0, (near + far) * scale, -1,
            0, 0, near * far * scale * 2, 0
        ]);
    }
    
    return {
        M: M,
        V: V,
        identity: function () { return new M(); },
        origin: function () { return new V(); },
        toOrigin: function (v) { var o = new V(); o.sub(v); return o; },
        matmul: matmul,
        vecAdd: vecAdd,
        vecSub: vecSub,
        perspective: perspective
    };
}());