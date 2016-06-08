var WGL = (function () {
    "use strict";
    
    var debugOptions = null;
    
    if (typeof WebGLDebugUtils !== "undefined") {
        debugOptions = {
            validateArgs: true,
            throwOnError: true,
            logCalls: false
        };
    }
    
    function throwOnGLError(err, funcName, args) {
        if (debugOptions.throwOnError) {
            throw WebGLDebugUtils.glEnumToString(err) + " was caused by call to: " + funcName;
        }
    }
    
    function argsToString(functionName, args) {   
        return WebGLDebugUtils.glFunctionArgsToString(functionName, args);
    }
    
    function logAndValidate(functionName, args) {
        if (debugOptions.logCalls) {
            console.log("gl." + functionName + "(" + argsToString(functionName, args) + ")");
        }
        if (debugOptions.validateArgs) {
            for (var a = 0; a < args.length; ++a) {
                if (args[a] === undefined) {
                    console.error(
                        "undefined passed to gl." + functionName + "(" + argsToString(functionName, args) + ")"
                    );
                }
            }
        }
    }

    function getGlContext(canvas) {
        var context = null;

        try {
            context = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (context) {
                if (debugOptions) {
                    context = WebGLDebugUtils.makeDebugContext(context, throwOnGLError, logAndValidate);
                }
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
        this.fov = 90;
        this.near = 0.1;
        this.far = 100;
    }
    
    Viewer.prototype.perspective = function (aspect) {
        return R3.perspective(this.fov * Math.PI / 180.0, aspect, this.near, this.far);
    };
    
    function Room(canvas) {
        this.canvas = canvas;
        this.viewportSize = new R2.V(0, 0);
        this.gl = getGlContext(canvas);
        if (this.gl) {
            this.gl.enable(this.gl.DEPTH_TEST);
            this.gl.depthFunc(this.gl.LEQUAL);
        }
        this.modelView = R3.identity();
        this.viewer = new Viewer();
    }
    
    Room.prototype.clear = function (clearColor) {
        if (this.clearColor != clearColor) {
            this.gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
            this.clearColor = clearColor;
        }
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    };
    
    Room.prototype.updateSize = function () {
        if (this.viewportSize.x !== this.canvas.width || this.viewportSize.y != this.canvas.height) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            this.viewportSize = new R2.V(this.canvas.width, this.canvas.height);
        }
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
    
    Room.prototype.setupShaderProgram = function (fragmentSource, vertexSource, positionVariable, uvVariable) {
        var fragmentShader = this.setupShader(fragmentSource, this.gl.FRAGMENT_SHADER),
            vertexShader = this.setupShader(vertexSource, this.gl.VERTEX_SHADER);
        
        if (!vertexShader || !fragmentShader) {
            return false;
        }
        
        var program = this.gl.createProgram();
        this.gl.attachShader(program, fragmentShader);
        this.gl.attachShader(program, vertexShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.log("Shader link error: " + this.gl.getProgramInfoLog(program));
            return false;
        }

        this.gl.useProgram(program);

        var positionAttribute = this.gl.getAttribLocation(program, positionVariable);
        this.gl.enableVertexAttribArray(positionAttribute);
        
        var uvAttribute = this.gl.getAttribLocation(program, uvVariable);
        this.gl.enableVertexAttribArray(uvAttribute);
        
        return {
            program: program,
            vertexPosition: positionAttribute,
            vertexUV: uvAttribute
        };
    };
    
    Room.prototype.setupBuffer = function (data, hint) {
        if (!hint) {
            hint = this.gl.STATIC_DRAW;
        }
        var buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), hint);
        return buffer;
    };
    
    Room.prototype.setupUniforms = function (program, perspective, modelView) {
        var pLocation = this.gl.getUniformLocation(program, "uPMatrix"),
            mvLocation = this.gl.getUniformLocation(program, "uMVMatrix");
        this.gl.uniformMatrix4fv(pLocation, false, perspective.m);
        this.gl.uniformMatrix4fv(mvLocation, false, modelView.m);
    };

    Room.prototype.loadTexture = function(batch, resource) {
        var gl = this.gl;
        
        function setupTexture(image, texture) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
        
        var texture = gl.createTexture();
        batch.load(resource, function(image) { setupTexture(image, texture); });
        return texture;
    };
    
    Room.prototype.drawTest = function () {
        if (!this.testSetup) {
            var vertexSource = document.getElementById("vertex-test").innerHTML,
                fragmentSource = document.getElementById("fragment-test").innerHTML;
            this.testSetup = this.setupShaderProgram(fragmentSource, vertexSource, "aPos", "aUV");
            
            var vertices = [
                    -1.0, -1.0, 0.0,
                    -1.0,  1.0, 0.0,
                     1.0, -1.0, 0.0,
                     1.0,  1.0, 0.0,
                ],
                uvs = [
                    0.0,  1.0,
                    0.0,  0.0,
                    1.0,  1.0,
                    1.0,  0.0
                ];
            this.testSetup.square = this.setupBuffer(vertices);
            this.testSetup.squareUVs = this.setupBuffer(uvs);
            this.gl.disable(this.gl.CULL_FACE);
            
            this.testSetup.batch = new BLIT.Batch("images/");
            this.testSetup.squareTexture = this.loadTexture(this.testSetup.batch, "uv.png");
            this.testSetup.batch.commit();
        }
        if (!this.testSetup.batch.loaded) {
            return;
        }
        this.viewer.position.set(0, 0, 2);
        var perspective = this.viewer.perspective(this.aspect()),
            view = R3.identity();
        
        view.translate(R3.toOrigin(this.viewer.position));
        
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.testSetup.squareTexture);
        this.gl.uniform1i(this.gl.getUniformLocation(this.testSetup.program, "uSampler"), 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.testSetup.square);
        this.gl.vertexAttribPointer(this.testSetup.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.testSetup.squareUVs);
        this.gl.vertexAttribPointer(this.testSetup.vertexUV, 2, this.gl.FLOAT, false, 0, 0);
        this.setupUniforms(this.testSetup.program, perspective, view);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    };
    
    return {
        Room: Room
    };
}());
