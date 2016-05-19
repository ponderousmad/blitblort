var MAIN = (function (game, updateInterval, updateInDraw) {
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
        testFlip = new BLIT.Flip(batch, "test", 6, 2).setupPlayback(80, true);
    
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
                
                if (game) {
                    game.update(now, elapsed, keyboard, pointer);
                } else {
                    testFlip.update(elapsed);
                }
                
                keyboard.postUpdate();
                lastTime = now;
            };

        function drawFrame() {
            requestAnimationFrame(drawFrame);
            
            if (!updateInterval || updateInDraw) {
                update();
            }
            
            canvas.width  = safeWidth();
            canvas.height = safeHeight();
            
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            if (game) {
                game.draw(context, canvas.width, canvas.height);
            } else if (!BLIT.isPendingBatch()) {
                BLIT.draw(context, testImage, 100, 100, BLIT.ALIGN.Center, 0, 0, BLIT.MIRROR.Horizontal, [1,0,0]);
                testFlip.draw(context, 200, 50, BLIT.ALIGN.Left, 0, 0, BLIT.MIRROR.Vertical);
            }
        }
        
        if (updateInterval) {
            window.setInterval(update, updateInterval);
        }

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
