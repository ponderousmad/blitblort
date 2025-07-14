var GLYPH = (function () {
    "use strict";

    function codePointForCharacter(character) {
        if (typeof character === "string" && character.length === 1) {
            return character.codePointAt(0);
        }
        throw new TypeError("Character must be a single character string");
    }

    function isInsidePolygon(points, testPoint) {
        if (points.length < 2) {
            return false;
        }
        let xCrossings = 0,
            yCrossings = 0,
            prev = points[points.length - 1],
            prevAhead = prev.x > testPoint.x,
            prevBelow = prev.y > testPoint.y
        for (const p of points) {
            let ahead = p.x > testPoint.x,
                below = p.y > testPoint.y

            if ((ahead || prevAhead) && below != prevBelow) {
                ++xCrossings;
            }
            if ((below || prevBelow) && ahead != prevAhead) {
                ++yCrossings;
            }

            prev = p;
            prevAhead = ahead;
            prevBelow = below;
        }
        if ( (xCrossings % 2) != (yCrossings % 2)) {
            console.log("Ambigous inside check! xCrossings: " + xCrossings + ", yCrossings: " + yCrossings);
        }
        return (xCrossings % 2) == 1;
    }

    class Glyph extends Object {
        constructor(codePoint, splines) {
            super();
            if (!Number.isInteger(codePoint) || codePoint < 0) {
                throw new TypeError("Must pass codepoint as non-negative integer");
            }
            this.codePoint = codePoint;
            this.splines = splines || [];
            if (!Array.isArray(this.splines)) {
                throw new TypeError("If splines are provided they must be in an array");
            }
        }

        getCodePoint() { return this.codePoint; }
        getSplines() { return this.splines; }
        getSymbol() { return String.fromCodePoint(this.codePoint); }

        addSpline(path) { this.splines.push(path); }
    }

    function loadPoint(pointData) {
        if (!pointData) {
            return undefined;
        }
        // Always assume fonts are 2D.
        return new R2.V(pointData.x, pointData.y);
    }

    function loadSegment(segmentData, spline) {
        if (segmentData.type == "BezierCurve") {
            let segment = new SPLINE.BezierCurve();
            spline.addSegment(segment);
            for (let i = 0; i < segmentData.points.length; ++i) {
                segment.addPoint(loadPoint(segmentData.points[i]));
            }
        } else if (segmentData.type == "LineSegment") {
            spline.addSegment(new SPLINE.LineSegment(loadPoint(segmentData.start), loadPoint(segmentData.end)))
        } else {
            throw Error("Missing required spline type");
        }
    }

    function loadGlyph(glyphData, glyphs) {
        let codePoint = glyphData.codePoint,
            splines = [];
        for (let p = 0; p < glyphData.splines.length; ++p) {
            let splineData = glyphData.splines[p],
                spline = new SPLINE.Path(splineData.closed);
            for (let s = 0; s < splineData.segments.length; ++s) {
                loadSegment(splineData.segments[s], spline);
            }
            splines.push(spline);
        }
        glyphs[codePoint] = new GLYPH.Glyph(codePoint, splines);
    }

    class Font extends Object {
        glyphs = [];

        constructor(name) {
            super();
            this.name = name || "Unnamed Font";
        }

        newGlyph(codePoint, splines) {
            this.glyphs[codePoint] = new Glyph(codePoint, splines);
            return this.glyphs[codePoint];
        }

        glyphForCodepoint(codePoint) {
            if (!Number.isInteger(codePoint) || codePoint < 0) {
                throw new TypeError("Must pass codepoint as non-negative integer");
            }
            if (this.glyphs.length > codePoint) {
                return this.glyphs[codePoint];
            }
            return null;
        }

        glyphForCharacter(character) {
            return this.glyphForCodepoint(codePointForCharacter(character));
        }

        asJSONString() {
            let glyphData = [];
            for (let glyph of this) {
                let splines = glyph.getSplines(),
                    splineData = [];

                for (let p = 0; p < splines.length; ++p) {
                    splineData.push(splines[p].getData());
                }
                glyphData.push({
                    codePoint: glyph.getCodePoint(),
                    symbol : glyph.getSymbol(),
                    splines : splineData
                });
            }
            return JSON.stringify({name:this.name, glyphs:glyphData}, null, 4);
        }

        loadFromJSON(jsonString) {
            let data = JSON.parse(jsonString);

            let newGlpyhs = [];
            for (let g = 0; g < data.glyphs.length; ++g) {
                loadGlyph(data.glyphs[g], newGlpyhs);
            }

            this.name = data.name;
            this.glyphs = newGlpyhs;
        }

        [Symbol.iterator]() {
            function nextValidCodePoint (glyphs, codePoint) {
                while(codePoint < glyphs.length && typeof glyphs[codePoint] == 'undefined') {
                    ++codePoint;
                }
                return codePoint;
            }

            const glyphs = this.glyphs;
            let codePoint = nextValidCodePoint(glyphs, 0);

            return {
                next() {
                    const current = codePoint;
                    if(current < glyphs.length) {
                        codePoint = nextValidCodePoint(glyphs, codePoint + 1);
                        return {
                            value: glyphs[current],
                            done: false
                        };
                    }
                    return {
                        value: undefined,
                        done: true
                    };
                }
            };
        }
    }

    return {
        codePointForCharacter: codePointForCharacter,
        isInsidePolygon: isInsidePolygon,
        Glyph: Glyph,
        Font: Font
    };
})();