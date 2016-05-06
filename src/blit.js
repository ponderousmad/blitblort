var ImageBatch = (function (baseURL) {
    "use strict";

    function ImageBatch(basePath, onComplete) {
        this._toLoad = 0;
        this._commited = false;
        this._basePath = basePath;
        this._onComplete = onComplete;
        this.loaded = false;
    }

    ImageBatch.prototype.setPath = function (path) {
        this._basePath = path;
    };

    ImageBatch.prototype._checkComplete = function () {
        if (this._commited) {
            if (this._toLoad === 0) {
                this.loaded = true;
                if (this._onComplete) {
                    this._onComplete();
                }
            }
        }
    };

    ImageBatch.prototype.load = function (resource, onLoad) {
        this._toLoad += 1;
        var image = new Image();
        var self =  this;
        image.onload = function () {
            if (onLoad) {
                onLoad(image);
            }
            self._toLoad -= 1;
            self._checkComplete();
        };

        var path = baseURL + (this._basePath || "") + resource;

        image.src = path;
        return image;
    };

    ImageBatch.prototype.commit = function () {
        this._commited = true;
        this._checkComplete();
    };
    
    return ImageBatch;
}(rootURL));

var DRAW = (function () {
    "use strict";
    
    function drawCentered(context, image, pos, y) {
        var x = pos;
        if (typeof x !== "number") {
            y = pos.y;
            x = pos.x;
        }
        context.drawImage(image, x - image.width * 0.5, y - image.height * 0.5);
    }
    
    function drawCenteredScaled(context, image, x, y, width, height) {
        context.drawImage(image, x - width * 0.5, y - height * 0.5, width, height);
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
    
    var tintCanvas = document.createElement('canvas'),
        tintContext = tintCanvas.getContext('2d');
    tintCanvas.width = 300;
    tintCanvas.height = 100;
    
    function drawTinted(context, image, x, y, width, height, tint) {
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

        context.drawImage(tintCanvas, 0, 0, image.width, image.height, x, y, width, height);
    }
    
    return {
        centered: drawCentered,
        centeredScaled: drawCenteredScaled,
        tinted: drawTinted,
        centeredText: drawTextCentered
    };
}());