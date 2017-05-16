var BLORT = (function () {
    "use strict";

    var gAudioContext = null,
        gVorbisSupport = false,
        gNoteOn = false;
    try {
        var Constructor = window.AudioContext || window.webkitAudioContext;
        gAudioContext = new Constructor();

        // http://diveintohtml5.info/everything.html#audio-vorbis
        var a = document.createElement('audio');
        if (!!(a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"').replace(/no/, ''))) {
            gVorbisSupport = true;
            console.log("Using ogg/vorbis");
        } else {
            console.log("Using mp3/wav fallback");
        }
    } catch (error) {
        console.log("Error initializing audio:");
        console.log(error);
    }

    function audioNoteOn() {
        if (!gNoteOn) {
            gNoteOn = true;
            if (gAudioContext !== null) {
                // Trick to enable audio without downloading a sound from:
                // https://paulbakaus.com/tutorials/html5/web-audio-on-ios/
                // create empty buffer
                var buffer = gAudioContext.createBuffer(1, 1, 22050);
                var source = gAudioContext.createBufferSource();
                source.buffer = buffer;

                // connect to output (your speakers)
                source.connect(gAudioContext.destination);

                // play the file
                source.noteOn(0);
            }
        }
    }

    function setup(sound, resource, loop, forceMP3) {
        sound.resource = resource;
        sound.source = null;
        sound.buffer = null;
        sound.loop = loop;

        if (!resource.endsWith(".wav")) {
            if (gVorbisSupport) {
                resource += ".ogg";
            } else if (!loop || forceMP3) {
                resource += ".mp3";
            } else {
                resource += ".wav";
            }
        }

        if (gAudioContext !== null) {
            var request = new XMLHttpRequest();
            request.open("GET", resource, true);
            request.responseType = "arraybuffer";
            request.onload = function () {
                var audioData = request.response;
                gAudioContext.decodeAudioData(audioData,
                    function (buffer) {
                        sound.buffer = buffer;
                    },
                    function (e) {
                        console.log("Error with decoding audio data" + e.err);
                    });
            };
            request.send();
        }
    }

    function play(sound, enableGain) {
        if (gAudioContext === null || sound.buffer === null) {
            return;
        }
        if (sound.source) {
            sound.source.disconnect(gAudioContext.destination);
        }
        sound.source = gAudioContext.createBufferSource();
        sound.source.buffer = sound.buffer;
        sound.source.loop = sound.loop;
        if (enableGain) {
            sound.gain = gAudioContext.createGain();
            sound.gain.gain.value = sound.volume;
            sound.source.connect(sound.gain);
            sound.gain.connect(gAudioContext.destination);
        } else {
            sound.source.connect(gAudioContext.destination);
        }
        sound.source.start();
    }

    function playDynamic(processAudio, bufferSize) {
        if (gAudioContext === null) {
            return function() {};
        }
        var scriptNode = gAudioContext.createScriptProcessor(bufferSize, 1, 1),
            source = gAudioContext.createBufferSource();
        scriptNode.onaudioprocess = processAudio;
        source.buffer = gAudioContext.createBuffer(1, bufferSize, gAudioContext.sampleRate);
        source.loop = true;
        source.connect(scriptNode);
        scriptNode.connect(gAudioContext.destination);
        source.start();

        return function() {
            source.stop();
            scriptNode.disconnect(gAudioContext.destination);
            source.disconnect(scriptNode);
        };
    }

    function Noise(resource) {
        setup(this, resource, false, false);
    }

    Noise.prototype.isLoaded = function () {
        return gAudioContext === null || this.buffer !== null;
    };

    Noise.prototype.play = function () {
        play(this, false);
    };

    function Tune(resource, forceMP3) {
        setup(this, resource, true, forceMP3);
        this.playing = false;
        this.gain = null;
        this.volume = 1;
    }

    Tune.prototype.isLoaded = function() {
        return gAudioContext === null || this.buffer !== null;
    };

    Tune.prototype.play = function () {
        play(this, true);
        this.playing = true;
    };

    Tune.prototype.setVolume = function (volume) {
        this.volume = volume;
        if (this.playing) {
            this.gain.gain.value = volume;
        }
    };

    Tune.prototype.stop = function () {
        if (this.source) {
            this.source.stop();
            this.gain.disconnect(gAudioContext.destination);
            this.source.disconnect(this.gain);
            this.gain = null;
            this.source = null;
        }
        this.playing = false;
    };

    return {
        Noise: Noise,
        Tune: Tune,
        playDynamic: playDynamic,
        noteOn: audioNoteOn
    };
}());
