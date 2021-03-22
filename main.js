var MAIN = (function () {
    "use strict";

    function safeWidth() {
        var inner = window.innerWidth,
            client = document.documentElement.clientWidth || inner,
            body = document.getElementsByTagName("body")[0].clientWidth || inner;

        return Math.min(inner, client, body);
    }

    function safeHeight() {
        var inner = window.innerHeight,
            client = document.documentElement.clientHeight || inner,
            body = document.getElementsByTagName("body")[0].clientHeight || inner;

        return Math.min(inner, client, body) - 5;
    }

    function resizeCanvas(canvas, game) {
        if (game.maximize) {
            canvas.width  = safeWidth();
            canvas.height = safeHeight();
        }
    }

    function setupUpdate(game, canvas) {
        var pointer = new IO.Pointer(canvas, game.preventDefaultIO),
            keyboard = new IO.Keyboard(game.inputElement ? game.inputElement : window, game.consumeKeys),
            lastTime = TICK.now();

        return function () {
            var now = TICK.now(),
                elapsed = now - lastTime;
            pointer.update(elapsed);

            game.update(now, elapsed, keyboard, pointer, canvas.width, canvas.height);

            keyboard.postUpdate();
            lastTime = now;
        };
    }

    function setup2D(canvas, game, update) {
        var context = canvas.getContext("2d");

        function drawFrame() {
            requestAnimationFrame(drawFrame);

            resizeCanvas(canvas, game);

            if (update) {
                update();
            }

            game.draw(context, canvas.width, canvas.height);
        }

        drawFrame();
        return context;
    }

    function setupVR(room, canvas, game) {
        if (!game.vrToggleIDs) {
            return;
        } else if (navigator.getVRDisplays) {
            var gameIsMaximized = game.maximize;
            // Check if any VR displays are attached/active.
            navigator.getVRDisplays().then(function (displays) {
                if (!displays.length) {
                    console.log("WebVR supported, but no VRDisplays found.");
                } else {
                    var vrDisplay = displays[0];
                    console.log("Found display:", vrDisplay);
                    room.viewer.setVRDisplay(vrDisplay);

                    var enterVrButton = document.getElementById(game.vrToggleIDs.enter),
                        exitVrButton = document.getElementById(game.vrToggleIDs.exit),
                        requestPresentVR = function () {
                            // This can only be called in response to a user gesture.
                            vrDisplay.requestPresent([{ source: canvas }]).then(
                                function () { console.log("Started present."); },
                                function () { console.log("Request present failed."); }
                            );
                        },
                        requestExitVR = function () {
                            if (!vrDisplay.isPresenting) {
                                // (May get vrdisplaydeactivated when not presenting.)
                                return;
                            }
                            vrDisplay.exitPresent().then(
                                function () { },
                                function () { }
                            );
                        },
                        onPresentChange = function () {
                            if (vrDisplay.isPresenting) {
                                if (vrDisplay.capabilities.hasExternalDisplay) {
                                    exitVrButton.className = "";
                                    enterVrButton.className = "hidden";
                                }
                            } else {
                                if (vrDisplay.capabilities.hasExternalDisplay) {
                                    exitVrButton.className = "hidden";
                                    enterVrButton.className = "";
                                }
                            }
                        };

                    if (vrDisplay.capabilities.canPresent) {
                        enterVrButton.className = "";
                    }

                    enterVrButton.addEventListener("click", requestPresentVR, false);
                    exitVrButton.addEventListener("click", requestExitVR, false);

                    window.addEventListener("vrdisplayactivate", requestPresentVR, false);
                    window.addEventListener("vrdisplaydeactivate", requestExitVR, false);
                    window.addEventListener("vrdisplaypresentchange", onPresentChange, false);
                }
            });
        } else if (navigator.getVRDevices) {
            console.log("Old WebVR version.");
        } else {
            console.log("WebVR not supported.");
        }
    }

    function setup3D(canvas, game, update) {
        var room = new WGL.Room(canvas);
        setupVR(room, canvas, game);

        function drawFrame3D() {
            if (room.viewer.vrDisplay) {
                room.viewer.vrDisplay.requestAnimationFrame(drawFrame3D);
            } else {
                requestAnimationFrame(drawFrame3D);
            }

            room.viewer.resizeCanvas(canvas, game.maximize, safeWidth(), safeHeight());

            if (update) {
                update();
            }

            game.render(room, canvas.width, canvas.height);
        }

        if (game.setupRoom) {
            game.setupRoom(room);
        }

        drawFrame3D();
        return room;
    }

    function runTestSuites(selfTestVerifyFail, includeSlow) {
        TEST.resetCounts();

        TEST.selfTestSuite(selfTestVerifyFail);

        if (window.hasOwnProperty("R2")) {
            R2.testSuite();
        }

        if (window.hasOwnProperty("R3")) {
            R3.testSuite();
        }

        if (window.hasOwnProperty("IMPROC")) {
            IMPROC.testSuite();
        }

        // These tests are slow, don't want to run them all the time.
        if (includeSlow) {
            ENTROPY.testSuite();
        }

        return TEST.failCount();
    }

    function start(canvas, game) {
        console.log("Starting game at:", TICK.now());

        var update = setupUpdate(game, canvas),
            drawUpdate = (!game.updateInterval || game.updateInDraw) ? update : null;

        if (game.updateInterval) {
            window.setInterval(update, game.updateInterval);
        }

        if (game.render) {
            var room = setup3D(canvas, game, drawUpdate);
        } else {
            return setup2D(canvas, game, drawUpdate);
        }
    }

    function setupToggleControls() {
        var controlsVisible = false;
        document.getElementById("menuButton").addEventListener("click", function(e) {
            controlsVisible = !controlsVisible;
            var slide = controlsVisible ? " slideIn" : "";
            controls.className = "controls" + slide;
            e.preventDefault = true;
            return false;
        });
    }

    return {
        runTestSuites: runTestSuites,
        start: start,
        setupToggleControls: setupToggleControls
    };
}());
