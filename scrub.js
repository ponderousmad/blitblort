var SCRUB = (function (TICK) {
    "use strict";

    function Sequence(keyName, tagNames, timeFunction) {
        this.entries =  [];
        this.timeFunction = timeFunction || Date.now;
        this.keyNames = [keyName || "DateTime"];
        if (tagNames) {
            if (Array.isArray(tagNames)) {
                this.keyNames.push(...tagNames);
            } else if(typeof tagNames === "object") {
                this.keyNames.push(...tagNames.keys());
            }
        }
        this.setStart(this.timeFunction());
    }

    Sequence.prototype.makeEntry = function (key, value, tags) {
        var entry = { value: value };
        entry[this.keyNames[0]] = key;
        if (tags) {
            if (Array.isArray(tags)) {
                for (var i = 1; i < this.keyNames.length && i <= tags.length; ++i) {
                    entry[this.keyName[i]] = tags[i];
                }
            } else if(this.keyNames.length > 1) {
                entry[this.keyNames[1]] = tags;
            }
        }
        return entry;
    };

    Sequence.prototype.push = function (key, value, tags) {
        this.entries.push(this.makeEntry(key, value, tags));
    };

    Sequence.prototype.snapshot = function (value) {
        this.push(this.timeFunction(), value);
    };

    Sequence.prototype.setStart = function (startValue, startTags) {
        this.start = this.makeEntry(startValue, undefined, startTags);
    };

    Sequence.prototype.setEnd = function (endValue, endTags) {
        this.end = this.makeEntry(endValue, undefined, endTags);
    };

    Sequence.prototype.clear = function () {
        // Leaves start and end intact.
        this.entries.length = 0;
    };

    Sequence.prototype.append = function(data) {
        this.entries.push(...data.entries);
    };

    return {
        Sequence : Sequence
    };
})();