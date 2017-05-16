var IO = (function (TICK, BLORT) {
    "use strict";

    var KEYS = {
        Up : 38,
        Down : 40,
        Left : 37,
        Right : 39,
        Space : 32,
        Escape : 27,
        Plus : 187,
        Minus : 189,
        Backspace : 8,
        Delete : 46,
        LT : 188,
        GT : 190
    };

    function Keyboard(element, capture) {
        this.pressed = {};
        this.lastPressed = {};
        var self = this;

        if (element) {
            element.addEventListener("keydown", function (e) {
                e = e || window.event;
                self.pressed[e.keyCode] = TICK.now();
                if (capture) {
                    e.preventDefault();
                }
            }, capture);

            element.addEventListener("keyup", function (e) {
                e = e || window.event;
                delete self.pressed[e.keyCode];
                if (capture) {
                    e.preventDefault();
                }
            }, capture);
        }
    }

    Keyboard.prototype.isKeyDown = function (keyCode) {
        return this.pressed[keyCode] ? true : false;
    };

    Keyboard.prototype.wasKeyPressed = function (keyCode) {
        return this.pressed[keyCode] ? !this.lastPressed[keyCode] : false;
    };

    Keyboard.prototype.isShiftDown = function () {
        return this.isKeyDown(16);
    };

    Keyboard.prototype.isCtrlDown = function () {
        return this.isKeyDown(17);
    };

    Keyboard.prototype.isAltDown = function () {
        return this.isKeyDown(18);
    };

    Keyboard.prototype.isAsciiDown = function (ascii) {
        return this.isKeyDown(ascii.charCodeAt());
    };

    Keyboard.prototype.wasAsciiPressed = function (ascii) {
        return this.wasKeyPressed(ascii.charCodeAt());
    };

    Keyboard.prototype.keysDown = function () {
        var count = 0;
        for (var p in this.pressed) {
            if (this.pressed.hasOwnProperty(p)) {
                ++count;
            }
        }
        return count;
    };

    Keyboard.prototype.postUpdate = function () {
        this.lastPressed = {};
        for (var p in this.pressed) {
            if (this.pressed.hasOwnProperty(p)) {
                this.lastPressed[p] = this.pressed[p];
            }
        }
    };

    Keyboard.prototype.keyTime = function (keyCode) {
        return this.pressed[keyCode];
    };

    function Mouse(element, preventDefault) {
        this.location = [0, 0];
        this.left = false;
        this.middle = false;
        this.right = false;
        this.wasLeft = false;
        this.wasMiddle = false;
        this.wasRight = false;
        this.leftDown = false;
        this.middleDown = false;
        this.rightDown = false;
        this.shift = false;
        this.ctrl = false;
        this.alt = false;
        this.wheelX = 0;
        this.wheelY = 0;
        this.wheelZ = 0;
        this.lastButtons = 0;
        this.lastLocation = [0, 0];
        this.delta = [0, 0];

        function buttonToButtons(button) {
            if (button === 1) {
                return 4;
            } else if(button === 2) {
                return 2;
            } else if(button >= 0) {
                return 1 << b;
            }
            return 0;
        }

        function whichToButtons(which) {
            if (which === 2) {
                return 4;
            } else if (which === 3) {
                return 2;
            } else if (which > 0) {
                return 1 << (which - 1);
            }
        }

        var self = this,
            capture = preventDefault;
        function mouseButtons(event, eventType) {
            if ('buttons' in event) {
                return event.buttons;
            }
            var buttons = 0;
            if ('which' in event) {
                buttons = whichToButtons(event.which);
            } else if ('button' in ev) {
                buttons = buttonToButtons(ev.button);
            }

            if (eventType === "down") {
                self.lastButtons += buttons;
            } else if (eventType === "up") {
                self.lastButtons -= buttons;
            }
            return self.lastButtons;
        }

        var updateState = function (event, eventType) {
            var bounds = element.getBoundingClientRect(),
                buttons = mouseButtons(event, eventType),
                left = (buttons & 1) == 1,
                right = (buttons & 2) == 2,
                middle = (buttons & 4) == 4;

            self.location = [event.clientX - bounds.left, event.clientY - bounds.top];

            self.wasLeft = self.left;
            self.wasRight = self.right;
            self.wasMiddle = self.middle;

            self.left = left;
            self.right = right;
            self.middle = middle;

            self.leftDown = self.leftDown || (self.left && !self.wasLeft);
            self.middleDown = self.middleDown || (self.middle && !self.wasMiddle);
            self.rightDown = self.rightDown || (self.right && !self.wasRight);

            self.shift = event.shiftKey;
            self.ctrl = event.ctrlKey;
            self.altKey = event.altKey;

            if (preventDefault) {
                event.preventDefault();
            }
        };

        var updateWheel = function (event) {
            self.wheelX += Math.sign(event.deltaX);
            self.wheelY += Math.sign(event.deltaY);
            self.wheelZ += Math.sign(event.deltaZ);

            event.preventDefault();
            event.stopImmediatePropagation();
        };

        element.addEventListener(
            "mousemove", function(event) { updateState(event, "move"); }, capture
        );
        element.addEventListener(
            "mousedown", function(event) { updateState(event, "down"); }, capture
        );
        element.addEventListener(
            "mouseup", function(event) { updateState(event, "up"); }, capture
        );
        element.addEventListener("wheel", updateWheel, true);
    }

    Mouse.prototype.postUpdate = function () {
        this.leftDown = false;
        this.middleDown = false;
        this.rightDown = false;
        this.wheelX = 0;
        this.wheelY = 0;
        this.wheelZ = 0;

        this.delta[0] = this.location[0] - this.lastLocation[0];
        this.delta[1] = this.location[1] - this.lastLocation[1];

        this.lastLocation[0] = this.location[0];
        this.lastLocation[1] = this.location[1];
    };

    function Touch(element) {
        this.touches = [];
        this.started = [];
        this.prevStarted = [];

        var self = this,
            handleTouch = function(e) {
                BLORT.noteOn();
                self.touches = e.touches;
                e.preventDefault();
            },
            markTouchStarted = function (touch) {
                if (!self.findTouch(touch.identifier)) {
                    self.started.push(touch);
                }
            },
            markStarted = function(touches) {
                for (var t = 0; t < touches.length; ++t) {
                    markTouchStarted(touches[t]);
                }
            };

        element.addEventListener("touchstart", function (e) {
            handleTouch(e);
            markStarted(e.targetTouches);
        });
        element.addEventListener("touchend", handleTouch);
        element.addEventListener("touchmove", handleTouch);
        element.addEventListener("touchcancel", handleTouch);
    }

    Touch.prototype.getTouch = function (id) {
        return this.findTouch(this.touches, id);
    };

    Touch.prototype.findTouch = function (touches, touchID) {
        for (var t = 0; t < touches.length; ++t) {
            if (touches[t].identifier === touchID) {
                return touches[t];
            }
        }
        return null;
    };

    Touch.prototype.filterTouches = function (filter) {
        for (var t = 0; t < this.touches.length; ++t) {
            var touch = this.touches[t];
            filter(touch.identifier, touch.clientX, touch.clientY, this.findTouch(this.prevStarted, touch.identifier));
        }
    };

    Touch.prototype.postUpdate = function () {
        this.prevStarted = this.started;
        this.started = [];
    };

    function Pointer(element, preventDefault) {
        this.mouse = new Mouse(element, preventDefault);
        this.touch = new Touch(element);
        this.firstTouch = null;
        this.primary = null;
    }

    Pointer.prototype.update = function () {
        var spot = null;
        if (this.touch.touches.length > 0) {
            var touch = this.touch.touches[0],
                isStart = this.firstTouch === null;
            if (isStart) {
                this.firstTouch = touch.identifier;
            } else {
                touch = this.touch.getTouch(this.firstTouch);
            }
            if (touch !== null) {
                spot = {
                    isStart: isStart,
                    x: touch.clientX,
                    y: touch.clientY
                };
            }
        } else {
            this.firstTouch = null;
            if (this.mouse.leftDown || this.mouse.left) {
                spot = {
                    isStart: this.mouse.leftDown,
                    x: this.mouse.location[0],
                    y: this.mouse.location[1]
                };
            }
        }
        this.wheelX = this.mouse.wheelX;
        this.wheelY = this.mouse.wheelY;
        this.wheelZ = this.mouse.wheelZ;
        if (spot) {
            if (this.primary) {
                spot.deltaX = spot.x - this.primary.x;
                spot.deltaY = spot.y - this.primary.y;
            } else {
                spot.deltaX = 0;
                spot.deltaY = 0;
            }
        }
        this.primary = spot;
        this.mouse.postUpdate();
        this.touch.postUpdate();
    };

    Pointer.prototype.activated = function() {
        return this.primary !== null && this.primary.isStart;
    };

    Pointer.prototype.location = function() {
        return this.primary;
    };

    function downloadJSON(resource, handler) {
        var request = new XMLHttpRequest();
        request.open("GET", resource, true);
        request.responseType = "text";
        request.onload = function () {
            console.log("Loading " + resource);
            var responseData = JSON.parse(request.response);
            handler(responseData);
        };
        request.send();
    }

    return {
        KEYS: KEYS,
        Keyboard: Keyboard,
        Mouse: Mouse,
        Touch: Touch,
        Pointer: Pointer,
        downloadJSON: downloadJSON
    };
}(TICK, BLORT));
