var R3 = (function () {
    var D4 = 4;

    function at(i, j) {
        return i + j * D4;
    }
    
    function M() {
        this.m = new Float32Array([
            1,0,0,0,
            0,1,0,0,
            0,0,1,0,
            0,0,0,1
        ]);
    }
    
    M.prototype.at = function (i, j) {
      return this.m[at(i, j)];  
    };
    
    function matmul(a, b) {
        var result = new M();
        
        for (var i = 0; i < D4; ++i) {
            for (var j = 0; j <D4; ++j) {
                var value = 0.0;
                for (var k = 0; k < D4; ++k) {
                    value += a.at(i, k) * b.at(k, j);
                }
                result.m[at(i, j)] = value;
            }
        }
        
        return result;
    }
    
    M.prototype.times = function (other) {
        this.m = matmul(this, other).m;
    };
    
    function V() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.w = 0;        
    }
    
    return {
        M: M,
        V: V
    };
}());