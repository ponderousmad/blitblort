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

    function decodeDepths(image, left, top, width, height, useCalibration, defaultRange) {
        var zScale = 0,
            zOffset = 0,
            isCalibrated = false,
            start = 450,
            range = defaultRange ? defaultRange : 210,
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

    function smoothIndex(x, y, width) {
        return x + y * width;
    }

    function smoothDepths(depths, width, height, smoothThreshold, smoothFactor) {
        var result = new Float32Array(depths.length),
            threshold = smoothThreshold ? smoothThreshold : 0.02,
            smoothing = smoothFactor ? smoothFactor : 0.1;
        for (var y = 0; y < height; ++y) {
            for (var x = 0; x < width; ++x) {
                var count = 0,
                    sum = 0,
                    index = smoothIndex(x, y, width),
                    depth = depths[index],
                    coords = [];
                if (depth >= 0) {
                    for (var yi = y > 0 ? y-1 : y; yi < Math.min(height, y+2); ++yi) {
                        for (var xi = x > 0 ? x-1 : x; xi < Math.min(width, x+2); ++xi) {
                            if (xi != x || yi != y) {
                                coords.push([xi, yi]);
                                var value = depths[smoothIndex(xi, yi, width)];
                                if (value >= 0) {
                                    var diff = value - depth;
                                    if (Math.abs(diff) < threshold) {
                                        ++count;
                                        sum += value;
                                    }
                                }
                            }
                        }
                    }
                    if (count > 0) {
                        var averageDifference = depth - (sum / count);
                        depth += averageDifference * smoothing;
                    }
                }
                result[index] = depth;
            }
        }
        return result;
    }

    function Builder(width, height, pixelSize) {
        this.width = width;
        this.height = height;
        this.pixelSize = pixelSize;

        this.setAlignment(0.5, 0.5, 0);
        this.transform = new R3.M();
        this.inverse = this.transform;
        this.uMin = 0;
        this.uMax = 0;
        this.uScale = 1;
        this.vScale = 1;

        this.defaultBottom = 0;
        this.color = [1, 1, 1, 1];
    }

    Builder.prototype.setAlignment = function (alignX, alignY, depthOffset) {
        this.xOffset = this.width * alignX;
        this.yOffset = this.height * alignY;
        this.depthOffset = depthOffset;
    };

    Builder.prototype.applyTransform = function (transform) {
        this.transform = transform;
        this.inverse = transform.inverse();
    };

    Builder.prototype.setupTextureSurface = function (coords) {
        this.uMin = coords.uMin;
        this.vMin = coords.vMin;
        this.uScale = coords.uSize / this.width;
        this.vScale = coords.vSize / this.height;
    };

    Builder.prototype.setupTextureWalls = function (coords) {
        this.uMin = coords.uMin;
        this.vMin = coords.vMin;
        this.uScale = coords.uSize;
        this.vScale = coords.vSize;
    };

    Builder.prototype.calculatePosition = function (x, y, depth) {
        var yIndex = (this.height - y) - this.yOffset,
            xIndex = x - this.xOffset;
        return new R3.V(
            xIndex * this.pixelSize,
            yIndex * this.pixelSize,
            depth + this.depthOffset
        );
    };

    Builder.prototype.addSurfaceVertex = function (mesh, x, y, depth, dLeft, dTop, dRight, dBottom) {
        var position = this.calculatePosition(x, y, depth),
            left = new R3.V(2 * this.pixelSize, 0, dLeft - dRight),
            up = new R3.V(0, 2 * this.pixelSize, dTop - dBottom),
            normal = left.cross(up),
            u = this.uMin + x * this.uScale,
            v = this.vMin + y * this.vScale;
        normal.normalize();
        mesh.addVertex(
            this.transform.transformP(position),
            this.inverse.transformV(normal),
            u, v, this.color
        );
    };

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
                dLeft = -1,
                dRight = lookupDepth(depths, 0, y, width, height),
                lowerLeft = false;
            for (var x = 0; x <= width; ++x) {
                var depth = dRight,
                    dTop = lookupDepth(depths, x, y-1, width, height),
                    dBottom = lookupDepth(depths, x, y+1, width, height),
                    generateTri = (generateTris && x > 0),
                    lowerRight = depth >= 0,
                    corners = lowerLeft + lowerRight;
                dRight = lookupDepth(depths, x+1, y, width, height);

                this.addSurfaceVertex(mesh, x, y, depth, dLeft, dTop, depth, depth);

                if (generateTri && corners > 0) {
                    var upperLeft = lookupDepth(depths, x-1, y-1, width, height) >= 0,
                        upperRight = dTop >= 0,
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
                dLeft = depth;
                lowerLeft = lowerRight;
            }
        }

        mesh.image = texture;
        mesh.finalize();
        return mesh;
    };

    Builder.prototype.updateSurface = function (mesh, depths) {
        var width = this.width,
            height = this.height,
            vertexIndex = 0;

        for (var y = 0; y <= height; ++y) {
            for (var x = 0; x <= width; ++x) {
                var depth = lookupDepth(depths, x, y, width, height);
                mesh.glVertices[vertexIndex + 2] = depth + this.depthOffset;
                vertexIndex += 3;
            }
        }
        mesh.updated = true;
    };

    Builder.prototype.addWallVertices = function (mesh, x, y, uFraction) {
        var i = depthIndex(x, y, this.width, this.height),
            top = this.topDepths[i],
            bottom =  this.bottomDepths ? this.bottomDepths[i] :
                                          this.defaultBottom,
            position = this.calculatePosition(x, y, bottom),
            u = this.uMin + uFraction * this.uScale,
            v = this.vMin + this.vScale;
        mesh.addVertex(position, this.wallNormal, u, v, this.color);
        position.z = top + this.depthOffset;
        v = this.vMin;
        mesh.addVertex(position, this.wallNormal, u, v, this.color);
    };

    Builder.prototype.updateWallVertices = function (mesh, x, y, index) {
        var i = depthIndex(x, y, this.width, this.height),
            top = this.topDepths[i],
            bottom = this.bottomDepths ? this.bottomDepths[i] :
                                         this.defaultBottom;
        mesh.glVertices[index + 2] = bottom + this.depthOffset;
        mesh.glVertices[index + 5] = top + this.depthOffset;
        return index + 6;
    };

    Builder.prototype.extendWall = function (mesh, x, y, addTris) {
        this.addWallVertices(mesh, x, y, this.uIndex * this.uStep);
        if (addTris) {
            var i = 2 * (this.quadIndex - 1);
            mesh.addTri(i + 0, i + 2, i + 1);
            mesh.addTri(i + 1, i + 2, i + 3);
            this.uIndex += 1;
        }
        this.quadIndex += 1;
    };

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
    };

    Builder.prototype.updateWall = function(mesh, bottomDepths, topDepths) {
        var width = this.width,
            height = this.height,
            index = 0;

        this.topDepths = topDepths;
        this.bottomDepths = bottomDepths;
        for (var xUp = 0; xUp <= width; ++xUp) {
            index = this.updateWallVertices(mesh, xUp, 0, index);
        }
        this.wallNormal = new R3.V(1, 0, 0);
        for (var yUp = 0; yUp <= height; ++yUp) {
            index = this.updateWallVertices(mesh, width, yUp, index);
        }
        this.wallNormal = new R3.V(0, -1, 0);
        for (var xDown = width; xDown  >= 0; --xDown) {
            index = this.updateWallVertices(mesh, xDown, height, index);
        }
        this.wallNormal = new R3.V(-1, 0, 0);
        for (var yDown = height; yDown >= 0; --yDown) {
            index = this.updateWallVertices(mesh, 0, yDown, index);
        }
        mesh.updated = true;
    };

    Builder.prototype.depthFromPaired = function(image, useCalibration, defaultRange) {
        return decodeDepths(
            image,
            0, this.height,
            this.width, this.height,
            useCalibration,
            defaultRange
        );
    };

    function setupForPaired(image, pixelSize, textureAtlas) {
        var width = image.width,
            height = image.height / 2,
            builder = new Builder(width, height, pixelSize);

        if (textureAtlas) {
            builder.setupTextureSurface(textureAtlas.add(image, 0, 0, width, height));
        }
        return builder;
    }

    function BlumpTest(viewport, drawAll) {
        this.clearColor = [0, 0, 0, 1];
        this.maximize = viewport === "safe";
        this.updateInDraw = true;
        this.updateInterval = 16;
        this.viewport = viewport ? viewport : "canvas";
        this.blump = null;
        this.meshes = [];
        this.program = null;
        this.drawAll = drawAll ? true : false;

        var self = this,
            blumpImages = [];
        this.batch = new BLIT.Batch("images/", function() {
            self.loadBlumps(blumpImages);
        });
        blumpImages.push([0,   this.batch.load("dragon_0.png")]);
        blumpImages.push([45,  this.batch.load("dragon_45.png")]);
        blumpImages.push([90,  this.batch.load("dragon_90.png")]);
        blumpImages.push([135, this.batch.load("dragon_135.png")]);
        blumpImages.push([180, this.batch.load("dragon_180.png")]);
        blumpImages.push([225, this.batch.load("dragon_225.png")]);
        blumpImages.push([270, this.batch.load("dragon_270.png")]);
        blumpImages.push([315, this.batch.load("dragon_315.png")]);
        this.batch.commit();
    }

    BlumpTest.prototype.loadBlumps = function (images) {
        var first = images[0][1],
            atlas = new WGL.TextureAtlas(first.width, first.height / 2, images.length);
        for (var i = 0; i < images.length; ++i) {
            var entry = images[i],
                angle = R2.clampAngle(entry[0] * R2.DEG_TO_RAD),
                image = entry[1];
            var builder = setupForPaired(image, 0.001, atlas),
                depths = builder.depthFromPaired(image, false, 210);
            builder.setAlignment(0.5, 0, -0.105);
            builder.applyTransform(R3.makeRotateY(angle + Math.PI));
            this.meshes.push([angle, builder.constructSurface(depths, atlas.texture())]);
        }
        this.blump = new BLOB.Thing(this.meshes[0][1]);
    };

    BlumpTest.prototype.setupRoom = function (room) {
        this.program = room.programFromElements("vertex-test", "fragment-test");

        room.viewer.near = 0.01;
        room.viewer.far = 10;
        room.gl.enable(room.gl.CULL_FACE);
    };

    BlumpTest.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (this.blump) {
            var angleDelta = pointer.primary ? pointer.primary.deltaX * 0.01 :
                                               elapsed * Math.PI * 0.0001;
            this.blump.rotate(angleDelta, new R3.V(0, 1, 0));
        }
    };

    BlumpTest.prototype.eyePosition = function () {
        return new R3.V(0.22, 0.09, 0);
    };

    BlumpTest.prototype.render = function (room, width, height) {
        room.clear(this.clearColor);
        if (this.blump && room.viewer.showOnPrimary()) {
            var eye = this.eyePosition(),
                localEye = this.blump.toLocalP(eye),
                eyeAngle = R2.clampAngle(Math.atan2(localEye.z, localEye.x)),
                minAngle = 4 * Math.PI,
                bestAngle = null;
            room.viewer.positionView(eye, new R3.V(0, eye.y, 0), new R3.V(0, 1, 0));
            room.setupView(this.program, this.viewport);
            for (var m = 0; m < this.meshes.length; ++m) {
                var entry = this.meshes[m],
                    angle = entry[0],
                    angleDifference = Math.abs(R2.clampAngle(eyeAngle + angle) + Math.PI * 0.5);
                if (angleDifference < minAngle) {
                    this.blump.mesh = entry[1];
                    minAngle = angleDifference;
                    bestAngle = angle;
                }
                if (this.drawAll) {
                    this.blump.mesh = entry[1];
                    this.blump.render(room, this.program);
                }
            }
            if (!this.drawAll) {
                this.blump.render(room, this.program);
            }
        }
    };

    return {
        decodeDepths: decodeDepths,
        setupForPaired: setupForPaired,
        BlumpTest: BlumpTest
    };
}());
