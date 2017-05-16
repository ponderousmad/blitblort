var BLIT = (function () {
    "use strict";

    var ALIGN = {
        Center: 0,
        Left: 1,
        Right: 2,
        Top: 4,
        TopLeft: 5,
        Bottom: 8
    };

    var MIRROR = {
        None: 0,
        Horizontal: 1,
        Vertical: 2,
        Both: 3
    };

    var batchesPending = 0,
        tintCache = {};

    function Batch(basePath, onComplete) {
        this._toLoad = 0;
        this._commited = false;
        this._basePath = basePath;
        this._onComplete = onComplete;
        this.loaded = false;
        batchesPending += 1;
    }

    Batch.prototype.setPath = function (path) {
        this._basePath = path;
    };

    Batch.prototype._checkComplete = function () {
        if (this._commited) {
            if (this._toLoad === 0) {
                this.loaded = true;
                if (this._onComplete) {
                    this._onComplete();
                }
                batchesPending -= 1;
            }
        }
    };

    Batch.prototype.load = function (resource, onLoad) {
        this._toLoad += 1;
        this._commited = false;
        var image = new Image();
        var self =  this;
        image.onload = function () {
            if (onLoad) {
                onLoad(image);
            }
            self._toLoad -= 1;
            self._checkComplete();
        };

        var path = (this._basePath || "") + resource;

        image.src = path;
        return image;
    };

    Batch.prototype.commit = function () {
        this._commited = true;
        this._checkComplete();
    };

    function cacheTint(image, tint, canvas) {
        tintCache[image.src + tint] = canvas;
    }

    function checkTintCache(image, tint) {
        return tintCache[image.src + tint];
    }

    function drawTinted(context, image, x, y, width, height, tint, noCache, srcX, srcY, srcWidth, srcHeight) {
        var tintCanvas = noCache ? null : checkTintCache(image, tint);

        if (!tintCanvas) {
            tintCanvas = document.createElement('canvas');
            var tintContext = tintCanvas.getContext('2d');
            tintCanvas.width = image.width;
            tintCanvas.height = image.height;
            tintContext.clearRect(0, 0, image.width + 2, image.height + 2);
            tintContext.drawImage(image, 0, 0);

            var buffer = tintContext.getImageData(0, 0, image.width, image.height),
                data = buffer.data;

            // Adapted from: http://stackoverflow.com/questions/18576702/how-to-tint-an-image-in-html5
            for (var i = 0; i < data.length; i += 4) {
                data[i]     = data[i]     * tint[0];  /// add R
                data[i + 1] = data[i + 1] * tint[1];  /// add G
                data[i + 2] = data[i + 2] * tint[2];  /// add B
            }

            tintContext.putImageData(buffer, 0, 0);
            cacheTint(image, tint, tintCanvas);
        }

        srcX = srcX || 0;
        srcY = srcY || 0;
        srcWidth = srcWidth || image.width;
        srcHeight = srcHeight || image.height;

        context.drawImage(tintCanvas, srcX, srcY, srcWidth, srcHeight, x, y, width, height);
    }

    function draw(context, image, x, y, alignment, width, height, mirror, tint, noCache) {
        if (!width) {
            width = image.width;
        }
        if (!height) {
            height = image.height;
        }

        if ((alignment & ALIGN.Bottom) !== 0) {
            y -= height;
        } else if ((alignment & ALIGN.Top) === 0) { // center
            y -= height * 0.5;
        }

        if ((alignment & ALIGN.Right) !== 0) {
            x -= width;
        } else if ((alignment & ALIGN.Left) === 0) { // center
            x -= width * 0.5;
        }

        context.save();
        var flipX = mirror == MIRROR.Horizontal || mirror == MIRROR.Both,
            flipY = mirror == MIRROR.Vertical || mirror == MIRROR.Both,
            scaleX = flipX ? -1 : 1,
            scaleY = flipY ? -1 : 1;

        if (mirror && mirror != MIRROR.None) {
            var midX = x + width * 0.5,
                midY = y + height * 0.5;

            context.translate(-midX, -midY);
            context.scale(scaleX, scaleY);
            context.translate(midX * scaleX, midY * scaleY);
        }

        if (flipX) {
            x = -x - width;
        }
        if (flipY) {
            y = -y - height;
        }

        if (tint) {
            drawTinted(context, image, x, y, width, height, tint, noCache);
        } else {
            context.drawImage(image, x, y, width, height);
        }

        context.restore();
    }

    function toggleSmooth(context, smooth) {
        context.mozImageSmoothingEnabled = smooth;
        context.webkitImageSmoothingEnabled = smooth;
        context.msImageSmoothingEnabled = smooth;
        context.imageSmoothingEnabled = smooth;
    }

    function drawTextCentered(context, text, x, y, fill, shadow, offset) {
        context.textAlign = "center";
        if (shadow) {
            context.fillStyle = shadow;
            if (!offset) {
                offset = 2;
            }
            context.fillText(text, x + offset, y + offset);
        }
        if (fill) {
            context.fillStyle = fill;
        }
        context.fillText(text, x, y);
    }

    function Flip(imageBatch, baseName, frameCount, digits) {
        this.frames = [];
        for (var i = 0; i < frameCount; ++i) {
            var number = i.toString();
            while (number.length < digits) {
                number = "0" + number;
            }
            this.frames.push(imageBatch.load(baseName + number + ".png"));
        }
    }

    Flip.prototype.setupPlayback = function (frameTime, loop, offset) {
        var time = offset ? offset : 0,
            flip = this;
        return {
            elapsed: time,
            timePerFrame: frameTime,
            fractionComplete: time / (frameTime * this.frames.length),
            loop: loop === true,
            update: function (elapsed) { return flip.updatePlayback(elapsed, this); },
            draw: function (context, x, y, alignment, width, height, mirror, tint) {
                flip.draw(context, this, x, y, alignment, width, height, mirror, tint);
            },
            width: function () { return flip.width(); },
            height: function () { return flip.height(); }
        };
    };

    Flip.prototype.updatePlayback = function (elapsed, playback) {
        var totalLength = playback.timePerFrame * this.frames.length;
        playback.elapsed += elapsed;
        if(playback.loop) {
            playback.elapsed = playback.elapsed % totalLength;
        }
        if (playback.elapsed > totalLength) {
            playback.fractionComplete = 1;
            return true;
        } else {
            playback.fractionComplete = playback.elapsed / totalLength;
            return false;
        }
    };

    Flip.prototype.draw = function (context, playback, x, y, alignment, width, height, mirror, tint) {
        var index = Math.min(this.frames.length - 1, Math.floor(playback.elapsed / playback.timePerFrame));

        draw(context, this.frames[index], x, y, alignment, width, height, mirror, tint, true);
    };

    Flip.prototype.width = function () {
        return this.frames[0].width;
    };

    Flip.prototype.height = function () {
        return this.frames[0].height;
    };

    function updatePlaybacks(elapsed, playbacks) {
        for (var p = 0; p < playbacks.length; ++p) {
            playbacks[p].update(elapsed);
        }
    }

    return {
        ALIGN: ALIGN,
        MIRROR: MIRROR,
        Batch: Batch,
        isPendingBatch: function () { return batchesPending > 0; },
        tinted: drawTinted,
        draw: draw,
        centeredText: drawTextCentered,
        toggleSmooth: toggleSmooth,
        Flip: Flip,
        updatePlaybacks : updatePlaybacks
    };
}());