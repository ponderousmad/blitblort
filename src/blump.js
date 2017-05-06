var BLUMP = (function () {
    "use strict";

    var gammaMap = [],
        MAX_VERTICIES = Math.pow(2, 16),
        NO_DEPTH = [5, 0, 0, 204];

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
            start = 0.45,
            range = defaultRange ? defaultRange : 0.20,
            depths = new Float32Array(width * height);
        IMPROC.processImage(image, left, top, width, height,
            function (x, y, r, g, b, a) {
                var value = -1;
                if (useCalibration && y < 2) {
                    if (y === 0) {
                        if (x === 0) {
                            if (r === 0 && g == IMPROC.BYTE_MAX && b == IMPROC.BYTE_MAX) {
                                isCalibrated = true;
                            }
                        } else if (isCalibrated) {
                            if (x == 1) {
                                range = decodeValue(r, g, b) / 1000;
                            } else if (x == 2) {
                                start = decodeValue(r, g, b) / 1000;
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

    function Builder(width, height, pixelSize, calculateNormals) {
        this.width = width;
        this.height = height;
        this.pixelSize = pixelSize;

        this.setAlignment(0.5, 0.5, 0);
        this.uMin = 0;
        this.uMax = 0;
        this.uScale = null;
        this.vScale = null;

        this.calculateNormals = calculateNormals ? true : false;
        this.wallNormal = null;

        this.defaultBottom = 0;
        this.color = [1, 1, 1, 1];
    }

    Builder.prototype.setAlignment = function (alignX, alignY, depthOffset) {
        this.xOffset = this.width * alignX;
        this.yOffset = this.height * alignY;
        this.depthOffset = depthOffset;
    };

    Builder.prototype.setupTextureSurface = function (coords) {
        if (coords) {
            this.uMin = coords.uMin;
            this.vMin = coords.vMin;
            this.uScale = coords.uSize / this.width;
            this.vScale = coords.vSize / this.height;
        } else {
            this.uScale = null;
            this.vScale = null;
        }
    };

    Builder.prototype.setupTextureWalls = function (coords) {
        if (coords) {
            this.uMin = coords.uMin;
            this.vMin = coords.vMin;
            this.uScale = coords.uSize;
            this.vScale = coords.vSize;
        } else {
            this.uScale = null;
            this.vScale = null;
        }
    };

    Builder.prototype.calculatePositionPerspective = function (x, y, depth) {
        var yIndex = (this.height - y) - this.yOffset,
            xIndex = x - this.xOffset,
            trueDepth = depth + 0.450,
            xFactor = 305.73 * 2,
            yFactor = 305.62 * 2;
        return new R3.V(
            trueDepth * xIndex / xFactor,
            trueDepth * yIndex / yFactor,
            depth + this.depthOffset
        );
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
            normal = null,
            u = this.uScale ? this.uMin + x * this.uScale : null,
            v = this.vScale ? this.vMin + y * this.vScale : null;
        if (dBottom !== null) {
            var left = new R3.V(2 * this.pixelSize, 0, dLeft - dRight),
                up = new R3.V(0, 2 * this.pixelSize, dTop - dBottom),
                normal = left.cross(up);
            normal.normalize();
        }
        mesh.addVertex(position, normal, u, v, this.color);
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

    function addTri(mesh, remap, i, j, k) {
        mesh.addTri(i, j, k);
        if (remap) {
            remap[i] = 1;
            remap[j] = 1;
            remap[k] = 1;
        }
    }

    Builder.prototype.getVertexColor = function (texturePixels, x, y, width, height) {
        var channels = IMPROC.CHANNELS,
            index = depthIndex(x, y, width, height) * channels;
        for (var c = 0; c < IMPROC.CHANNELS; ++c) {
            this.color[c] = texturePixels[index + c] / IMPROC.BYTE_MAX;
        }
    }

    Builder.prototype.constructSurface = function (depths, texture, texturePixels) {
        var width = this.width,
            height = this.height,
            validHeight = Math.floor(MAX_VERTICIES / (width + 1)) - 1,
            mesh = new WGL.Mesh(),
            vertexRemap = null;

        if (height > validHeight) {
            throw "Image too large";
        }

        if (!this.allowEdits) {
            vertexRemap = new Uint16Array((width + 1) * (height + 1));
            vertexRemap.fill(0);
        }

        for (var y = 0; y <= height; ++y) {
            var generateTris = y > 0,
                dLeft = -1,
                dRight = lookupDepth(depths, 0, y, width, height),
                lowerLeft = false;
            for (var x = 0; x <= width; ++x) {
                var depth = dRight,
                    dTop = lookupDepth(depths, x, y-1, width, height),
                    dBottom = null,
                    generateTri = (generateTris && x > 0),
                    lowerRight = depth >= 0,
                    corners = lowerLeft + lowerRight;
                dRight = lookupDepth(depths, x+1, y, width, height);

                if (this.calculateNormals) {
                    dBottom = lookupDepth(depths, x, y+1, width, height);
                }

                if (texturePixels) {
                    this.getVertexColor(texturePixels, x, y, width, height)
                }
                this.addSurfaceVertex(mesh, x, y, depth, dLeft, dTop, dRight, dBottom);

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
                            addTri(mesh, vertexRemap, iUR, iLR, iLL);
                            addTri(mesh, vertexRemap, iUR, iLL, iUL);
                        } else if(!upperLeft) {
                            addTri(mesh, vertexRemap, iUR, iLR, iLL);
                        } else if (!upperRight) {
                            addTri(mesh, vertexRemap, iUL, iLR, iLL);
                        } else if (!lowerLeft) {
                            addTri(mesh, vertexRemap, iUL, iLR, iUR);
                        } else if (!lowerRight) {
                            addTri(mesh, vertexRemap, iUL, iUR, iLL);
                        }
                    }
                }
                dLeft = depth;
                lowerLeft = lowerRight;
            }
        }

        mesh.image = texture;
        mesh.finalize(null, null, vertexRemap);
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
            u = this.uScale ? this.uMin + uFraction * this.uScale : null,
            v = this.vScale ? this.vMin + this.vScale : null;
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

    Builder.prototype.extractDepth = function(image, useCalibration, defaultRange) {
        return decodeDepths(
            image,
            0, image.height - this.height,
            this.width, this.height,
            useCalibration,
            defaultRange
        );
    };

    function Blump(data, defaultPixelSize, defaultDepthRange) {
        this.resource = data.resource;
        this.texture = data.texture;
        this.angle = R2.clampAngle(data.angle * R2.DEG_TO_RAD);
        this.image = null;
        this.pixelSize = data.pixelSize || defaultPixelSize;
        this.depthRange = data.depthRange || defaultDepthRange;
        this.mesh = null;
        this.offset = new R3.V(data.lrOffset, data.vOffset, data.fbOffset);
        this.scale = data.scale || 1;
    }

    Blump.prototype.width = function () {
        return this.image.width;
    }

    Blump.prototype.height = function () {
        if (this.textureData) {
            return this.image.height;
        }
        return this.image.height / 2;
    }

    Blump.prototype.constructTransform = function () {
        var transform = new R3.M();
        transform.translate(this.offset);
        R3.matmul(transform, R3.makeRotateY(this.angle), transform);
        R3.matmul(transform, R3.makeScale(this.scale), transform);
        return transform;
    };

    Blump.prototype.loadImage = function (batch) {
        this.image = batch.load(this.resource);
        if (this.texture) {
            this.textureData = batch.load(this.texture);
        }
    };

    Blump.prototype.construct = function (atlas, allowEdits, buildNormals) {
        this.constructFromImage(this.image, atlas, allowEdits, buildNormals);
    };

    Blump.prototype.constructFromImage = function (image, atlas, allowEdits, buildNormals) {
        var width = this.width(),
            height = this.height(),
            builder = new Builder(width, height, this.pixelSize, buildNormals),
            depths = builder.extractDepth(image, false, this.depthRange),
            texturePixels = null;
        builder.setAlignment(0.5, 0.5, -this.depthRange/2);
        builder.allowEdits = allowEdits;

        if (atlas) {
            this.atlas = atlas;
            if (this.textureData) {
                this.textureCoords = atlas.add(
                    this.textureData, 0, 0, this.textureData.width, this.textureData.height
                );
            } else {
                this.textureCoords = atlas.add(image, 0, 0, width, height);
            }
        } else if (!this.textureData) {
            texturePixels = IMPROC.getPixels(image, 0, 0, width, height).data;
        }
        builder.setupTextureSurface(this.textureCoords);

        this.mesh = builder.constructSurface(depths, atlas ? atlas.texture() : null, texturePixels);
        this.mesh.dynamic = true;
        this.reposition(true);
    };

    Blump.prototype.reposition = function (inPlace) {
        var transform = this.constructTransform(),
            inverse = transform.inverse(),
            vertsOut = this.mesh.glVertices,
            normalsOut = this.mesh.glNormals,
            vertsIn = inPlace ? vertsOut : this.mesh.vertices,
            normalsIn = inPlace ? normalsOut : this.mesh.normals;
        for (var i = 0; i < vertsIn.length; i += 3) {
            var p = new R3.V(vertsIn[i], vertsIn[i+1], vertsIn[i+2]);
            p = transform.transformP(p);
            vertsOut[i] = p.x; vertsOut[i+1] = p.y; vertsOut[i+2] = p.z;

            if (normalsOut) {
                var n = new R3.V(normalsIn[i], normalsIn[i+1], normalsIn[i+2]);
                n = inverse.transformV(n);
                n.normalize();
                normalsOut[i] = n.x; normalsOut[i+1] = n.y; normalsOut[i+2] = n.z;
            }
        }
        this.mesh.updated = true;
    };

    Blump.prototype.constructAtlas = function (count) {
        if (this.textureData) {
            return new WGL.TextureAtlas(this.textureData.width, this.textureData.height, count);
        }
        return new WGL.TextureAtlas(this.image.width, this.image.height / 2, count);
    }

    Blump.prototype.save = function () {
        var angle = this.angle * R2.RAD_TO_DEG;
        if (angle < 0) {
            angle += 360;
        }
        return {
            resource: this.resource,
            angle: angle,
            lrOffset: this.offset.x,
            fbOffset: this.offset.z,
            vOffset: this.offset.y,
            scale: this.scale,
            pixelSize: this.pixelSize,
            depthRange: this.depthRange
        };
    };

    Blump.prototype.simplify = function () {
        this.mesh.simplify();
        this.image = null;
        this.resource = null;
        this.atlas = null;
    };

    return {
        NO_DEPTH: NO_DEPTH,
        Blump: Blump
    };
}());
