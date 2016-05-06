var MAIN = (function (gameplay, gamedraw) {
    "use strict";

    function safeWidth() {
        var inner = window.innerWidth,
            client = document.documentElement.clientWidth || inner,
            body = document.getElementsByTagName('body')[0].clientWidth || inner;
            
        return Math.min(inner, client, body);
    }
    
    function safeHeight() {
        var inner = window.innerHeight,
            client = document.documentElement.clientHeight || inner,
            body = document.getElementsByTagName('body')[0].clientHeight || inner;
            
        return Math.min(inner, client, body) - 5;
    }
    
    var batch = new BLIT.Batch("images/"),
        testImage = batch.load("test.png"),
        testFlip = new BLIT.Flip(batch, "test", 6, 2),
        testFlipDraw = testFlip.setupPlayback(80, true);
    
    (function () {
        batch.commit();
    }());
    
    window.onload = function (e) {
        console.log("window.onload", e, TICK.now());
        var canvas = document.getElementById("canvas"),
            context = canvas.getContext("2d"),
            pointer = new IO.Pointer(canvas),
            keyboard = new IO.Keyboard(window),
            lastTime = TICK.now(),
            update = function () {
                var now = TICK.now(),
                    elapsed = now - lastTime;
                pointer.update(elapsed);
                
                if (gameplay) {
                    gameplay(now, elapsed, keyboard, pointer);
                }
                if (!gamedraw) {
                    testFlip.updatePlayback(elapsed, testFlipDraw);
                }
                
                keyboard.postUpdate();
                lastTime = now;
            };

        function drawFrame() {
            requestAnimationFrame(drawFrame);
            
            canvas.width  = safeWidth();
            canvas.height = safeHeight();
            
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            if (gamedraw) {
                gamedraw(canvs.width, canvas.height);
            } else if (!BLIT.isPendingBatch()) {
                BLIT.draw(context, testImage, 100, 100, BLIT.ALIGN.Center, 0, 0, BLIT.MIRROR.Horizontal);
                testFlip.draw(context, testFlipDraw, 200, 50, BLIT.ALIGN.Left, 0, 0, BLIT.MIRROR.Vertical);
            }
        }

        window.setInterval(update, 16);

        drawFrame();

        // These tests are slow, don't want to run them all the time.
        if (TEST.INCLUDE_SLOW) {
            ENTROPY.testSuite();
        }
        
        LINEAR.testSuite();
    };

    return {
    };
}());
