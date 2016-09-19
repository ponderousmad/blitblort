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
            var glAttribs = {
                alpha: false
            };
            context = canvas.getContext("webgl", glAttribs) || canvas.getContext("experimental-webgl", glAttribs);
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
        this.orientation = R3.zeroQ();
        this.fov = 90;
        this.near = 0.1;
        this.far = 100;
        this.vrDisplay = null;
        this.size = new R2.V(0, 0);
        this.safeSize = new R2.V(0, 0);
        this.vrFrameData = new VRFrameData();
    }

    Viewer.prototype.setVRDisplay = function (vrDisplay) {
        this.vrDisplay = vrDisplay;
    };

    Viewer.prototype.inVR = function () {
        return this.vrDisplay && this.vrDisplay.isPresenting;
    };

    Viewer.prototype.showOnPrimary = function () {
        if (this.inVR()) {
            if (!this.vrDisplay.capabilities.hasExternalDisplay) {
                return false;
            }
        }
        return true;
    };

    Viewer.prototype.perspective = function (aspect) {
        return R3.perspective(this.fov * R2.DEG_TO_RAD, aspect, this.near, this.far);
    };

    Viewer.prototype.perspectiveVR = function (region, frameData) {
        return new R3.M(region == "left" ? frameData.leftProjectionMatrix : frameData.rightProjectionMatrix);
    };

    Viewer.prototype.view = function () {
        var m = R3.makeRotateQ(this.orientation);
        m.translate(R3.toOrigin(this.position));
        return m;
    };

    Viewer.prototype.resizeCanvas = function (canvas, maximize, safeWidth, safeHeight) {
        this.safeSize.set(safeWidth, safeHeight);
        if (this.inVR()) {
            var leftEye = this.vrDisplay.getEyeParameters("left");
            var rightEye = this.vrDisplay.getEyeParameters("right");
            canvas.width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
            canvas.height = Math.max(leftEye.renderHeight, rightEye.renderHeight);
        } else if (maximize) {
            canvas.width  = safeWidth;
            canvas.height = safeHeight;
        }
    };

    Viewer.prototype.viewport = function (gl, canvas, region) {
        var isLeft = region == "left",
            width = canvas.width,
            height = canvas.height;
        if (isLeft || region == "right") {
            width = width * 0.5;
            gl.viewport(isLeft ? 0 : width, 0, width, height);
        } else {
            if (region == "safe") {
                width = this.safeSize.x;
                height = this.safeSize.y;
            }
            gl.viewport(0, canvas.height - height, width, height);
        }
        return width / height;
    };

    Viewer.prototype.resetPose = function () {
        if (this.vrDisplay) {
            this.vrDisplay.resetPose();
        }
    };

    Viewer.prototype.vrFrame = function () {
        if (this.vrDisplay.getFrameData(this.vrFrameData)) {
            return this.vrFrameData;
        }
        return null;
    };

    Viewer.prototype.submitVR = function () {
        this.vrDisplay.submitFrame();
    };

    function Room(canvas) {
        this.canvas = canvas;
        this.gl = getGlContext(canvas);
        if (this.gl) {
            this.gl.enable(this.gl.DEPTH_TEST);
            this.gl.depthFunc(this.gl.LEQUAL);
        }
        this.viewer = new Viewer();
    }

    Room.prototype.clear = function (clearColor) {
        if (this.clearColor != clearColor) {
            this.gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
            this.clearColor = clearColor;
        }
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
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

    Room.prototype.bindVertexAttribute = function (program, variable) {
        var attribute = this.gl.getAttribLocation(program, variable);
        this.gl.enableVertexAttribArray(attribute);
        return attribute;
    };

    Room.prototype.setupShaderProgram = function (vertexSource, fragmentSource) {
        var vertexShader = this.setupShader(vertexSource, this.gl.VERTEX_SHADER),
            fragmentShader = this.setupShader(fragmentSource, this.gl.FRAGMENT_SHADER);

        if (!vertexShader || !fragmentShader) {
            return null;
        }

        var program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.log("Shader link error: " + this.gl.getProgramInfoLog(program));
            return null;
        }

        this.gl.useProgram(program);
        return program;
    };

    Room.prototype.setupBuffer = function (data, elements, hint) {
        if (!hint) {
            hint = this.gl.STATIC_DRAW;
        }
        var arrayType = elements ? this.gl.ELEMENT_ARRAY_BUFFER : this.gl.ARRAY_BUFFER;
        var buffer = this.gl.createBuffer();
        this.gl.bindBuffer(arrayType, buffer);
        this.gl.bufferData(arrayType, data, hint);
        return buffer;
    };

    Room.prototype.setupFloatBuffer = function (data, elements, hint) {
        return this.setupBuffer(new Float32Array(data), elements, hint);
    };

    Room.prototype.setupElementBuffer = function (data, hint) {
        return this.setupBuffer(new Int16Array(data), true, hint);
    };

    Room.prototype.setupTexture = function(image, texture) {
        var gl = this.gl;
        if (!texture) {
            texture = gl.createTexture();
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    };

    Room.prototype.loadTexture = function(batch, resource) {
        var texture = this.gl.createTexture(),
            room = this;
        batch.load(resource, function(image) { room.setupTexture(image, texture); });
        return texture;
    };

    Room.prototype.setupMesh = function (mesh) {
        if (!mesh.drawData) {
            if (mesh.index >= Math.pow(2, 16)) {
                throw "Mesh has too many verticies to index!";
            }
            for (var i = 0; i < mesh.tris.length; ++i) {
                if (mesh.tris[i] >= mesh.index) {
                    throw "Past end of verticies:" + mesh.tris[i] + ", " + mesh.index;
                }
            }

            mesh.drawData = {
                vertexBuffer: this.setupFloatBuffer(mesh.vertices),
                uvBuffer: this.setupFloatBuffer(mesh.uvs),
                triBuffer: this.setupElementBuffer(mesh.tris)
            };
            if (mesh.image) {
                mesh.drawData.texture = this.setupTexture(mesh.image);
            }
        }
        return mesh.drawData;
    };

    Room.prototype.drawMesh = function (mesh, program) {
        var draw = this.setupMesh(mesh);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, draw.vertexBuffer);
        this.gl.vertexAttribPointer(program.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, draw.uvBuffer);
        this.gl.vertexAttribPointer(program.vertexUV, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, draw.triBuffer);
        if (draw.texture) {
            this.bindTexture(program.shader, program.textureVariable, draw.texture);
        }
        this.gl.drawElements(this.gl.TRIANGLES, mesh.tris.length, this.gl.UNSIGNED_SHORT, 0);
    };

    Room.prototype.setupView = function (program, viewportRegion, viewVariable, perspectiveVariable, transform, vrFrame) {
        var aspect = this.viewer.viewport(this.gl, this.canvas, viewportRegion),
            perspective = vrFrame ? this.viewer.perspectiveVR(viewportRegion, vrFrame) : this.viewer.perspective(aspect),
            view = this.viewer.view(),
            pLocation = this.gl.getUniformLocation(program, perspectiveVariable),
            vLocation = this.gl.getUniformLocation(program, viewVariable);
        if (transform) {
            view = R3.matmul(transform, view);
        }
        this.gl.uniformMatrix4fv(pLocation, false, perspective.m);
        this.gl.uniformMatrix4fv(vLocation, false, view.m);
    };

    Room.prototype.bindTexture = function (program, variable, texture) {
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.uniform1i(this.gl.getUniformLocation(program, variable), 0);
    };

    Room.prototype.programFromElements = function (vertexElement, fragmentElement) {
        var vertexSource = document.getElementById(vertexElement).innerHTML,
            fragmentSource = document.getElementById(fragmentElement).innerHTML;

        return this.setupShaderProgram(vertexSource, fragmentSource);
    };

    Room.prototype.setupDrawTest = function (program) {
        var vertices = [
                -1.0, -1.0, 0.0,
                -1.0,  1.0, 0.0,
                 1.0, -1.0, 0.0,
                 1.0,  1.0, 0.0
            ],
            uvs = [
                0.0,  1.0,
                0.0,  0.0,
                1.0,  1.0,
                1.0,  0.0
            ];

        program.batch = new BLIT.Batch("images/");
        program.square = this.setupFloatBuffer(vertices);
        program.squareUVs = this.setupFloatBuffer(uvs);
        program.squareTexture = this.loadTexture(program.batch, "uv.png");
        program.batch.commit();
    };

    Room.prototype.drawTestSquare = function (setup) {
        this.bindTexture(setup.shader, setup.textureVariable, setup.squareTexture);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, setup.square);
        this.gl.vertexAttribPointer(setup.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, setup.squareUVs);
        this.gl.vertexAttribPointer(setup.vertexUV, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    };

    Room.prototype.drawTest = function () {
        if (!this.testSetup) {
            var program = this.programFromElements("vertex-test", "fragment-test");

            this.testSetup = {
                shader: program,
                vertexPosition: this.bindVertexAttribute(program, "aPos"),
                vertexUV: this.bindVertexAttribute(program, "aUV"),
                textureVariable: "uSampler"
            };

            this.setupDrawTest(this.testSetup);
            this.viewer.position.set(0, 0, 2);
        }
        if (!this.testSetup.batch.loaded) {
            return;
        }
        this.setupView(this.testSetup.shader, "canvas", "uMVMatrix", "uPMatrix");
        this.drawTestSquare(this.testSetup);
    };

    function Mesh() {
        this.vertices = [];
        this.normals = [];
        this.uvs = [];
        this.tris = [];
        this.index = 0;
        this.bbox = new R3.AABox();
    }

    Mesh.prototype.addVertex = function (p, n, u, v) {
        p.pushOn(this.vertices);
        n.pushOn(this.normals);
        this.uvs.push(u);
        this.uvs.push(v);
        this.index += 1;
        this.bbox.envelope(p);
    };

    Mesh.prototype.addTri = function (a, b, c) {
        this.tris.push(a);
        this.tris.push(b);
        this.tris.push(c);
    };

    Mesh.prototype.appendVerticies = function (other) {
        this.vertices = this.vertices.concat(other.vertices);
        this.normals = this.normals.concat(other.normals);
        this.uvs = this.uvs.concat(other.uvs);
        this.index += other.index;
    };

    return {
        Room: Room,
        Mesh: Mesh
    };
}());
