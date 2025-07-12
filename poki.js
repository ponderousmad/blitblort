// Pointer Or Keyboard Input
var POKI = (function (TICK, BLORT) {
    "use strict";

    const KEYS = {
        Up : "ArrowUp",
        Down : "ArrowDown",
        Left : "ArrowLeft",
        Right : "ArrowRight",
        Space : "Space",
        Escape : "Escape",
        Minus : "Minus",
        Equal : "Equal",
        Backspace : "Backspace",
        Delete : "Delete",
        LBrace : "BracketLeft",
        RBrace : "BracketRight",
        BS : "Backslash",
        Semi : "Semicolon",
        Quote : "Quote",
        LT : "Comma",
        GT : "Period"
    };

    const SHIFT_KEYS = ["ShiftLeft", "ShiftRight"];

    // There's an odd behaviour where if two shift keys are pressed, 
    // you won't get told when the first is lifted, only once both are.
    // Can't fix properly, but can atleast repair when detected.
    function shiftFix(keyboard, isShift) {
        if (keyboard.shiftCount > 0 && !isShift) {
            keyboard.shiftCount = 0;
            SHIFT_KEYS.forEach(key=> {
                if (keyboard.log && keyboard.pressed[key]) {
                    console.log(`Fixing stuck ${key}`);
                }
                delete keyboard.pressed[key];
            });
        }
    }

    function Keyboard(element, capture) {
        this.pressed = {};
        this.lastPressed = {};
        this.shiftCount = 0;
        this.ctrlCount = 0;
        this.altCount = 0;
        this.log = false;
        var self = this;

        // When regaining focus, basically assume all bets are off.
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                if (self.log) {
                    console.log("Resetting keyboard state on shown.");
                }
                self.pressed = {};
                self.shiftCount = 0;
                self.ctrlCount = 0;
                self.altCount = 0;
            }
        });

        document.addEventListener("focus", () => {
            if (self.log) {
                console.log("Resetting keyboard state on focus.");
            }
            self.pressed = {};
            self.shiftCount = 0;
            self.ctrlCount = 0;
            self.altCount = 0;
        });

        if (element) {
            element.addEventListener("keydown", function (e) {
                e = e || window.event;
                var prevPressed = self.pressed[e.code];
                var eventInfo = {
                    time: TICK.now(),
                    shift: e.shiftKey,
                    ctrl: e.ctrlKey,
                    alt: e.altKey
                };
                if (prevPressed) {
                    prevPressed.repeats.push(eventInfo);
                } else {
                    switch (e.code) {
                        case "ShiftLeft":
                        case "ShiftRight":
                            ++self.shiftCount;
                            break;

                        case "ControlLeft":
                        case "ControlRight":
                            ++self.ctrlCount;
                            break;

                        case "AltLeft":
                        case "AltRight":
                            ++self.altCount;
                            break;
                    }
                    eventInfo.repeats = [];
                    self.pressed[e.code] = eventInfo;
                }
                shiftFix(self, e.shiftKey);
                if (capture) {
                    e.preventDefault();
                }
                if (self.log) {
                    console.log("keydown", e.code, self.status());
                }
            }, capture);

            element.addEventListener("keyup", function (e) {
                e = e || window.event;
                if (self.pressed[e.code]) {
                    switch (e.code) {
                        case "ShiftLeft":
                        case "ShiftRight":
                            --self.shiftCount;
                            break;

                        case "ControlLeft":
                        case "ControlRight":
                            --self.ctrlCount;
                            break;

                        case "AltLeft":
                        case "AltRight":
                            --self.altCount;
                            break;
                    }
                    delete self.pressed[e.code];
                } else if(self.log) {
                    console.log("Unpaired keyup!", e.code, self.status());
                }
                shiftFix(self, e.shiftKey);
                if (capture) {
                    e.preventDefault();
                }
                if (self.log) {
                    console.log("keyup", e.code, self.status());
                }
            }, capture);
        }
    }

    Keyboard.prototype.status = function() {
        var s = {
            shiftCount: this.shiftCount,
            ctrlCount: this.ctrlCount,
            altCount: this.altCount,
            pressed: {},
            lastPressed: []
        };
        Object.entries(this.pressed).forEach(e=>{
            const info = e[1];
            s.pressed[e[0]] = {
                time:info.time,
                shift:info.shift,
                ctrl:info.ctrl,
                alt:info.alt,
                repeatCount:info.repeats.length
            };
        });
        Object.keys(this.lastPressed).forEach(key=>{ s.lastPressed.push(key); });
        return s;
    };

    Keyboard.prototype.isKeyDown = function (keyName) {
        return this.pressed[keyName] ? true : false;
    };

    Keyboard.prototype.wasKeyPressed = function (keyName, modifiers) {
        var keyPressed = this.pressed[keyName];
        if (keyPressed && !this.lastPressed[keyName]) {
            if (modifiers) {
                if (keyPressed.shift !== modifiers.shift && modifiers.hasOwnProperty("shift")) {
                    return false;
                }

                if (keyPressed.ctrl !== modifiers.ctrl && modifiers.hasOwnProperty("ctrl")) {
                    return false;
                }

                if (keyPressed.alt !== modifiers.alt && modifiers.hasOwnProperty("alt")) {
                    return false;
                }
            }
            return true;
        }
        return false;
    };

    Keyboard.prototype.isShiftDown = function () {
        return this.shiftCount > 0;
    };

    Keyboard.prototype.isCtrlDown = function () {
        return this.ctrlCount > 0;
    };

    Keyboard.prototype.isAltDown = function () {
        return this.altCount > 0;
    };

    function makeKeyName(ascii) {
        if ("0" <= ascii && ascii <= "9") {
            return("Digit" + ascii);
        }
        return("Key" + ascii.toUpperCase());
    }

    Keyboard.prototype.isAsciiDown = function (ascii) {
        return this.isKeyDown(makeKeyName(ascii));
    };

    Keyboard.prototype.wasAsciiPressed = function (ascii, modifiers) {
        return this.wasKeyPressed(makeKeyName(ascii), modifiers);
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

    Keyboard.prototype.keyTime = function (keyName) {
        return this.pressed[keyName].time;
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
            } else if (button === 2) {
                return 2;
            } else if (button >= 0) {
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
            if ("buttons" in event) {
                return event.buttons;
            }
            var buttons = 0;
            if ("which" in event) {
                buttons = whichToButtons(event.which);
            } else if ("button" in event) {
                buttons = buttonToButtons(event.button);
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
        element.addEventListener("wheel", updateWheel, {capture:true, passive:false});
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
        }, {passive:false});
        element.addEventListener("touchend", handleTouch);
        element.addEventListener("touchmove", handleTouch, {passive:false});
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
        UNMODIFIED: {shift: false, ctrl: false, alt: false},
        SHIFT:      {shift: true,  ctrl: false, alt: false},
        CTRL:       {shift: false, ctrl: true,  alt: false},
        ALT:        {shift: false, ctrl: false, alt: true},
        Keyboard: Keyboard,
        Mouse: Mouse,
        Touch: Touch,
        Pointer: Pointer,
        downloadJSON: downloadJSON
    };
}(TICK, BLORT));

// Temporary, for porting
var IO = POKI;