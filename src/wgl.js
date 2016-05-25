var WGL = (function () {
    "use strict";

    function getGlContext(canvas) {
        var context = null;

        try {
            context = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (context) {
                return context;
            }
            console.log("Looks like there's no WebGL here.");
        }
        catch(e) {
            console.log("Error initializing WebGL: " + e);
        }

        return null;
    }
    
    function Viewer() {
        this.position = R3.origin();
        this.fov = 45;
        this.near = 0.01;
        this.far = 100;
    }
    
    Viewer.perspective = function(aspect) {
        return R3.perspective(this.fov, aspect, this.near, this.var);
    };
    
    function Room(canvas, clearColor) {
        this.canvas = canvas;
        this.gl = getGlContext(canvas);
        if (this.gl) {
            this.gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
            this.gl.enable(this.gl.DEPTH_TEST);
            this.gl.depthFunc(this.gl.LEQUAL);
        }
        this.modelView = R3.identity();
        this.viewer = new Viewer();
    }
    
    Room.prototype.clear = function () {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    };
    
    Room.prototype.updateSize = function () {
        this.gl.viewport(this.canvas.width, this.canvas.height);
    };
    
    Room.prototype.aspect = function () {
        return this.canvas.width / this.canvas.height;  
    };
    
    Room.prototype.setupShader = function (source, type) {
        var shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {  
            console.log("Shader compile error: " + this.gl.getShaderInfoLog(shader));  
            return null;  
        }
        return shader;
    };
    
    Room.prototype.setupShaderProgram = function (fragmentSource, vertexSource, vertexVariableName) {
        var fragmentShader = this.setupShader(fragmentSource, this.gl.FRAGMENT_SHADER),
            vertexShader = this.setupShader(vertexSource, this.gl.VERTEX_SHADER);
        
        if (!vertexShader || !fragmentShader) {
            return false;
        }
        
        var program = this.gl.createProgram();
        this.gl.attachShader(program, vertexSource);
        this.gl.attachShader(program, fragmentSource);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.log("Shader link error: " + this.gl.getProgramInfoLog(program));
            return false;
        }

        this.gl.useProgram(program);

        var vertexPositionAttribute = this.gl.getAttribLocation(program, vertexVariableName);
        this.gl.enableVertexAttribArray(vertexPositionAttribute);
        
        return true;
    };
    
    Room.prototype.setupBuffer = function (verticies, hint) {
        if (!hint) {
            hint = this.gl.STATIC_DRAW;
        }
        var vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(verticies), hint);
    };
    
    Room.prototype.setupUniforms = function (shader, perspective, modelView) {
        this.gl.uniformMatrix4fv(this.gl.getUniformLocation(shader, "uPMatrix"), false, perspective.m);
        this.gl.uniformMatrix4fv(this.gl.getUniformLocation(shader, "uMVMatrix"), false, modelView.m);
    };
    
    Room.prototype.drawTest = function () {
        var vertices = [
             1.0,  1.0, 0.0,
            -1.0,  1.0, 0.0,
             1.0, -1.0, 0.0,
            -1.0, -1.0, 0.0
        ];
        this.viewer.position.set(0, 0, 6);
        var perspective = this.viewer.perspective(this.aspect()),
            view = R3.identity();
        
        view.translate(R3.toOrigin(this.viewer.position));
    };
    
    return {
        Room: Room
    };
}());
