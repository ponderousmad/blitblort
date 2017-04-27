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

    function decodeDepths(image) {
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
                            if (r === 0 && g == IMPROC.BYTE_MAX && b == IMPROC.BYTE_MAX) {
                                isCalibrated = true;
                            }
                        } else if (isCalibrated) {
                            if (x == 1) {
                                range = decodeValue(r, g, b);
                            } else if (x == 2) {
                                start = decodeValue(r, g, b);
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
        return depths;
    }

    function calculateVertex(mesh, parameters, x, y, depth, leftDepth, upperDepth) {
        var fromBottom = parameters.height - y,
            fromCenter = x - parameters.halfWidth,
            pixel = new R3.V(
                fromCenter * parameters.pixelSize,
                fromBottom * parameters.pixelSize,
                depth
            ),
            left = new R3.V(-parameters.pixelSize, 0, leftDepth - depth),
            up = new R3.V(0, -parameters.pixelSize, upperDepth - depth),
            normal = left.cross(up),
            u = parameters.uMin + x * parameters.uScale,
            v = parameters.vMin + y * parameters.vScale;
        normal.normalize();
        mesh.addVertex(pixel, normal, u, v);
    }

    function lookupDepth(depths, x, y, height, width) {
        return depths[Math.min(height - 1, y) * width + Math.min(width - 1, x)];
    }

    function vertexIndex(x, y, width) {
        return x + y * (width + 1);
    }

    function constructMesh(depths, width, height, pixelSize, textureCoords) {
        var parameters = {
                width: width,
                height: height,
                pixelSize: pixelSize,
                uMin: textureCoords.uMin,
                vMin: textureCoords.vMin,
                uScale: textureCoords.uSize / width,
                vScale: textureCoords.vSize / height
            },
            validHeight = Math.floor(Math.pow(2, 16) / (width + 1)) - 1,
            mesh = new WGL.Mesh();

        if (height > validHeight) {
            console.log("Image too large");
            return mesh;
        }

        for (var y = 0; y <= height; ++y) {
            var generateTris = y > 1,
                prevDepth = -1,
                lowerLeft = false;
            for (var x = 0; x <= width; ++x) {
                var depth = lookupDepth(depths, x, y, width, height),
                    upperDepth = lookupDepth(depths, x, y-1, width, height),
                    generateTri = (generateTris && x > 1),
                    lowerRight = depth >= 0,
                    corners = lowerLeft + lowerRight;

                calculateVertex(mesh, parameters, x, y, depth, prevDepth, upperDepth);

                if (generateTri && corners > 0) {
                    var upperLeft = lookupDepth(depths, x-1, y-1, width, height) >= 0,
                        upperRight = upperDepth >= 0,
                        iUL = vertexIndex(x-1, y-1, width),
                        iUR = vertexIndex(x,   y-1, width),
                        iLL = vertexIndex(x-1, y,   width),
                        iLR = vertexIndex(x,   y,   width);

                    corners += upperLeft + upperRight;
                    if (corners > 3) {
                        if (corners == 4) {
                            mesh.addTri(iUR, index + iLL, index + iLR);
                            mesh.addTri(iUL, index + iLR, index + iUR);
                        } else if(!upperLeft) {
                            mesh.addTri(iUR, index + iLL, index + iLR);
                        } else if (!upperRight) {
                            mesh.addTri(iUL, index + iLL, index + iLR);
                        } else if (!lowerLeft) {
                            mesh.addTri(iUL, index + iLR, index + iUR);
                        } else if (!lowerRight) {
                            mesh.addTri(iUL, index + iLL, index + iUR);
                        }
                    }
                }
                prevDepth = depth;
                lowerLeft = lowerRight;
            }
        }

        return mesh;
    }

    function imageToMesh(image, pixelSize, textureAtlas) {
        var depths = decodeDepths(image),
            width = image.width,
            height = image.height / 2,
            textureCoords = textureAtlas.add(image, width, height);

        return constructMesh(depths, width, height, pixelSize, textureCoords);
    }

    return {
        decodeDepths: decodeDepths,
        atlasTexture: atlasTexture,
        imageToMesh: imageToMesh
    };
}());
