var BLUMP = (function () {
    "use strict";

    var gammaMap = [];

    (function () {
        for (var v = 0; v < IMPROC.BYTE_MAX; ++v) {
            gammaMap[v] = v;
        }
    }());

    function decodeValue(r, g, b, limit) {
        var value = b;
        value *= limit;
        value += g;
        value *= limit;
        value += r;
        return value;
    }

    function checkCalibration(x, r, g, b) {
        if (x != r || x != g || x != b) {
            if (r != g || r != b) {
                console.log("Mismatched channels:", r, g, b);
            } else {
                console.log("Remapped:", r, "=", x);
            }
            gammaMap[r] = x;
        } 
    }

    function decodeDepth(image, intoMesh) {
        var width = image.width,
            height = image.height / 2,
            zScale = 0,
            zOffset = 0,
            isCalibrated = false,
            start = 450,
            range = 150,
            depths = new Float32Array(width * height);
        IMPROC.processImage(image, 0, height, width, height,
            function (x, y, r, g, b) {
                var value = -1;
                if (y < 2) {
                    if (y === 0) {
                        if (x === 0) {
                            if (r == 0 && g == IMPROC.BYTE_MAX && b == IMPROC.BYTE_MAX) {
                                isCalibrated = true;
                            }
                        } else if (isCalibrated) {
                            if (x == 1) {
                                range = decodeValue(r, g, b);
                            } else if (x == 2) {
                                start = decodeValue(r, g, b)
                            }
                        }
                    } else if (y === 1 && isCalibrated) {
                        checkCalibration(x, r, g, b);
                    }
                } else {
                    if (r == g && r == b) {
                        value = (r / 255.0) * range;
                    }
                }
                depths[y * width + x] = value;
            }
        );
    }

    return {
        decodeDepth: decodeDepth,
    };
}());
