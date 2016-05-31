var MAIN = (function (game, updateInterval, updateInDraw, test3D) {
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
    
    function setupUpdate(canvas) {
        var pointer = new IO.Pointer(canvas),
            keyboard = new IO.Keyboard(window),
            lastTime = TICK.now();

        return function () {
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
    }
    
    function setup2D(canvas, update) {
        var context = canvas.getContext("2d");

        function drawFrame() {
            requestAnimationFrame(drawFrame);
            
            if (update) {
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

        drawFrame();
    }
    
    function setup3D(canvas, update) {
        var room = WGL.Room(canvas, game ? game.clearColor : [0,0,0,0]);
        
        function drawFrame3D() {
            requestAnimationFrame(drawFrame3D);
            
            if (update) {
                update();
            }
            
            canvas.width  = safeWidth();
            canvas.height = safeHeight();
            
            room.updateSize();
            room.clear();
            
            if (game) {
                game.draw(room, canvas.width, canvas.height);
            } else if (!BLIT.isPendingBatch()) {
                room.drawTest();
            }
        }

        drawFrame3D();
    }
    
    window.onload = function (e) {
        console.log("window.onload", e, TICK.now());

        var canvas = document.getElementById("canvas"),
            update = setupUpdate(canvas),
            drawUpdate = (!updateInterval || updateInDraw) ? update : null;
        if (test3D || (game && game.is3D)) {
            setup3D(canvas, drawUpdate);
        } else {
            setup2D(canvas, drawUpdate);
        }

        if (updateInterval) {
            window.setInterval(update, updateInterval);
        }

        // These tests are slow, don't want to run them all the time.
        if (TEST.INCLUDE_SLOW) {
            ENTROPY.testSuite();
        }
        
        R2.testSuite();
        R3.testSuite();
    };

    return {
    };
}());
