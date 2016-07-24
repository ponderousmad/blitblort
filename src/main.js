var MAIN = (function () {
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
    
    function resizeCanvas(canvas, game) {
        if (game.maximize) {
            canvas.width  = safeWidth();
            canvas.height = safeHeight();
        }
    }
    
    function setupUpdate(game, canvas) {
        var pointer = new IO.Pointer(canvas),
            keyboard = new IO.Keyboard(window, game.consumeKeys),
            lastTime = TICK.now();

        return function () {
            var now = TICK.now(),
                elapsed = now - lastTime;
            pointer.update(elapsed);

            game.update(now, elapsed, keyboard, pointer);

            keyboard.postUpdate();
            lastTime = now;
        };
    }
    
    function setup2D(canvas, game, update) {
        var context = canvas.getContext("2d");

        function drawFrame() {
            requestAnimationFrame(drawFrame);
            
            if (update) {
                update();
            }
            
            resizeCanvas(canvas, game);
            
            game.draw(context, canvas.width, canvas.height);
        }

        drawFrame();
    }
    
    function setup3D(canvas, game, update) {
        var room = new WGL.Room(canvas);

        function drawFrame3D() {
            if (game.vrDisplay) {
                game.vrDisplay.requestAnimationFrame(drawFrame3D);
            } else {
                requestAnimationFrame(drawFrame3D);
            }

            if (update) {
                update();
            }

            resizeCanvas(canvas, game);
            game.render(room, canvas.width, canvas.height);
        }

        drawFrame3D();
    }
 
    function runTestSuites() {
        // These tests are slow, don't want to run them all the time.
        if (TEST.INCLUDE_SLOW) {
            ENTROPY.testSuite();
        }
        
        R2.testSuite();
        R3.testSuite();
    }
    
    function start(canvas, game) {
        console.log("Starting game at:", TICK.now());

        var update = setupUpdate(game, canvas),
            drawUpdate = (!game.updateInterval || game.updateInDraw) ? update : null;

        if (game.render) {
            setup3D(canvas, game, drawUpdate);
        } else {
            setup2D(canvas, game, drawUpdate);
        }

        if (game.updateInterval) {
            window.setInterval(update, game.updateInterval);
        }
    }
    
    function Test2D() {
        this.batch = new BLIT.Batch("images/");
        this.image = this.batch.load("test.png");
        this.flip = new BLIT.Flip(this.batch, "test", 6, 2).setupPlayback(80, true);
        this.batch.commit();
        
        this.maximize = false;
        this.updateInDraw = true;
    }
    
    Test2D.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (this.batch.loaded) {
            this.flip.update(elapsed);
        }
    };
    
    Test2D.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);
        if (this.batch.loaded) {
            BLIT.draw(context, this.image, 100, 100, BLIT.ALIGN.Center, 0, 0, BLIT.MIRROR.Horizontal, [1,0,0]);
            this.flip.draw(context, 200, 50, BLIT.ALIGN.Left, 0, 0, BLIT.MIRROR.Vertical);
        }
    };

    function Test3D() {
        this.clearColor = [0, 0, 0, 1];
        this.maximize = false;
        this.updateInDraw = false;
        this.updateInterval = 16;
    }
    
    Test3D.prototype.update = function (now, elapsed, keyboard, pointer) {
        // Should put something here.
    };
    
    Test3D.prototype.render = function (room, width, height) {
        room.clear(this.clearColor);
        room.drawTest();
    };

    return {
        Test2D: Test2D,
        Test3D: Test3D,
        runTestSuites: runTestSuites,
        start: start,
        safeHeight: safeHeight,
        safeWidth: safeWidth,
    };
}());
