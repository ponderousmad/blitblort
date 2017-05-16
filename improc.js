var IMPROC = (function () {
    "use strict";

    var CHANNELS = 4,
        R = 0, G = 1, B = 2, A = 3,
        BYTE_MAX = 255;

    function byteToUnitValue(value) {
        return ((2.0 * value) / BYTE_MAX) - 1;
    }

    function byteToFraction(value) {
        return (value / 255.0);
    }

    function processPixels(pixels, width, height, filter) {
        for (var y = 0; y < height; ++y) {
            for (var x = 0; x < width; ++x) {
                var i = (y * width + x) * CHANNELS,
                result = filter(x, y, pixels[i+R], pixels[i+G], pixels[i+B], pixels[i+A]);
                if (result) {
                    for (var c = 0; c < result.length; ++c) {
                        pixels[i + c] = result[c];
                    }
                }
            }
        }
    }

    var scratchCanvas = null,
        scratchContext = null;

    function getPixels(image, x, y, width, height) {
        if (scratchCanvas === null) {
            scratchCanvas = document.createElement('canvas');
            scratchContext = scratchCanvas.getContext('2d');
        }

        scratchCanvas.width = width;
        scratchCanvas.height = height;
        scratchContext.clearRect(0, 0, width, height);

        scratchContext.drawImage(image, x, y, width, height, 0, 0, width, height);

        return scratchContext.getImageData(0, 0, width, height);
    }

    function cropImage(image, x, y, width, height) {
        var canvas = document.createElement('canvas'),
            context = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, canvas.width, canvas.height);

        context.drawImage(image, x, y, width, height, 0, 0, width, height);

        return canvas;
    }

    function processImage(image, x, y, width, height, filter) {
        var pixelBuffer = getPixels(image, x, y, width, height);
        processPixels(pixelBuffer.data, width, height, filter);
        return pixelBuffer;
    }

    function testSuite() {
        var testConvertions = function () {
                    TEST.equals(byteToUnitValue(0), -1);
                TEST.equals(byteToUnitValue(255), 1);
                TEST.tolEquals(byteToUnitValue(127), -0.004, 0.0005);

                TEST.equals(byteToFraction(0), 0);
                TEST.equals(byteToFraction(255), 1);
                TEST.tolEquals(byteToFraction(127), 0.498, 0.0005);
            },
            testCrop = function () {
                var canvas = document.createElement('canvas'),
                    context = canvas.getContext('2d');

                canvas.width = 20;
                canvas.height = 40;

                context.clearRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = "rgb(255, 0, 0)";
                context.fillRect(5, 5, 10, 10);

                var cropped = cropImage(canvas, 5, 5, 10, 10);
                TEST.equals(cropped.width, 10);
                TEST.equals(cropped.height, 10);
            },
            testProcess = function () {
                var canvas = document.createElement('canvas'),
                    context = canvas.getContext('2d');

                canvas.width = 20;
                canvas.height = 40;

                context.clearRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = "rgb(255, 0, 0)";
                context.fillRect(5, 5, 10, 10);

                var count = 0;
                processImage(canvas, 5, 5, 10, 10, function (x, y, r, g, b) {
                    if (r == 255  && g === 0 && b === 0) {
                        ++count;
                    }
                });

                TEST.equals(count, 100);
            };

            testConvertions();
            testCrop();
            testProcess();
    }

    return {
        CHANNELS: CHANNELS,
        BYTE_MAX: BYTE_MAX,
        byteToUnitValue: byteToUnitValue,
        byteToFraction: byteToFraction,
        getPixels: getPixels,
        processPixels: processPixels,
        processImage: processImage,
        cropImage: cropImage,
        testSuite: testSuite
    };
}());
