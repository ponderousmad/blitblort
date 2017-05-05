var BLUMP_EDIT = (function () {
    "use strict";

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

    function flattenDepthImage(context, x, y, width, height) {
        var pixels = context.getImageData(x, y, width, height);
        IMPROC.processPixels(pixels.data, width, height, function(x, y, r, g, b, a) {
            if (r != g || r != b || g != b) {
                return BLUMP.NO_DEPTH;
            }
        });
        context.putImageData(pixels, x, y);
    }

    function ImageEditor(viewport) {
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
        this.brushColor = unmultiplyAlpha(BLUMP.NO_DEPTH);
        this.dirty = false;
    }

    ImageEditor.prototype.update = function (now, elapsed, keyboard, pointer) {
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

    ImageEditor.prototype.draw = function (context, width, height) {
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

    ImageEditor.prototype.editBlump = function (blump) {
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

    function Viewer(viewport, editor) {
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

    Viewer.prototype.setupControls = function () {
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

    Viewer.prototype.populateImages = function () {
        if (this.selectImage) {
            this.selectImage.innerHTML = "";
            for (var b = 0; b < this.blumps.length; ++b) {
                var blump = this.blumps[b],
                    option = new Option(blump.resource, b);
                selectImage.appendChild(option);
            }
        }
    };

    Viewer.prototype.load = function (blumpData) {
        this.blumps = [];
        this.thing = null;
        var pixelSize = blumpData.pixelSize || 0.001;
        var depthRange = blumpData.depthRange || 0.2;
        for (var d = 0; d < blumpData.blumps.length; ++d) {
            this.blumps.push(new BLUMP.Blump(blumpData.blumps[d], pixelSize, depthRange));
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

    Viewer.prototype.checkpoint = function () {
        console.log(this.save());
        try {
            window.localStorage.setItem("blump", this.save());
        } catch (error) {
            console.log("Error storing blump: " + error);
        }
    };

    Viewer.prototype.constructBlumps = function () {
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

    Viewer.prototype.save = function () {
        var blumpData = [];
        
        for (var b = 0; b < this.blumps.length; ++b) {
            blumpData.push(this.blumps[b].save());
        }
        
        var data = {
            blumps : blumpData
        };

        return JSON.stringify(data, null, 4);
    };

    Viewer.prototype.setupRoom = function (room) {
        this.program = room.programFromElements("vertex-test", "fragment-test");

        room.viewer.near = 0.01;
        room.viewer.far = 10;
        room.gl.enable(room.gl.CULL_FACE);
    };

    Viewer.prototype.update = function (now, elapsed, keyboard, pointer) {
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

    Viewer.prototype.eyePosition = function () {
        var d = this.distance * this.zoom,
            x = Math.cos(this.tilt),
            y = Math.sin(this.tilt);
        return new R3.V(x * d, y * d, 0);
    };

    Viewer.prototype.render = function (room, width, height) {
        room.clear(this.clearColor);
        if (this.thing && room.viewer.showOnPrimary()) {
            var eye = this.eyePosition(),
                drawMode = this.selectDraw ? this.selectDraw.value : "angle";
            room.viewer.positionView(eye, R3.origin(), new R3.V(0, 1, 0));
            room.setupView(this.program, this.viewport);
            if (drawMode === "active" || drawMode === "both") {
                this.thing.mesh = this.activeBlump.mesh;
                this.thing.blumps = null;
                this.thing.render(room, this.program, eye);
            }
            if (drawMode === "angle" || drawMode === "both") {
                this.thing.mesh = null;
                this.thing.blumps = this.blumps;
                this.thing.render(room, this.program, eye);
            }
            if (drawMode === "all") {
                this.thing.blumps = null;
                for (var b = 0; b < this.blumps.length; ++b) {
                    this.thing.mesh = this.blumps[b].mesh;
                    this.thing.render(room, this.program, eye);
                }
            }
        }
    };

    function start() {
        var editor = new ImageEditor("canvas");
        MAIN.start(document.getElementById("canvas3D"), new Viewer("canvas", editor));
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
        start: start
    };
}());
