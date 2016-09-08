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
            element.onkeydown = function (e) {
                e = e || window.event;
                self.pressed[e.keyCode] = TICK.now();
                if (capture) {
                    e.preventDefault();
                }
            };

            element.onkeyup = function (e) {
                e = e || window.event;
                delete self.pressed[e.keyCode];
                if (capture) {
                    e.preventDefault();
                }
            };
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

    function Mouse(element) {
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

        var self = this;
        var updateState = function (event) {
            var bounds = element.getBoundingClientRect(),
                left = (event.buttons & 1) == 1,
                right = (event.buttons & 2) == 2,
                middle = (event.buttons & 4) == 4;

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
        };

        var updateWheel = function (event) {
            self.wheelX += event.deltaX;
            self.wheelY += event.deltaY;
            self.wheelZ += event.deltaZ;

            event.preventDefault();
            event.stopImmediatePropagation();
        };

        element.addEventListener("mousemove", updateState);
        element.addEventListener("mousedown", updateState);
        element.addEventListener("mouseup", updateState);
        element.addEventListener("wheel", updateWheel);
    }

    Mouse.prototype.postUpdate = function () {
        this.leftDown = false;
        this.middleDown = false;
        this.rightDown = false;
        this.wheelX = 0;
        this.wheelY = 0;
        this.wheelZ = 0;
    };

    function Touch(element) {
        this.touches = [];

        var self = this;
        var handleTouch = function(e) {
            BLORT.noteOn();
            self.touches = e.touches;
            e.preventDefault();
        };

        element.addEventListener("touchstart", handleTouch);
        element.addEventListener("touchend", handleTouch);
        element.addEventListener("touchmove", handleTouch);
        element.addEventListener("touchcancel", handleTouch);
    }

    Touch.prototype.getTouch = function (id) {
        for (var t = 0; t < this.touches.length; ++t) {
            if (this.touches[t].identifier == id) {
                return this.touches[t];
            }
        }
        return null;
    };

    function Pointer(element) {
        this.mouse = new Mouse(element);
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
        this.primary = spot;
        this.mouse.postUpdate();
    };

    Pointer.prototype.activated = function() {
        return this.primary !== null && this.primary.isStart;
    };

    Pointer.prototype.location = function() {
        return this.primary;
    };

    return {
        KEYS: KEYS,
        Keyboard: Keyboard,
        Mouse: Mouse,
        Touch: Touch,
        Pointer: Pointer
    };
}(TICK, BLORT));
