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
            var drawHint = mesh.dynamic ? this.gl.DYNAMIC_DRAW : this.gl.STATIC_DRAW;

            mesh.drawData = {
                vertexBuffer: this.setupFloatBuffer(mesh.glVertices, false, drawHint),
                normalBuffer: mesh.glNormals ? this.setupFloatBuffer(mesh.glNormals) : null,
                uvBuffer: mesh.glUVs ? this.setupFloatBuffer(mesh.glUVs) : null,
                colorBuffer: mesh.glColors ? this.setupFloatBuffer(mesh.glColors, false, drawHint) : null,
                triBuffer: this.setupElementBuffer(mesh.tris)
            };
        }
        return mesh.drawData;
    };

    Room.prototype.setupMeshTexture = function (mesh) {
        if (mesh.updatedTexture && mesh.image) {
            mesh.texture = this.setupTexture(mesh.image);
            mesh.updatedTexture = false;
        }
        if (!mesh.texture && mesh.image) {
            mesh.texture = this.setupTexture(mesh.image);
        }
        return mesh.texture;
    };

    Room.prototype.rebindTexture = function (mesh, program) {
        if (mesh.drawData) {
            mesh.drawData.texture = this.setupTexture(mesh.image);
            this.bindTexture(program.shader, program.textureVariable, mesh.drawData.texture);
            return mesh.drawData.texture;
        }
        return null;
    };

    Room.prototype.bindMeshGeometry = function (mesh, program) {
        var draw = this.setupMesh(mesh),
            gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, draw.vertexBuffer);
        if (mesh.updated) {
            this.updateBuffer(draw.vertexBuffer, mesh.glVertices);
        }
        gl.vertexAttribPointer(program.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        if (program.vertexNormal !== null) {
            gl.bindBuffer(gl.ARRAY_BUFFER, draw.normalBuffer);
            gl.vertexAttribPointer(program.vertexNormal, 3, gl.FLOAT, false, 0, 0);
        }
        if (program.vertexUV !== null) {
            gl.bindBuffer(gl.ARRAY_BUFFER, draw.uvBuffer);
            gl.vertexAttribPointer(program.vertexUV, 2, gl.FLOAT, false, 0, 0);
        }
        if (program.vertexColor !== null) {
            gl.bindBuffer(gl.ARRAY_BUFFER, draw.colorBuffer);
            if (mesh.updated) {
                this.updateBuffer(draw.colorBuffer, mesh.glColors);
            }
            gl.vertexAttribPointer(program.vertexColor, 4, gl.FLOAT, false, 0, 0);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, draw.triBuffer);
        mesh.updated = false;
    };

    Room.prototype.bindMeshTexture = function (mesh, program) {
        var texture = this.setupMeshTexture(mesh);
        if (program.textureVariable !== null && texture) {
            this.bindTexture(program.shader, program.textureVariable, texture);
        }
    };

    Room.prototype.drawMeshElements = function (mesh, program, transform) {
        if (transform) {
            this.setTransform(program, transform);
        }
        this.gl.drawElements(this.gl.TRIANGLES, mesh.tris.length, this.gl.UNSIGNED_SHORT, 0);
    };

    Room.prototype.drawMesh = function (mesh, program, transform) {
        this.bindMeshGeometry(mesh, program);
        this.bindMeshTexture(mesh, program);
        this.drawMeshElements(mesh, program, transform);
    };

    Room.prototype.setupView = function (program, viewportRegion, transform, vrFrame) {
        var shader = program.shader,
            aspect = this.viewer.viewport(this.gl, this.canvas, viewportRegion),
            perspective = vrFrame ? this.viewer.perspectiveVR(viewportRegion, vrFrame) : this.viewer.perspective(aspect),
            view = this.viewer.view(),
            matrixUniform = this.gl.getUniformLocation(shader, program.mvpUniform),
            nLocation = program.normalUniform ? this.gl.getUniformLocation(shader, program.normalUniform) : null;
        if (transform) {
            view = R3.matmul(transform, view);
        }
        var mvp = R3.matmul(perspective, view);
        this.gl.uniformMatrix4fv(matrixUniform, false, mvp.m);
        if (nLocation) {
            var normal = R3.identity();
            this.gl.uniformMatrix4fv(nLocation, false, normal.m);
        }
        program.view = view;
        program.perspective = perspective;
    };

    Room.prototype.setTransform = function (program, transform) {
        var shader = program.shader,
            mvp = R3.matmul(program.view, transform),
            matrixUniform = this.gl.getUniformLocation(shader, program.mvpUniform),
            nLocation = program.normalUniform ? this.gl.getUniformLocation(shader, program.normalUniform) : null;
        R3.matmul(program.perspective, mvp, mvp);
        this.gl.uniformMatrix4fv(matrixUniform, false, mvp.m);
        if (nLocation) {
            var normal = transform.inverse();
            normal.transpose();
            this.gl.uniformMatrix4fv(nLocation, false, normal.m);
        }
    };

    Room.prototype.bindTexture = function (program, variable, texture) {
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.uniform1i(this.gl.getUniformLocation(program, variable), 0);
    };

    Room.prototype.shaderFromElements = function (vertexElement, fragmentElement) {
        var vertexSource = document.getElementById(vertexElement).innerHTML,
            fragmentSource = document.getElementById(fragmentElement).innerHTML;

        return this.setupShaderProgram(vertexSource, fragmentSource);
    };

    Room.prototype.programFromElements = function (vertexElement, fragmentElement, textures, normals, colors) {
        var shader = this.shaderFromElements(vertexElement, fragmentElement);
        return {
            shader: shader,
            mvpUniform: "uMVPMatrix",
            normalUniform: normals ? "uNormalMatrix" : null,
            vertexPosition: this.bindVertexAttribute(shader, "aPos"),
            vertexNormal: normals ? this.bindVertexAttribute(shader, "aNormal") : null,
            vertexUV: textures ? this.bindVertexAttribute(shader, "aUV") : null,
            vertexColor: colors ? this.bindVertexAttribute(shader, "aColor") : null,
            textureVariable: textures ? "uSampler" : null
        };
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

        program.square = this.setupFloatBuffer(vertices);
        program.squareNormals = this.setupFloatBuffer(normals);
        program.squareUVs = this.setupFloatBuffer(uvs);
        program.squareColors = this.setupFloatBuffer(colors);
        program.batch = new BLIT.Batch("images/");
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

    Room.prototype.drawTest = function (viewport, angle) {
        if (!this.testProgram) {
            this.testProgram = this.programFromElements("vertex-test", "fragment-test", true, true, true);
            this.setupDrawTest(this.testProgram);
        }
        if (!this.testProgram.batch.loaded) {
            return;
        }
        var d = 2,
            a = angle ? angle : Math.PI / 2,
            x = Math.cos(a) * d,
            z = Math.sin(a) * d;
        this.viewer.positionView(new R3.V(x, 0, z), R3.origin(), new R3.V(0, 1, 0));
        this.setupView(this.testProgram, viewport);
        this.drawTestSquare(this.testProgram);
    };

    Room.prototype.textureCache = function (batch) {
        var room = this;
        return {
            batch: batch,
            textures: {},
            cache: function (resource) {
                var cached = this.textures[resource],
                    self = this;
                if (cached) {
                    return cached;
                }

                cached = {
                    resource: resource
                };
                this.textures[resource] = cached;
                cached.image = batch.load(resource, function (image) {
                    cached.texture = room.setupTexture(image);
                });
                return cached;
            }
        };
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

    var DEFAULT_WHITE = [1, 1, 1, 1];

    Mesh.prototype.addVertex = function (p, n, u, v, color) {
        p.pushOn(this.vertices);
        if (n) {
            n.pushOn(this.normals);
        }
        if (color) {
            for (var c = 0; c < color.length; ++c) {
                this.colors.push(color[c]);
            }
        }
        if (u !== null) {
            this.uvs.push(u);
            this.uvs.push(v);
        }
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

    Mesh.prototype.finalize = function (min, max, remap) {
        if (min) {
            this.bbox.envelope(min);
        }
        if (max) {
            this.bbox.envelope(max);
        }
        var coords = 3,
            uvCoords = 2,
            colorChannels = IMPROC.CHANNELS;
        this.index = this.vertices.length / coords;
        if (this.normals.length > 0 && this.index * coords != this.normals.length) {
            throw "Some Normals missing!";
        }
        if (this.uvs.length > 0 && this.index * uvCoords != this.uvs.length) {
            throw "Some UVs missing!";
        }
        if (this.index * colorChannels != this.colors.length) {
            if (this.colors.length === 0 && this.fillColor) {
                for (var ci = 0; ci < this.index; ++ci) {
                    for (var channel = 0; channel < colorChannels; ++channel) {
                        this.colors.push(this.fillColor[channel]);
                    }
                }
            } else {
                throw "Some colors missing!";
            }
        }
        if (remap) {
            if (remap.length != this.index) {
                throw "Incorrect remap size!";
            }
            var vertexCount = remap.reduce(function (a, b) {return a+b;}, 0);
            if (vertexCount != remap.length) {
                this.glVertices = new Float32Array(vertexCount * coords);
                if (this.colors.length > 0) {
                    this.glColors = new Float32Array(vertexCount * colorChannels);
                }
                if (this.normals.length > 0) {
                    this.glNormals = new Float32Array(vertexCount * coords);
                }
                if (this.uvs.length > 0) {
                    this.glUVs = new Float32Array(vertexCount * uvCoords);
                }

                var c = 0;
                for (var i = 0; i < this.index; ++i) {
                    if (remap[i] > 0) {
                        for (var axis = 0; axis < coords; ++axis) {
                            this.glVertices[c*coords + axis] = this.vertices[i*coords + axis];
                            if (this.glNormals) {
                                this.glNormals[c*coords + axis] = this.normals[i*coords + axis];
                            }
                        }
                        if (this.glUVs) {
                            for (var uvAxis = 0; uvAxis < uvCoords; ++uvAxis) {
                                this.glUVs[c*uvCoords + uvAxis] = this.uvs[i*uvCoords + uvAxis];
                            }
                        }
                        if (this.glColors) {
                            for (var cc = 0; cc < colorChannels; ++cc) {
                                this.glColors[c*colorChannels + cc] = this.colors[i*colorChannels + cc];
                            }
                        }
                        remap[i] = c;
                        ++c;
                    }
                }
                this.index = c;
                for (var t = 0; t < this.tris.length; ++t) {
                    this.tris[t] = remap[this.tris[t]];
                }
                return;
            }
        }

        this.glVertices = new Float32Array(this.vertices);

        if (this.normals.length > 0) {
            this.glNormals = new Float32Array(this.normals);
        }

        if (this.uvs.length > 0) {
            this.glUVs = new Float32Array(this.uvs);
        }

        if (this.colors.length > 0) {
            this.glColors = new Float32Array(this.colors);
        }
    };

    Mesh.prototype.simplify = function () {
        this.dynamic = false;
        this.vertices = null;
        this.colors = null;
        this.normals = null;
        this.uvs = null;
    };

    function makeCube(scale, generateTexture) {
        var mesh = new Mesh(),
            s = scale || 1;
        mesh.vertices = [
            -s, -s, -s, //0
            -s, -s,  s, //1
            -s,  s,  s, //2
            -s,  s, -s, //3

             s, -s, -s,
             s, -s,  s,
             s,  s,  s,
             s,  s, -s,

            -s, -s, -s,
             s, -s, -s,
             s, -s,  s,
            -s, -s,  s,

            -s,  s, -s,
             s,  s, -s,
             s,  s,  s,
            -s,  s,  s,

            -s, -s, -s,
            -s,  s, -s,
             s,  s, -s,
             s, -s, -s,

            -s, -s,  s,
            -s,  s,  s,
             s,  s,  s,
             s, -s,  s
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
                mesh.tris.push(twoFace[i] + f * 8);
            }
        }

        mesh.fillColor = [1, 1, 1, 1];
        mesh.finalize(new R3.V(1,1,1), new R3.V(-1,-1,-1));

        if (generateTexture) {
            var canvas = document.createElement('canvas'),
                context = canvas.getContext('2d'),
                THIRD = 42;

            canvas.width = canvas.height = 128;
            context.globalAlpha = 0.5;

            context.fillStyle = "rgba(255, 0, 0, 128)";
            context.fillRect(0, 0, THIRD, THIRD);
            context.fillStyle = "rgba(0, 255, 0, 128)";
            context.fillRect(THIRD, 0, THIRD, THIRD);
            context.fillStyle = "rgba(0, 0, 255, 128)";
            context.fillRect(2*THIRD, 0, THIRD, THIRD);
            context.fillStyle = "rgba(255, 255, 0, 128)";
            context.fillRect(0, THIRD, THIRD, THIRD);
            context.fillStyle = "rgba(0, 255, 255, 128)";
            context.fillRect(THIRD, THIRD, THIRD, THIRD);
            context.fillStyle = "rgba(255, 0, 255, 128)";
            context.fillRect(2*THIRD, THIRD, THIRD, THIRD);
            mesh.image = canvas;
        }

        return mesh;
    }

    function makeCylinder(radius, height, segments, coords, insideOut) {
        var mesh = new Mesh(),
            angleStep = 2 * Math.PI / segments,
            uStep = coords.uSize / segments,
            color = [1, 1, 1, 1],
            vIndices = [0,0,0,0];

        for (var s = 0; s <= segments; ++s) {
            var angle = s * angleStep,
                x = Math.cos(angle),
                z = Math.sin(angle),
                n = new R3.V(x, 0, z),
                p = n.scaled(radius),
                u = coords.uMin + s * uStep;

            for (var offset = 0; offset < vIndices.length; ++offset) {
                vIndices[offset] = s * 2 + offset;
            }

            mesh.addVertex(p, n, u, coords.vMin, color);
            p.y = height;
            mesh.addVertex(p, n, u, coords.vMin + coords.vSize, color);

            if (s < segments) {
                if (insideOut) {
                    mesh.addTri(vIndices[0], vIndices[1], vIndices[2]);
                    mesh.addTri(vIndices[1], vIndices[3], vIndices[2]);
                } else {
                    mesh.addTri(vIndices[0], vIndices[2], vIndices[1]);
                    mesh.addTri(vIndices[1], vIndices[2], vIndices[3]);
                }
            }
        }

        mesh.finalize();
        return mesh;
    }

    function makeBillboard(textureCoords) {
        var mesh = new Mesh();
        mesh.vertices = [
             1,  1,  0,
             1, -1,  0,
            -1, -1,  0,
            -1,  1,  0
        ];

        mesh.normals = [
            0, 0,  1,
            0, 0,  1,
            0, 0,  1,
            0, 0,  1
        ];

        mesh.colors = [
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1
        ];

        mesh.uvs = [
            textureCoords.uMin, textureCoords.vMin,
            textureCoords.uMin, textureCoords.vMin + textureCoords.vSize,
            textureCoords.uMin + textureCoords.uSize, textureCoords.vMin + textureCoords.vSize,
            textureCoords.uMin + textureCoords.uSize, textureCoords.vMin
        ];

        mesh.tris = [0, 1, 3, 1, 2, 3];
        mesh.finalize(new R3.V(1,1,0), new R3.V(-1,-1,0));
        return mesh;
    }

    function nextPowerOfTwo(target) {
        var value = 1;
        while (value < target) {
            value *= 2;
        }
        return value;
    }
    
    function atlasCount(width, height, size) {
        var hCount = Math.floor(size / width),
            vCount = Math.floor(size / height);
        return hCount * vCount;
    }

    function sizeAtlas(width, height, count) {
        var size = nextPowerOfTwo(Math.max(width, height));
        while(atlasCount(width, height, size) < count) {
            size *= 2;
        }
        return size;
    }

    function TextureAtlas(width, height, count) {
        this.width = width;
        this.height = height;
        this.xOffset = 0;
        this.yOffset = 0;
        this.placed = 0;
        this.size = sizeAtlas(width, height, count);
        this.capacity = atlasCount(width, height, this.size);
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.context = this.canvas.getContext('2d');
        this.context.clearRect(0, 0, this.size, this.size);
    }

    TextureAtlas.prototype.add = function(image, left, top, width, height) {
        if (!width) {
            width = image.width;
        }
        if (!height) {
            height = image.height;
        }
        console.assert(width <= this.width);
        console.assert(height <= this.height);
        console.assert(this.placed < this.capacity);

        var xSpare = Math.floor((this.width - width)/2),
            ySpare = Math.floor((this.height - height)/2),
            srcX = left ? left : 0,
            srcY = top ? top : 0,
            x = this.xOffset + xSpare,
            y = this.yOffset + ySpare;

        var texCoords = {
            uMin: x / this.size,
            vMin: y / this.size,
            uSize: width / this.size,
            vSize: height / this.size
        };
        this.context.drawImage(image, srcX, srcY, width, height, x, y, width, height);
        this.advance();
        return texCoords;
    };

    TextureAtlas.prototype.isFull = function () {
        return this.placed == this.capacity;
    };

    TextureAtlas.prototype.advance = function () {
        ++this.placed;
        this.xOffset += this.width;
        if (this.xOffset + this.width > this.size) {
            this.xOffset = 0;
            this.yOffset += this.height;
        }
    };

    TextureAtlas.prototype.offset = function(offsetCount) {
        for (var c = 0; c < offsetCount; ++c) {
            this.advance();
        }
    };

    TextureAtlas.prototype.texture = function () {
        return this.canvas;
    };

    function setupAtlas(resource, frameCount, digits, resolution, scale, offset, atlasDiv, coordOutput) {
        var frames = [],
            ATLAS_RES = 1024,
            fitCount = ATLAS_RES / resolution,
            atlasCount = fitCount * fitCount,
            batch = new BLIT.Batch("../images/", function () {
                var atlas = new TextureAtlas(resolution, resolution, atlasCount),
                    coords = [],
                    atlasCoords = [],
                    imageCount = 0;
                atlas.offset(offset);
                coords.push({image:"0.png", frames:atlasCoords});

                for (var f = 0; f < frames.length; ++f) {
                    var frame = frames[f];
                    if (atlas.isFull()) {
                        ++imageCount;
                        atlasDiv.appendChild(atlas.texture());
                        atlas = new TextureAtlas(resolution, resolution, atlasCount);
                        atlasCoords = [];
                        coords.push({image: imageCount + ".png", frames:atlasCoords});
                    }

                    if (scale) {
                        var canvas = document.createElement('canvas'),
                            context = canvas.getContext('2d');
                        canvas.width = resolution;
                        canvas.height = resolution;
                        context.clearRect(0, 0, resolution, resolution);
                        BLIT.draw(context, frame,
                            resolution / 2, resolution / 2,
                            BLIT.ALIGN.Center,
                            Math.round(frame.width * scale),
                            Math.round(frame.height * scale)
                        );
                        frame = canvas;
                    }
                    atlasCoords.push(atlas.add(frame));
                }
                atlasDiv.appendChild(atlas.texture());
                coordOutput(JSON.stringify(coords, null, 4));
            });
        for (var i = 0; i < frameCount; ++i) {
            var number = i.toString();
            while (number.length < digits) {
                number = "0" + number;
            }
            frames.push(batch.load(resource + number + ".png"));
        }
        batch.commit();
    }

    return {
        Room: Room,
        Mesh: Mesh,
        TextureAtlas: TextureAtlas,
        makeCube: makeCube,
        makeCyclinder: makeCylinder,
        makeBillboard: makeBillboard,
        uvFill: function () { return { uMin: 0, vMin: 0, uSize: 1, vSize: 1 }; },
        setupAtlas: setupAtlas
    };
}());
