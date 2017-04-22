var BLUMP = (function () {
    "use strict";

    var gammaMap = [];

    (function () {
        for (var v = 0; v < IMPROC.BYTE_MAX; ++v) {
            gammaMap[v] = v;
        }
    }());

    function decodeValue(r, g, b, limit) {

    }

    function checkCalibration() {

    }

    function decodeDepth(image, intoMesh) {
        var width = image.width,
            height = image.height / 2,
            zScale = 0,
            zOffset = 0;
        IMPROC.processImage(image, 0, height, width, height,
            function (x, y, r, g, b) {
                if (y < 2) {
                    if (y===0) {
                        
                    } else if (y===1) {
                        checkCalibration(x, r, g, b);
                    }
                }
            }
        );
    }

    return {
        decodeDepth: decodeDepth,
    };
}());
