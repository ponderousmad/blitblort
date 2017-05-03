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

    function Blump(resource, angle) {
        this.resource = resource;
        this.angle = R2.clampAngle(angle * R2.DEG_TO_RAD);
        this.image = null;
        this.mesh = null;
        this.visible = true;
        this.offset = R3.origin();
        this.scale = 1;
    }

    Blump.prototype.constructTransform = function () {
        var transform = new R3.M();
        transform.translate(this.offset);
        R3.matmul(transform, R3.makeRotateY(this.angle), transform);
        R3.matmul(transform, R3.makeScale(this.scale), transform);
        return transform;
    };

    Blump.prototype.load = function (batch) {
        this.image = batch.load(this.resource);
    };

    Blump.prototype.construct = function (atlas) {
        var builder = setupForPaired(this.image, 0.001, atlas),
            depths = builder.depthFromPaired(this.image, false, 210);
        builder.setAlignment(0.5, 0.5, -0.105);
        this.mesh = builder.constructSurface(depths, atlas.texture());
        this.mesh.dynamic = true;
        this.reposition();
    };

    Blump.prototype.reposition = function () {
        var transform = this.constructTransform(),
            inverse = transform.inverse(),
            vertsIn = this.mesh.vertices,
            vertsOut = this.mesh.glVertices,
            normalsIn = this.mesh.normals,
            normalsOut = this.mesh.glNormals;
        for (var i = 0; i < vertsIn.length; i += 3) {
            var p = new R3.V(vertsIn[i], vertsIn[i+1], vertsIn[i+2]),
                n = new R3.V(normalsIn[i], normalsIn[i+1], normalsIn[i+2]);
            p = transform.transformP(p);
            n = inverse.transformV(n);
            n.normalize();

            vertsOut[i] = p.x; vertsOut[i+1] = p.y; vertsOut[i+2] = p.z;
            normalsOut[i] = n.x; normalsOut[i+1] = n.y; normalsOut[i+2] = n.z;
        }
        this.mesh.updated = true;
    };

    function BlumpEdit(viewport) {
        this.maximize = viewport === "safe";
        this.updateInDraw = true;
        this.preview = null;
        this.blump = null;
        this.zoom = 4;
        this.xOffset = 0;
        this.yOffset = 0;
    }

    BlumpEdit.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (pointer.primary) {
            if (pointer.mouse.shift) {
                this.xOffset += pointer.primary.deltaX;
                this.yOffset += pointer.primary.deltaY;
            }
        }

        var oldZoom = this.zoom;
        if (pointer.wheelY < 0) {
            this.zoom += 1;
        } else if (pointer.wheelY > 0) {
            this.zoom = Math.max(1, this.zoom - 1);
        }
        if (oldZoom != this.zoom) {
            var canvasPos = pointer.mouse.location;
            this.xOffset = canvasPos[0] - (canvasPos[0] - this.xOffset) * this.zoom / oldZoom;
            this.yOffset = canvasPos[1] - (canvasPos[1] - this.yOffset) * this.zoom / oldZoom;
        }
    };

    BlumpEdit.prototype.draw = function (context, width, height) {
        BLIT.toggleSmooth(context, false);
        context.fillStyle = "rgba(0,0,0,1)";
        context.fillRect(0, 0, width, height);
        if (this.blump) {
            var image = this.blump.image,
                blumpHeight = image.height / 2,
                scaleWidth = image.width * this.zoom,
                scaleHeight = blumpHeight * this.zoom;
            context.drawImage(
                image,
                0, blumpHeight,
                image.width, blumpHeight,
                this.xOffset, this.yOffset,
                scaleWidth, scaleHeight
            );
        }
    };

    BlumpEdit.prototype.editBlump = function (blump, previewContext) {
        this.blump = blump;
        this.preview = previewContext;
    };

    function BlumpTest(viewport, baseName, editor) {
        this.clearColor = [0, 0, 0, 1];
        this.maximize = viewport === "safe";
        this.updateInDraw = true;
        this.viewport = viewport ? viewport : "canvas";
        this.editor = editor;
        this.thing = null;
        this.program = null;
        this.distance = 0.5;
        this.zoom = 1;
        this.tilt = 0;
        this.TILT_MAX = Math.PI * 0.49;

        var blumpValues = null;
        if (!baseName) {
            baseName = "dragon_";
        }
        if (baseName == "me_") {
            blumpValues = [
                [  0,   0, new R3.V( 0.000, 0.000,  0.000), 1],
                [ 45,  45, new R3.V( 0.053, 0.005,  0.000), 1],
                [ 90,  70, new R3.V( 0.069, 0.011, -0.016), 1],
                [270, -65, new R3.V(-0.037, 0.005, -0.026), 1],
                [315, -42, new R3.V(-0.021, 0.000, -0.011), 1]
            ];
        } else if (baseName == "dragon_") {
            blumpValues = [
                [  0,   0, new R3.V(0,0,0), 1],
                [ 45,  45, new R3.V(0,0,0), 1],
                [ 90,  90, new R3.V(0,0,0), 1],
                [135, 135, new R3.V(0,0,0), 1],
                [180, 180, new R3.V(0,0,0), 1],
                [225, 225, new R3.V(0,0,0), 1],
                [270, 270, new R3.V(0,0,0), 1],
                [315, 315, new R3.V(0,0,0), 1]
            ];
        }

        this.blumps = [];
        for (var v = 0; v < blumpValues.length; ++v) {
            var values = blumpValues[v],
                blump = new Blump(baseName + values[0] + ".png", values[1]);
            blump.offset = values[2];
            blump.scale = values[3];
            this.blumps.push(blump);
        }

        var self = this;
        this.batch = new BLIT.Batch("images/", function() {
            self.loadBlumps();
        });
        for (var b = 0; b < this.blumps.length; ++b) {
            this.blumps[b].load(this.batch);
        }
        this.batch.commit();

        this.setupControls();
    }

    BlumpTest.prototype.setupControls = function () {
        this.turntableCheckbox = document.getElementById("turntable");
        this.selectDraw = document.getElementById("selectDraw");
        this.preview = document.getElementById("canvasPreview");
        this.previewContext = this.preview.getContext("2d");

        function setupSlider(idBase, handleChange) {
            var slider = document.getElementById("slider" + idBase),
                value = document.getElementById("value" + idBase);
            if (slider) {
                slider.addEventListener("input", function (e) {
                    if (value) {
                        value.value = slider.value;
                    }
                    handleChange(parseFloat(slider.value));
                });
            }
            if (value) {
                value.addEventListener("change", function (e) {
                    if (!isNaN(value.value)) {
                        if (slider) {
                            slider.value = value.value;
                        }
                        handleChange(parseFloat(value.value));
                    }
                });
            }

            return function(initialValue) {
                if (value) { value.value = initialValue; }
                if (slider) { slider.value = initialValue; }
            };
        }

        function initPreview(image) {
            var w = image.width, h = image.height;
            self.preview.width = w;
            self.preview.height = h;
            self.previewContext.clearRect(0, 0, w, h);
            self.previewContext.drawImage(image, 0, 0, w, h, 0, 0, w, h);
        }

        this.activeBlump = this.blumps[0];
        var self = this,
            initAngle = setupSlider("Angle", function (value) {
                if (self.activeBlump && !isNaN(value)) {
                    self.activeBlump.angle = R2.clampAngle(value * R2.DEG_TO_RAD);
                    self.activeBlump.reposition();
                }
            }),
            initX = setupSlider("X", function (value) {
                if (self.activeBlump && !isNaN(value)) {
                    self.activeBlump.offset.x = value;
                    self.activeBlump.reposition();
                }
            }),
            initY = setupSlider("Y", function (value) {
                if (self.activeBlump && !isNaN(value)) {
                    self.activeBlump.offset.y = value;
                    self.activeBlump.reposition();
                }
            }),
            initZ = setupSlider("Z", function (value) {
                if (self.activeBlump && !isNaN(value)) {
                    self.activeBlump.offset.z = value;
                    self.activeBlump.reposition();
                }
            }),
            initScale = setupSlider("Scale", function (value) {
                if (self.activeBlump && !isNaN(value)) {
                    self.activeBlump.scale = value;
                    self.activeBlump.reposition();
                }
            }),
            reload = document.getElementById("reload");

        function initialize() {
            initAngle(self.activeBlump.angle * R2.RAD_TO_DEG);
            initX(self.activeBlump.offset.x);
            initY(self.activeBlump.offset.y);
            initZ(self.activeBlump.offset.z);
            initScale(self.activeBlump.scale);
            initPreview(self.activeBlump.image);

            if (self.editor) {
                self.editor.editBlump(self.activeBlump, self.previewContext);
            }
        }
        initialize();

        this.selectImage = document.getElementById("selectImage");
        if (this.selectImage) {
            for (var b = 0; b < this.blumps.length; ++b) {
                var blump = this.blumps[b],
                    option = new Option(blump.resource, b, b === 0, b === 0);
                this.selectImage.appendChild(option);
            }

            this.selectImage.addEventListener("change", function (e) {
                self.activeBlump = self.blumps[parseInt(self.selectImage.value)];
                initialize();
            });
        }

        if (reload) {
            reload.addEventListener("click", function(e) {
                self.loadBlumps();
                initialize();
            }, false);
        }
    };

    BlumpTest.prototype.loadBlumps = function () {
        var blumps = this.blumps,
            image = blumps[0].image,
            atlas = new WGL.TextureAtlas(image.width, image.height/2, blumps.length);
        for (var b = 0; b < blumps.length; ++b) {
            blumps[b].construct(atlas);
        }
        this.thing = new BLOB.Thing();

        var atlasDiv = document.getElementById("atlas");
        if (atlasDiv) {
            atlasDiv.appendChild(atlas.canvas);
        }
    };

    BlumpTest.prototype.setupRoom = function (room) {
        this.program = room.programFromElements("vertex-test", "fragment-test");

        room.viewer.near = 0.01;
        room.viewer.far = 10;
        room.gl.enable(room.gl.CULL_FACE);
    };

    BlumpTest.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (this.thing) {
            var angleDelta = 0;
            
            if (pointer.primary) {
                angleDelta = pointer.primary.deltaX * 0.01;
            } else if (!this.turntableCheckbox || this.turntableCheckbox.checked) {
                angleDelta = elapsed * Math.PI * 0.001;
            }
            this.thing.rotate(angleDelta, new R3.V(0, 1, 0));
        }

        if (pointer.primary) {
            this.tilt += pointer.primary.deltaY * 0.5 * R2.DEG_TO_RAD;
            this.tilt = R2.clamp(this.tilt, -this.TILT_MAX, this.TILT_MAX);
        }

        if (pointer.wheelY) {
            var WHEEL_BASE = 20;
            this.zoom *= (WHEEL_BASE + pointer.wheelY) / WHEEL_BASE;
        }
    };

    BlumpTest.prototype.eyePosition = function () {
        var d = this.distance * this.zoom,
            x = Math.cos(this.tilt),
            y = Math.sin(this.tilt);
        return new R3.V(x * d, y * d, 0);
    };

    BlumpTest.prototype.render = function (room, width, height) {
        room.clear(this.clearColor);
        if (this.thing && room.viewer.showOnPrimary()) {
            var eye = this.eyePosition(),
                localEye = this.thing.toLocalP(eye),
                eyeAngle = R2.clampAngle(Math.atan2(-localEye.x, localEye.z)),
                minAngle = 4 * Math.PI,
                drawMode = this.selectDraw ? this.selectDraw.value : "angle";
            room.viewer.positionView(eye, R3.origin(), new R3.V(0, 1, 0));
            room.setupView(this.program, this.viewport);
            if (drawMode === "active" || drawMode === "both") {
                this.thing.mesh = this.activeBlump.mesh;
                this.thing.render(room, this.program);
            }
            for (var b = 0; b < this.blumps.length; ++b) {
                var blump = this.blumps[b],
                    angleDifference = Math.abs(R2.clampAngle(eyeAngle + blump.angle));
                if (drawMode === "all") {
                    this.thing.mesh = blump.mesh;
                    this.thing.render(room, this.program);
                } else if (drawMode === "angle" || drawMode === "both") {
                    if (angleDifference < minAngle) {
                        this.thing.mesh = blump.mesh;
                        minAngle = angleDifference;
                    }
                }
            }
            if (drawMode === "angle" || drawMode === "both") {
                this.thing.render(room, this.program);
            }
        }
    };

    function start(baseName) {
        var editor = new BlumpEdit("canvas");
        MAIN.start(document.getElementById("canvas3D"), new BlumpTest("canvas", baseName, editor));
        MAIN.start(document.getElementById("canvasEdit"), editor);
        var failed = MAIN.runTestSuites(),
            controlsVisible = false;
        if (failed === 0) {
            console.log("All Tests Passed!");
        }

        document.getElementById("menuButton").addEventListener("click", function(e) {
            controlsVisible = !controlsVisible;
            var slide = controlsVisible ? " slideIn" : "";
            controls.className = "controls" + slide;
            e.preventDefault = true;
            return false;
        });
    }

    return {
        decodeDepths: decodeDepths,
        setupForPaired: setupForPaired,
        BlumpEdit: BlumpEdit,
        BlumpTest: BlumpTest,
        start: start
    };
}());
