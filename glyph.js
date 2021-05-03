var GLYPH = (function (SPLINE) {
    "use strict";

    function Glyph(symbol, splines) {
        this.symbol = symbol;
        this.spline = splines || [];
    }

    Glyph.prototype.getSymbol = function() { return this.symbol; };
    Glyph.prototype.getSplines = function() { return this.splines; };

    function Font() {
        this.glyphs = {};
    }

    Font.prototype.newGlyph = function (symbol, splines) {
        this.glyphs[symbol] = spline;
    };

    Font.prototype.getGlyph = function (symbol) {
        return this.glyphs[symbol];
    };

    Font.prototype.load = function (data) {
        
    };
})();