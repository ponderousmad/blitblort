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

    function decodeDepths(image, useCalibration) {
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
                if (useCalibration && y < 2) {
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
                depths[y * width + x] = value / 1000.0;
            }
        );
        return depths;
    }

    function calculateVertex(mesh, parameters, x, y, depth, leftDepth, upperDepth) {
        var yIndex = (parameters.height - y) - parameters.yOffset,
            xIndex = x - parameters.xOffset,
            texCoords = parameters.textureCoords,
            pixel = new R3.V(
                xIndex * parameters.pixelSize,
                yIndex * parameters.pixelSize,
                depth
            ),
            left = new R3.V(-parameters.pixelSize, 0, depth - leftDepth),
            up = new R3.V(0, -parameters.pixelSize, depth - upperDepth),
            normal = left.cross(up),
            u = texCoords.uMin + x * parameters.uScale,
            v = texCoords.vMin + y * parameters.vScale;
        normal.normalize();
        mesh.addVertex(pixel, normal, u, v);
    }

    function lookupDepth(depths, x, y, width, height) {
        return depths[Math.min(height - 1, y) * width + Math.min(width - 1, x)];
    }

    function vertexIndex(x, y, width) {
        return x + (y * (width + 1));
    }

    function constructMesh(depths, parameters) {
        var width = parameters.width,
            height = parameters.height,
            validHeight = Math.floor(Math.pow(2, 16) / (width + 1)) - 1,
            mesh = new WGL.Mesh();

        if (height > validHeight) {
            throw "Image too large";
            return mesh;
        }

        for (var y = 0; y <= height; ++y) {
            var generateTris = y > 0,
                prevDepth = -1,
                lowerLeft = false;
            for (var x = 0; x <= width; ++x) {
                var depth = lookupDepth(depths, x, y, width, height),
                    upperDepth = lookupDepth(depths, x, y-1, width, height),
                    generateTri = (generateTris && x > 0),
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
                            mesh.addTri(iUR, iLR, iLL);
                            mesh.addTri(iUR, iLL, iUL);
                        } else if(!upperLeft) {
                            mesh.addTri(iUR, iLR, iLL);
                        } else if (!upperRight) {
                            mesh.addTri(iUL, iLR, iLL);
                        } else if (!lowerLeft) {
                            mesh.addTri(iUL, iLR, iUR);
                        } else if (!lowerRight) {
                            mesh.addTri(iUL, iUR, iLL);
                        }
                    }
                }
                prevDepth = depth;
                lowerLeft = lowerRight;
            }
        }

        return mesh;
    }

    function imageToMesh(image, textureAtlas, parameters) {
        if (!parameters) {
            parameters = {
                alignX: 0.5,
                alignY: 0.5,
                useCalibration: false,
                pixelSize: 1
            };
        }
        var width = image.width,
            height = image.height / 2;
        parameters.width = width;
        parameters.height = height;
        parameters.xOffset = width * parameters.alignX;
        parameters.yOffset = height * parameters.alignY;

        parameters.textureCoords = textureAtlas.add(image, width, height);
        parameters.uScale = parameters.textureCoords.uSize / width;
        parameters.vScale = parameters.textureCoords.vSize / height;

        var depths = decodeDepths(image, parameters.useCalibration),
            mesh = constructMesh(depths, parameters);
        mesh.image = textureAtlas.texture();
        mesh.finalize();
        return mesh;
    }

    function BlumpTest(viewport) {
        this.clearColor = [0, 0, 0, 1];
        this.maximize = viewport === "safe";
        this.updateInDraw = true;
        this.updateInterval = 16;
        this.angle = -Math.PI / 2;
        this.viewport = viewport ? viewport : "canvas";
        this.meshes = [];
        this.program = null;
    }

    BlumpTest.prototype.update = function (now, elapsed, keyboard, pointer) {
        this.angle += elapsed * Math.PI * 0.0001;
    };

    BlumpTest.prototype.drawMeshes = function (room) {
        if (this.meshes !== null) {
            for (var m = 0; m < this.meshes.length; ++m) {
                room.drawMesh(this.meshes[m], this.program);
            }
        }
    };

    BlumpTest.prototype.loadBlump = function (image) {
        this.atlas = new WGL.TextureAtlas(image.width, image.height / 2, 1);
        var parameters = {
            pixelSize: 0.0006,
            alignX: -0.5,
            alignY: 0,
            useCalibration: false
        };
        this.meshes.push(imageToMesh(image, this.atlas, parameters));
    };

    BlumpTest.prototype.render = function (room, width, height) {
        room.clear(this.clearColor);
        if (this.program === null) {
            var shader = room.programFromElements("vertex-test", "fragment-test"),
                self = this;
            this.program = {
                shader: shader,
                mvUniform: "uMVMatrix",
                perspectiveUniform: "uPMatrix",
                normalUniform: "uNormalMatrix",
                vertexPosition: room.bindVertexAttribute(shader, "aPos"),
                vertexNormal: room.bindVertexAttribute(shader, "aNormal"),
                vertexUV: room.bindVertexAttribute(shader, "aUV"),
                vertexColor: room.bindVertexAttribute(shader, "aColor"),
                textureVariable: "uSampler"
            };
            
            room.viewer.near = 0.01;
            room.viewer.far = 10;
            room.gl.enable(room.gl.CULL_FACE);
            this.batch = new BLIT.Batch("images/");
            this.batch.load("blump.png", function(image) {
                 self.loadBlump(image);
            });
            this.batch.commit();
        }
        if (!this.batch.loaded) {
            return;
        }
        if (room.viewer.showOnPrimary()) {
            var d = 0.2,
                x = Math.cos(this.angle) * d,
                z = Math.sin(this.angle) * d,
                h = 0.05;
            room.viewer.positionView(new R3.V(x, h, z), new R3.V(0, h, 0), new R3.V(0, 1, 0));
            room.setupView(this.program, this.viewport);
            this.drawMeshes(room);
        }
    };

    return {
        decodeDepths: decodeDepths,
        imageToMesh: imageToMesh,
        BlumpTest: BlumpTest
    };
}());