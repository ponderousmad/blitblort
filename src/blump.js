var BLUMP = (function () {
    "use strict";

    var gammaMap = [],
        MAX_VERTICIES = Math.pow(2, 16);

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

    function decodeDepths(image, left, top, width, height, useCalibration) {
        var zScale = 0,
            zOffset = 0,
            isCalibrated = false,
            start = 450,
            range = 150,
            depths = new Float32Array(width * height);
        IMPROC.processImage(image, left, top, width, height,
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

    function Builder(width, height, pixelSize) {
        this.width = width;
        this.height = height;
        this.pixelSize = pixelSize;

        this.setAlignment(0.5, 0.5);
        this.uMin = 0;
        this.uMax = 0;
        this.uScale = 1;
        this.vScale = 1;

        this.defaultBottom = 0;
        this.color = [1, 1, 1, 1];
    }

    Builder.prototype.setAlignment = function (alignX, alignY) {
        this.xOffset = this.width * alignX;
        this.yOffset = this.height * alignY;
    }

    Builder.prototype.setupTextureSurface = function (coords) {
        this.uMin = coords.uMin;
        this.vMin = coords.vMin;
        this.uScale = coords.uSize / this.width;
        this.vScale = coords.vSize / this.height;
    }

    Builder.prototype.setupTextureWalls = function (coords) {
        this.uMin = coords.uMin;
        this.vMin = coords.vMin;
        this.uScale = coords.uSize;
        this.vScale = coords.vSize;
    }

    Builder.prototype.calculatePosition = function (x, y, depth) {
        var yIndex = (this.height - y) - this.yOffset,
            xIndex = x - this.xOffset;
        return new R3.V(
            xIndex * this.pixelSize,
            yIndex * this.pixelSize,
            depth
        );
    }

    Builder.prototype.addSurfaceVertex = function (mesh, x, y, depth, leftDepth, upperDepth) {
        var position = this.calculatePosition(x, y, depth),
            left = new R3.V(-this.pixelSize, 0, depth - leftDepth),
            up = new R3.V(0, -this.pixelSize, depth - upperDepth),
            normal = left.cross(up),
            u = this.uMin + x * this.uScale,
            v = this.vMin + y * this.vScale;
        normal.normalize();
        mesh.addVertex(position, normal, u, v, this.color);
    }

    function depthIndex(x, y, width, height) {
        return Math.min(height - 1, y) * width + Math.min(width - 1, x);
    }

    function lookupDepth(depths, x, y, width, height) {
        return depths[depthIndex(x, y, width, height)];
    }

    function vertexIndex(x, y, width) {
        return x + (y * (width + 1));
    }

    Builder.prototype.constructSurface = function (depths, texture) {
        var width = this.width,
            height = this.height,
            validHeight = Math.floor(MAX_VERTICIES / (width + 1)) - 1,
            mesh = new WGL.Mesh();

        if (height > validHeight) {
            throw "Image too large";
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

                this.addSurfaceVertex(mesh, x, y, depth, prevDepth, upperDepth);

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

        mesh.image = texture;
        mesh.finalize();
        return mesh;
    }

    Builder.prototype.addWallVertices = function (mesh, x, y, uFraction) {
        var i = depthIndex(x, y, this.width, this.height),
            top = this.topDepths[i],
            bottom = this.bottomDepths ? this.bottomDepths[i] :
                                         this.defaultBottom,
            position = this.calculatePosition(x, y, bottom),
            u = this.uMin + uFraction * this.uScale,
            v = this.vMin + this.vScale;
        mesh.addVertex(position, this.wallNormal, u, v, this.color);
        position.z = top;
        v = this.vMin;
        mesh.addVertex(position, this.wallNormal, u, v, this.color);
    }

    Builder.prototype.extendWall = function (mesh, x, y, addTris) {
        this.addWallVertices(mesh, x, y, this.uIndex * this.uStep);
        if (addTris) {
            var i = 2 * (this.quadIndex - 1);
            mesh.addTri(i + 0, i + 2, i + 1);
            mesh.addTri(i + 1, i + 2, i + 3);
            this.uIndex += 1;
        }
        this.quadIndex += 1;
    }

    Builder.prototype.constructWall = function(bottomDepths, topDepths, texture) {
        var width = this.width,
            height = this.height,
            mesh = new WGL.Mesh();

        if ((4 * (width + height + 2)) > MAX_VERTICIES) {
            throw "Wall too large";
        }

        this.topDepths = topDepths;
        this.bottomDepths = bottomDepths;
        this.quadIndex = 0;
        this.uIndex = 0;
        this.uStep = 0.5 / (width + height);

        this.wallNormal = new R3.V(0, -1, 0);
        for (var xUp = 0; xUp <= width; ++xUp) {
            this.extendWall(mesh, xUp, 0, xUp > 0);
        }
        this.wallNormal = new R3.V(1, 0, 0);
        for (var yUp = 0; yUp <= height; ++yUp) {
            this.extendWall(mesh, width, yUp, yUp > 0);
        }
        this.wallNormal = new R3.V(0, -1, 0);
        for (var xDown = width; xDown  >= 0; --xDown) {
            this.extendWall(mesh, xDown, height, xDown < height);
        }
        this.wallNormal = new R3.V(-1, 0, 0);
        for (var yDown = height; yDown >= 0; --yDown) {
            this.extendWall(mesh, 0, yDown, yDown < height);
        }

        mesh.image = texture;
        mesh.finalize();
        return mesh;
    }

    Builder.prototype.depthFromPaired = function(image, useCalibration) {
        return decodeDepths(
            image,
            0, this.height,
            this.width, this.height,
            useCalibration
        );
    }

    function setupForPaired(image, pixelSize, textureAtlas) {
        var width = image.width,
            height = image.height / 2,
            builder = new Builder(width, height, pixelSize);

        if (textureAtlas) {
            builder.setupTextureSurface(textureAtlas.add(image, 0, 0, width, height));
        }
        return builder;
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
        var atlas = new WGL.TextureAtlas(image.width, image.height / 2, 1),
            builder = setupForPaired(image, 0.0006, atlas),
            depths = builder.depthFromPaired(image, false);
        builder.setAlignment(0.5, 0);
        this.meshes.push(builder.constructSurface(depths, atlas.texture()));
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
        setupForPaired: setupForPaired,
        BlumpTest: BlumpTest
    };
}());
