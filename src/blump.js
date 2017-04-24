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

    function calculateVertex(mesh, parameters, x, y, depth) {
        var pixel = new R3.V(
            depth * (parameters.xOffset + x) / parameters.xFactor,
            depth * (parameters.yOffset - y) / parameters.yFactor,
            -depth
        );
        var normal = pixel.normalized();
        mesh.addVertex(pixel, normal, x * parameters.uScale, y * parameters.vScale);
    }

    function addTris(mesh, index, stride) {
        mesh.addTri(index,    index + stride, index + 1);
        mesh.addTri(index + 1,index + stride, index + stride + 1);
    }

    function lookupDepth(depths, scene, x, y, height, width) {
        return depths[Math.min(height - 1, y) * scene.width + Math.min(scene.width - 1, x)];
    }

    function constructMesh(depths) {
        var height = scene.height,
            width = scene.width,
            xStride = 1,
            yStride = xStride,
            rowIndexWidth = 1 + (width / xStride),
            indexStride = stitch == "simple" ? rowIndexWidth : 2,
            depthScale = 1,
            pixelFOV = fov * R2.DEG_TO_RAD / scene.width,

            parameters = {
                // Following is from http://forums.structure.io/t/getting-colored-point-cloud-data-from-aligned-frames/4094
                // Assume the following intrinsics, from the Structure SDK docs
                // K_RGB_QVGA       = [305.73, 0, 159.69; 0, 305.62, 119.86; 0, 0, 1]
                // Since those numbers are for 320x240, just multiply by 2.
                xOffset:-159.69 * 2,
                yOffset: 119.86 * 2,
                xFactor: 305.73 * 2,
                yFactor: 305.62 * 2,
                uScale: scene.uMax / width,
                vScale: scene.vMax / height
            },
            MAX_INDEX = Math.pow(2, 16),
            SMART_STITCH_MAX_DIFFERENCE = 0.15,
            SMART_STITCH_DIFFERENCE_THRESHOLD = 0.05,
            pixelIndexStride = (stitch == "simple" ? 1 : 4),
            rowVertexCount = pixelIndexStride * ((width / xStride) + 1),
            rowsPerChunk = Math.floor(MAX_INDEX / rowVertexCount) - 1,
            mesh = null,
            meshes = [];

        for (var y = 0; y <= height; y += yStride) {
            var oldMesh = null,
                generateTris = y < height;
            if (generateTris && (y % rowsPerChunk) === 0) {
                oldMesh = mesh;
                mesh = new WGL.Mesh();
                meshes.push(mesh);
            }
            for (var x = 0; x <= width; x += xStride) {
                var depth = lookupDepth(depths, scene, x, y, width, height),
                    index = mesh.index,
                    generateTri = (generateTris && x < width) || stitch == "none";

                if (depth === null) {
                    if (stitch == "smart") {
                        depth = lookupDepth(scene.cleanDepths, scene, x, y, width, height);
                        generateTri = false;
                    } else {
                        continue;
                    }
                }

                if (stitch=="simple") {
                    calculateVertex(mesh, parameters, x, y, depth);
                } else {
                    for (var yi = y; yi <= y+1; ++yi) {
                        for (var xi = x; xi <= x+1; ++xi) {
                            calculateVertex(mesh, parameters, xi, yi, depth);
                        }
                    }
                }

                if (stitch == "smart") {
                    if (generateTri) {
                        var iUL = 0, iUR = 1, iDL = 2, iDR = 3;
                        if (x < width && y < height) {
                            var depthR = lookupDepth(depths, scene, x + 1, y, width, height),
                                depthD = lookupDepth(depths, scene, x, y + 1, width, height),
                                depthDR= lookupDepth(depths, scene, x + 1, y + 1, width, height),
                                threshold = Math.min(SMART_STITCH_MAX_DIFFERENCE,
                                                     depth * SMART_STITCH_DIFFERENCE_THRESHOLD);

                            if (depthR !== null && Math.abs(depth-depthR) <= threshold) {
                                iUR = pixelIndexStride;
                            }
                            if (depthD !== null && Math.abs(depth-depthD) <= threshold) {
                                iDL = pixelIndexStride * rowIndexWidth;
                            }
                            if (depthDR !== null && Math.abs(depth-depthDR) <= threshold) {
                                iDR = pixelIndexStride * (1 + rowIndexWidth);
                            }
                        }
                        mesh.addTri(index + iUL, index + iDL, index + iUR);
                        mesh.addTri(index + iUR, index + iDL, index + iDR);
                    }
                } else if (generateTri) {
                    addTris(mesh, index, indexStride);
                }
            }

            if (oldMesh && stitch != "none") {
                oldMesh.appendVerticies(mesh);
            }
       }

        return meshes;
    }

    return {
        decodeDepth: decodeDepth,
    };
}());
