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
        this.forward = new R3.V(0, 1, 0);
        this.up = new R3.V(0, 0, 1);
        this.fov = 90;
        this.near = 0.1;
        this.far = 100;
        this.vrDisplay = null;
        this.size = new R2.V(0, 0);
        this.safeSize = new R2.V(0, 0);
        this.vrFrameData = null;
    }

    Viewer.prototype.positionView = function (position, target, up) {
        this.position = position.copy();
        if (target) {
            this.forward = R3.subVectors(target, position);
            this.forward.normalize();
        }
        if (up) {
            this.up = up.normalized();
        }
    };

    Viewer.prototype.setVRDisplay = function (vrDisplay) {
        this.vrDisplay = vrDisplay;
        this.vrFrameData = new VRFrameData();
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
        var forward = this.forward.scaled(1);
        var right = forward.cross(this.up);
        right.normalize();
        var up = right.cross(forward);
        up.normalize();
        var posX = -right.dot(this.position);
        var posY = -up.dot(this.position);
        var posZ = forward.dot(this.position);
        var m = new R3.M([
            right.x, up.x, -forward.x, 0,
            right.y, up.y, -forward.y, 0,
            right.z, up.z, -forward.z, 0,
            posX, posY, posZ, 1
        ]);
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
        if (this.vrDisplay && this.vrDisplay.getFrameData(this.vrFrameData)) {
            return this.vrFrameData;
        }
        return null;
    };

    Viewer.prototype.submitVR = function () {
        this.vrDisplay.submitFrame();
    };

    Viewer.prototype.normalizedStabPoint = function (canvas, canvasX, canvasY, viewportRegion) {
        var width = canvas.width,
            height = canvas.height;
        if (viewportRegion == "safe") {
            width = this.safeSize.x;
            height = this.safeSize.y;
        }
        
        var aspect = height / width,
            viewScale =  Math.tan(this.fov * R2.DEG_TO_RAD * 0.5),
            normalizedX = canvasX / (width * 0.5) - 1,
            normalizedY = (1 - canvasY / (height * 0.5));

        return new R3.V(
            normalizedX * viewScale,
            normalizedY * viewScale * aspect,
            -1
        );
    };

    Viewer.prototype.stabDirection = function (canvas, canvasX, canvasY, viewportRegion) {
        var right = this.forward.cross(this.up);
        right.normalize();
        var up = right.cross(this.forward);
        up.normalize();

        var point = this.normalizedStabPoint(canvas, canvasX, canvasY, viewportRegion),
            stab = this.forward.normalized();
        stab.addScaled(right, point.x);
        stab.addScaled(up, point.y);
        return stab;
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

    Room.prototype.updateBuffer = function (buffer, data, elements) {
        var hint = this.gl.DYNAMIC_DRAW;
        var arrayType = elements ? this.gl.ELEMENT_ARRAY_BUFFER : this.gl.ARRAY_BUFFER;
        this.gl.bindBuffer(arrayType, buffer);
        this.gl.bufferData(arrayType, data, hint);
    };

    Room.prototype.setupFloatBuffer = function (data, elements, hint) {
        return this.setupBuffer(data, elements, hint);
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

    Room.prototype.setupMesh = function (mesh, dynamic) {
        if (!mesh.drawData) {
            if (mesh.index >= Math.pow(2, 16)) {
                throw "Mesh has too many verticies to index!";
            }
            for (var i = 0; i < mesh.tris.length; ++i) {
                if (mesh.tris[i] >= mesh.index) {
                    throw "Past end of verticies:" + mesh.tris[i] + ", " + mesh.index;
                }
            }
            var drawHint = dynamic ? this.gl.DYNAMIC_DRAW : this.gl.STATIC_DRAW;

            mesh.drawData = {
                vertexBuffer: this.setupFloatBuffer(mesh.glVertices, false, drawHint),
                normalBuffer: this.setupFloatBuffer(mesh.glNormals),
                uvBuffer: this.setupFloatBuffer(mesh.glUVs),
                colorBuffer: this.setupFloatBuffer(mesh.glColors, false, drawHint),
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

        if (mesh.transform) {
            this.pushTransform(program, mesh.transform);
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, draw.vertexBuffer);
        if (mesh.updated) {
            this.updateBuffer(draw.vertexBuffer, mesh.glVertices);
        }
        this.gl.vertexAttribPointer(program.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);
        if (program.vertexNormal !== null) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, draw.normalBuffer);
            this.gl.vertexAttribPointer(program.vertexNormal, 3, this.gl.FLOAT, false, 0, 0);
        }
        if (program.vertexUV !== null) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, draw.uvBuffer);
            this.gl.vertexAttribPointer(program.vertexUV, 2, this.gl.FLOAT, false, 0, 0);
        }
        if (program.vertexColor !== null) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, draw.colorBuffer);
            if (mesh.updated) {
                this.updateBuffer(draw.colorBuffer, mesh.glColors);
            }
            this.gl.vertexAttribPointer(program.vertexColor, 4, this.gl.FLOAT, false, 0, 0);
        }
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, draw.triBuffer);
        if (draw.texture) {
            this.bindTexture(program.shader, program.textureVariable, draw.texture);
        }
        this.gl.drawElements(this.gl.TRIANGLES, mesh.tris.length, this.gl.UNSIGNED_SHORT, 0);
        mesh.updated = false;
    };

    Room.prototype.setupView = function (program, viewportRegion, transform, vrFrame) {
        var shader = program.shader,
            aspect = this.viewer.viewport(this.gl, this.canvas, viewportRegion),
            perspective = vrFrame ? this.viewer.perspectiveVR(viewportRegion, vrFrame) : this.viewer.perspective(aspect),
            view = this.viewer.view(),
            pLocation = this.gl.getUniformLocation(shader, program.perspectiveUniform),
            vLocation = this.gl.getUniformLocation(shader, program.mvUniform),
            nLocation = program.normalUniform ? this.gl.getUniformLocation(shader, program.normalUniform) : null;
        if (transform) {
            view = R3.matmul(transform, view);
        }
        this.gl.uniformMatrix4fv(pLocation, false, perspective.m);
        this.gl.uniformMatrix4fv(vLocation, false, view.m);
        if (nLocation) {
            var normal = R3.identity();
            this.gl.uniformMatrix4fv(nLocation, false, normal.m);
        }
        program.view = view;
    };

    Room.prototype.pushTransform = function (program, transform) {
        var shader = program.shader,
            modelView = new R3.M(),
            vLocation = this.gl.getUniformLocation(shader, program.mvUniform),
            nLocation = this.gl.getUniformLocation(shader, program.normalUniform);
        R3.matmul(program.view, transform, modelView);
        this.gl.uniformMatrix4fv(vLocation, false, modelView.m);
        var normal = transform.inverse();
        normal.transpose();
        this.gl.uniformMatrix4fv(nLocation, false, normal.m);
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

    Room.prototype.stabDirection = function(canvasX, canvasY, viewportRegion) {
        return this.viewer.stabDirection(this.canvas, canvasX, canvasY, viewportRegion);
    };

    Room.prototype.setupDrawTest = function (program) {
        var vertices = new Float32Array([
                -1.0, -1.0, 0.0,
                 1.0, -1.0, 0.0,
                -1.0,  1.0, 0.0,
                 1.0,  1.0, 0.0
            ]),
            normals = new Float32Array([
                0.0, 0.0, 1.0,
                0.0, 0.0, 1.0,
                0.0, 0.0, 1.0,
                0.0, 0.0, 1.0
            ]),
            uvs = new Float32Array([
                0.0,  1.0,
                1.0,  1.0,
                0.0,  0.0,
                1.0,  0.0
            ]),
            colors = new Float32Array([
                1.0, 0.0, 1.0, 1.0,
                1.0, 1.0, 0.0, 1.0,
                0.0, 1.0, 1.0, 1.0,
                1.0, 1.0, 1.0, 1.0
            ]);

        program.batch = new BLIT.Batch("images/");
        program.square = this.setupFloatBuffer(vertices);
        program.squareNormals = this.setupFloatBuffer(normals);
        program.squareUVs = this.setupFloatBuffer(uvs);
        program.squareColors = this.setupFloatBuffer(colors);
        program.squareTexture = this.loadTexture(program.batch, "uv.png");
        program.batch.commit();
    };

    Room.prototype.drawTestSquare = function (setup) {
        this.bindTexture(setup.shader, setup.textureVariable, setup.squareTexture);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, setup.square);
        this.gl.vertexAttribPointer(setup.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);
        if (setup.vertexNormal !== null) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, setup.squareNormals);
            this.gl.vertexAttribPointer(setup.vertexNormal, 3, this.gl.FLOAT, false, 0, 0);
        }
        if (setup.vertexUV !== null) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, setup.squareUVs);
            this.gl.vertexAttribPointer(setup.vertexUV, 2, this.gl.FLOAT, false, 0, 0);
        }
        if (setup.vertexColor !== null) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, setup.squareColors);
            this.gl.vertexAttribPointer(setup.vertexColor, 4, this.gl.FLOAT, false, 0, 0);
        }
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    };

    Room.prototype.drawTest = function () {
        if (!this.testSetup) {
            var program = this.programFromElements("vertex-test", "fragment-test");

            this.testSetup = {
                shader: program,
                vertexPosition: this.bindVertexAttribute(program, "aPos"),
                vertexNormal: this.bindVertexAttribute(program, "aNormal"),
                vertexUV: this.bindVertexAttribute(program, "aUV"),
                vertexColor: this.bindVertexAttribute(program, "aColor"),
                mvUniform: "uMVMatrix",
                perspectiveUniform: "uPMatrix",
                normalUniform: "uNormalMatrix",
                textureVariable: "uSampler"
            };

            this.setupDrawTest(this.testSetup);
            this.viewer.positionView(new R3.V(0, 0, 1.5), R3.origin(), new R3.V(0, 1, 0))
        }
        if (!this.testSetup.batch.loaded) {
            return;
        }
        this.setupView(this.testSetup, "canvas");
        this.drawTestSquare(this.testSetup);
    };

    function Mesh() {
        this.vertices = [];
        this.normals = [];
        this.uvs = [];
        this.colors = [];
        this.tris = [];
        this.index = 0;
        this.bbox = new R3.AABox();
        this.transform = R3.identity();
        this.updated = false;
    }

    function fixComponent(c) {
        if (c === undefined || c === null) {
            return 1;
        }
        return c;
    }

    Mesh.prototype.addVertex = function (p, n, u, v, r, g, b, a) {
        p.pushOn(this.vertices);
        n.pushOn(this.normals);
        this.colors.push(fixComponent(r));
        this.colors.push(fixComponent(g));
        this.colors.push(fixComponent(b));
        this.colors.push(fixComponent(a));
        this.uvs.push(u);
        this.uvs.push(v);
        this.index += 1;
        this.bbox.envelope(p);
    };

    Mesh.prototype.addTri = function (a, b, c) {
        this.tris.push(a);
        this.tris.push(c);
        this.tris.push(b);
    };

    Mesh.prototype.appendVerticies = function (other) {
        this.vertices = this.vertices.concat(other.vertices);
        this.normals = this.normals.concat(other.normals);
        this.uvs = this.uvs.concat(other.uvs);
        this.index += other.index;
    };

    Mesh.prototype.finalize = function (min, max) {
        if (min) {
            this.bbox.envelope(min);
        }
        if (max) {
            this.bbox.envelope(max);
        }
        this.index = this.vertices.length / 3;
        if (this.index != this.normals.length / 3) {
            throw "Normals missing!";
        }
        if (this.index != this.uvs.length / 2) {
            throw "UVs missing!";
        }
        if (this.index != this.colors.length / 4) {
            for (var i = this.colors.length / 4; i < this.index; ++i) {
                this.colors.push(1);
                this.colors.push(1);
                this.colors.push(1);
                this.colors.push(0);
            }
        }
        this.glVertices = new Float32Array(this.vertices);
        this.glUVs = new Float32Array(this.uvs);
        this.glColors = new Float32Array(this.colors);
        this.glNormals = new Float32Array(this.normals);
    };

    function makeCube() {
        var mesh = new Mesh();
        mesh.verticies = [
            -1, -1, -1, //0
            -1, -1,  1, //1
            -1,  1,  1, //2
            -1,  1, -1, //3

             1, -1, -1,
             1, -1,  1,
             1,  1,  1,
             1,  1, -1,

            -1, -1, -1,
            -1, -1,  1,
             1, -1,  1,
             1, -1, -1,

            -1,  1, -1,
            -1,  1, -1,
            -1,  1, -1,
            -1,  1, -1,

            -1, -1, -1,
            -1,  1, -1,
             1,  1, -1,
             1, -1, -1,

            -1, -1,  1,
            -1,  1,  1,
             1,  1,  1,
             1, -1,  1
        ];

        mesh.normals = [
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0,

             1, 0, 0,
             1, 0, 0,
             1, 0, 0,
             1, 0, 0,

            0, -1, 0,
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,

            0,  1, 0,
            0,  1, 0,
            0,  1, 0,
            0,  1, 0,

            0, 0, -1,
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,

            0, 0,  1,
            0, 0,  1,
            0, 0,  1,
            0, 0,  1
        ];

        mesh.uvs = [
            0.02, 0.02,
            0.02, 0.32,
            0.32, 0.32,
            0.32, 0.02,

            0.02, 0.35,
            0.02, 0.65,
            0.32, 0.65,
            0.32, 0.35,

            0.35, 0.02,
            0.35, 0.32,
            0.65, 0.32,
            0.65, 0.02,

            0.35, 0.35,
            0.35, 0.65,
            0.65, 0.65,
            0.65, 0.35,

            0.68, 0.01,
            0.68, 0.31,
            0.98, 0.31,
            0.98, 0.01,

            0.68, 0.35,
            0.68, 0.65,
            0.98, 0.65,
            0.98, 0.35,
        ];

        var twoFace = [0, 1, 3, 1, 2, 3, 4, 7, 5, 5, 7, 6];
        mesh.tris = [];

        for (var f = 0; f < 3; ++f) {
            for (var i = 0; i < twoFace.length; ++i) {
                mesh.tris.push(twoFace[i] + f * twoFace.length);
            }
        }
        mesh.finalize(new R3.V(1,1,1), new R3.V(-1,-1,-1));
        return mesh;
    }

    function makeCylinder() {
        var mesh = new Mesh();
        mesh.finalize(new R3.V(1,1,1), new R3.V(-1,-1,-1));
        return mesh;
    }

    return {
        Room: Room,
        Mesh: Mesh,
        makeCube: makeCube,
        makeCyclinder: makeCylinder
    };
}());
