var ALIGN = {
    Center: 0,
    Left: 1,
    Right: 2,
    Top: 4,
    Bottom: 8
};

var Flipbook = (function () {
    function Flipbook(imageBatch, baseName, frameCount, digits) {
        this.frames = [];
        for (var i = 0; i < frameCount; ++i) {
            var number = i.toString();
            while (number.length < digits) {
                number = "0" + number;
            }
            this.frames.push(imageBatch.load(baseName + number + ".png"));
        }
    }
    
    Flipbook.prototype.setupPlayback = function(frameTime, loop, offset) {
        var time = offset ? offset : 0;
        return {
            elapsed: time,
            timePerFrame: frameTime,
            fractionComplete: time / (frameTime * this.frames.length),
            loop: loop === true
        };
    };
    
    Flipbook.prototype.updatePlayback = function(elapsed, playback) {
        var totalLength = playback.timePerFrame * this.frames.length;
        playback.elapsed += elapsed;
        if(playback.loop) {
            playback.elapsed = playback.elapsed % totalLength;
        }
        if (playback.elapsed > totalLength) {
            playback.fractionComplete = 0;
            return true;
        } else {
            playback.fractionComplete = playback.elapsed / totalLength;
            return false;
        }
    };
    
    Flipbook.prototype.draw = function(context, playback, x, y, alignment, width, height, tint) {
        if (!width) {
            width = this.frames[0].width;
        }
        if (!height) {
            height = this.frames[0].height;
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
        
        var index = Math.min(this.frames.length - 1, Math.floor(playback.elapsed / playback.timePerFrame)),
            image = this.frames[index];
        
        if (tint) {
            DRAW.tinted(context, image, x, y, width, height, tint);
        } else {
            context.drawImage(image, x, y, width, height);
        }
    };
    
    return Flipbook;
}());
