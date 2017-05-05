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
                    if (r == g && r == b && g == b) {
                        value = (r / 255.0) * range;
                    }
                }
                depths[y * width + x] = value;
            }
        );
        return depths;
    }

    function flattenDepthImage(context, x, y, width, height) {
        var pixels = context.getImageData(x, y, width, height);
        IMPROC.processPixels(pixels.data, width, height, function(x, y, r, g, b, a) {
            if (r != g || r != b || g != b) {
                return NO_DEPTH;
            }
        });
        context.putImageData(pixels, x, y);
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

    function Blump(data, defaultPixelSize, defaultDepthRange) {
        this.resource = data.resource;
        this.angle = R2.clampAngle(data.angle * R2.DEG_TO_RAD);
        this.image = null;
        this.pixelSize = data.pixelSize || defaultPixelSize;
        this.depthRange = data.depthRange || defaultDepthRange;
        this.mesh = null;
        this.visible = true;
        this.offset = new R3.V(data.lrOffset, data.vOffset, data.fbOffset);
        this.scale = data.scale || 1;
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
    };

    Blump.prototype.construct = function (atlas) {
        this.constructFromImage(this.image, atlas);
    };

    Blump.prototype.constructFromImage = function (image, atlas) {
        var width = image.width,
            height = image.height / 2,
            builder = new Builder(width, height, this.pixelSize),
            depths = builder.depthFromPaired(image, false, this.depthRange);
        builder.setAlignment(0.5, 0.5, -this.depthRange/2);

        if (atlas) {
            this.atlas = atlas;
            this.textureCoords = atlas.add(image, 0, 0, width, height);
        }
        if (this.textureCoords) {
            builder.setupTextureSurface(this.textureCoords);
        }

        this.mesh = builder.constructSurface(depths, this.atlas.texture());
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

    function unmultiplyChannel(value, alpha) {
        return Math.min(IMPROC.BYTE_MAX, Math.round(value / alpha));
    }

    function unmultiplyAlpha(color) {
        var a = color[3],
            alpha = a / IMPROC.BYTE_MAX;
        return [
            unmultiplyChannel(color[0], alpha),
            unmultiplyChannel(color[1], alpha),
            unmultiplyChannel(color[2], alpha),
            a
        ];
    }

    function BlumpEdit(viewport) {
        this.maximize = viewport === "safe";
        this.updateInDraw = true;
        this.preventDefaultIO = true;
        this.blump = null;
        this.zoom = 4;
        this.xOffset = 0;
        this.yOffset = 0;
        this.alpha = document.getElementById("sliderAlpha");
        this.preview = document.getElementById("canvasPreview");
        this.previewContext = this.preview.getContext("2d");
        this.brushColor = unmultiplyAlpha(NO_DEPTH);
        this.dirty = false;
    }

    BlumpEdit.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (!this.blump) {
            return;
        }
        if (pointer.primary) {
            var pixelX = Math.floor((pointer.primary.x - this.xOffset) / this.zoom),
                pixelY = Math.floor((pointer.primary.y - this.yOffset) / this.zoom) +
                         this.preview.height / 2;
            if (pointer.mouse.shift) {
                this.previewContext.fillStyle = "rgba(" + this.brushColor.join(",") + ")";
                this.previewContext.clearRect(pixelX, pixelY, 1, 1);
                this.previewContext.save();
                if (this.brushColor[3] != 255) {
                    this.previewContext.globalAlpha = this.brushColor[3] / 255;
                }
                this.previewContext.fillRect(pixelX, pixelY, 1, 1);
                this.previewContext.restore();
                this.dirty = true;
            } else if (pointer.mouse.ctrl) {
                var pixelData = this.previewContext.getImageData(pixelX, pixelY, 1, 1);
                this.brushColor = unmultiplyAlpha(pixelData.data);
            } else if (pointer.mouse.alt) {
            } else {
                this.xOffset += pointer.primary.deltaX;
                this.yOffset += pointer.primary.deltaY;
            }
        } else if (this.dirty) {
            this.blump.constructFromImage(this.preview);
            this.dirty = false;
            postUpdate(this.preview, this.blump.resource);
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
        context.save();
        context.fillStyle = "rgba(0,0,0,1)";
        context.fillRect(0, 0, width, height);
        var alpha = 0.9;
        if (this.alpha) {
            alpha = parseFloat(this.alpha.value);
        }
        if (this.blump) {
            var image = this.blump.image,
                blumpHeight = image.height / 2,
                scaleWidth = image.width * this.zoom,
                scaleHeight = blumpHeight * this.zoom;
            context.drawImage(
                image,
                0, 0,
                image.width, blumpHeight,
                this.xOffset, this.yOffset,
                scaleWidth, scaleHeight
            );
            context.globalAlpha = alpha;
            context.drawImage(
                this.preview,
                0, blumpHeight,
                this.preview.width, blumpHeight,
                this.xOffset, this.yOffset,
                scaleWidth, scaleHeight
            );
        }
        context.restore();
    };

    function postUpdate(canvas, resource) {
        canvas.toBlob(function (blob) {
            var objectURL = window.URL.createObjectURL(blob),
                saveLink = document.createElementNS("http://www.w3.org/1999/xhtml", "a");
            setTimeout(function() {
                saveLink.href = objectURL;
                saveLink.download = resource;
                saveLink.innerHTML = "Save Image";

                var div = document.getElementById("divSave");
                div.innerHTML = "";
                div.appendChild(saveLink);
            });
        });
    }

    BlumpEdit.prototype.editBlump = function (blump) {
        this.blump = blump;
        var canvas = this.preview,
            context = this.previewContext,
            w = blump.image.width,
            h = blump.image.height,
            style = "width: " + w / 8 + "px; height: " + h / 8 + "px;";
        canvas.width = w;
        canvas.height = h;
        this.previewContext.clearRect(0, 0, w, h);
        context.drawImage(this.blump.image, 0, 0, w, h);
        flattenDepthImage(context, 0, h / 2, w, h / 2);
        canvas.style = style;
        postUpdate(this.preview, this.blump.resource);
    };

    function BlumpTest(viewport, editor) {
        this.clearColor = [0, 0, 0, 1];
        this.maximize = viewport === "safe";
        this.updateInDraw = true;
        this.preventDefaultIO = true;
        this.viewport = viewport ? viewport : "canvas";
        this.editor = editor;
        this.editArea = null;
        this.thing = null;
        this.program = null;
        this.distance = 0.5;
        this.zoom = 1;
        this.tilt = 0;
        this.TILT_MAX = Math.PI * 0.49;

        this.blumps = [];
        this.activeBlump = null;

        this.setupControls();
    }

    BlumpTest.prototype.setupControls = function () {
        this.turntableCheckbox = document.getElementById("turntable");
        this.selectDraw = document.getElementById("selectDraw");

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
            reload = document.getElementById("buttonReload");

        this.connectControls = function() {
            initAngle(self.activeBlump.angle * R2.RAD_TO_DEG);
            initX(self.activeBlump.offset.x);
            initY(self.activeBlump.offset.y);
            initZ(self.activeBlump.offset.z);
            initScale(self.activeBlump.scale);

            if (self.editor) {
                self.editor.editBlump(self.activeBlump);
            }
        };

        this.selectImage = document.getElementById("selectImage");
        if (this.selectImage) {
            this.selectImage.addEventListener("change", function (e) {
                self.activeBlump = self.blumps[parseInt(selectImage.value)];
                self.connectControls();
            }, true);
            this.populateImages();
        }

        function onLoad(data) {
            self.load(data);
        }
        var selectBlump = document.getElementById("selectBlump");
        if (selectBlump) {
            selectBlump.addEventListener("change", function (e) {
                IO.downloadJSON(selectBlump.value, onLoad);
            });
            if (selectBlump.value) {
                IO.downloadJSON(selectBlump.value, onLoad);
            }
        }

        if (reload) {
            reload.addEventListener("click", function(e) {
                self.constructBlumps();
            }, false);
        }

        this.editArea = document.getElementById("textBlump");
        if (this.editArea) {
            this.editArea.addEventListener("paste", function (event) {
                setTimeout(function () {
                    var textData = self.editArea.value;
                    if (textData[0] === "{") {
                        self.load(JSON.parse(textData));
                    }
                });
            }, false);

            try {
                editArea.value = window.localStorage.getItem("blump");
            } catch (error) {
                console.log("Error loading blump: " + error);
            }

            var clipboardButton = document.getElementById("buttonClipboard");
            if (clipboardButton) {
                clipboardButton.addEventListener("click", function(e) {
                    self.editArea.value = self.save();
                    self.editArea.select();
                    self.editArea.focus();
                    document.execCommand("copy");
                    self.checkpoint();
                }, true);
            }
        }
    };

    BlumpTest.prototype.populateImages = function () {
        if (this.selectImage) {
            this.selectImage.innerHTML = "";
            for (var b = 0; b < this.blumps.length; ++b) {
                var blump = this.blumps[b],
                    option = new Option(blump.resource, b);
                selectImage.appendChild(option);
            }
        }
    };

    BlumpTest.prototype.load = function (blumpData) {
        this.blumps = [];
        this.thing = null;
        var pixelSize = blumpData.pixelSize || 0.001;
        var depthRange = blumpData.depthRange || 0.2;
        for (var d = 0; d < blumpData.blumps.length; ++d) {
            this.blumps.push(new Blump(blumpData.blumps[d], pixelSize, depthRange));
        }
        this.activeBlump = this.blumps[0];

        var self = this,
            batch = new BLIT.Batch("images/", function() {
                self.constructBlumps();
            });

        for (var b = 0; b < this.blumps.length; ++b) {
            this.blumps[b].loadImage(batch);
        }
        batch.commit();
        this.populateImages();
    };

    BlumpTest.prototype.checkpoint = function () {
        console.log(this.save());
        try {
            window.localStorage.setItem("blump", this.save());
        } catch (error) {
            console.log("Error storing blump: " + error);
        }
    };

    BlumpTest.prototype.constructBlumps = function () {
        var blumps = this.blumps,
            image = blumps[0].image,
            atlas = new WGL.TextureAtlas(image.width, image.height/2, blumps.length);
        for (var b = 0; b < blumps.length; ++b) {
            blumps[b].construct(atlas);
        }

        var atlasDiv = document.getElementById("atlas");
        if (atlasDiv) {
            atlasDiv.appendChild(atlas.canvas);
        }

        this.thing = new BLOB.Thing();
        this.connectControls();
    };

    BlumpTest.prototype.save = function () {
        var blumpData = [];
        
        for (var b = 0; b < this.blumps.length; ++b) {
            blumpData.push(this.blumps[b].save());
        }
        
        var data = {
            blumps : blumpData
        };

        return JSON.stringify(data, null, 4);
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
                drawMode = this.selectDraw ? this.selectDraw.value : "angle";
            room.viewer.positionView(eye, R3.origin(), new R3.V(0, 1, 0));
            room.setupView(this.program, this.viewport);
            if (drawMode === "active" || drawMode === "both") {
                this.thing.mesh = this.activeBlump.mesh;
                this.thing.frame = null;
                this.thing.render(room, this.program, eye);
            }
            if (drawMode === "angle" || drawMode === "both") {
                this.thing.mesh = null;
                this.thing.frame = this.blumps;
                this.thing.render(room, this.program, eye);
            }
            if (drawMode === "all") {
                this.thing.frame = null;
                for (var b = 0; b < this.blumps.length; ++b) {
                    this.thing.mesh = this.blumps[b].mesh;
                    this.thing.render(room, this.program, eye);
                }
            }
        }
    };

    function start() {
        var editor = new BlumpEdit("canvas");
        MAIN.start(document.getElementById("canvas3D"), new BlumpTest("canvas", editor));
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
