var GEO = (function () {
    "use strict";


    function makeCube(scale, generateTexture) {
        var mesh = new WGL.Mesh(),
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
        var mesh = new WGL.Mesh(),
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

    function makePlane(textureCoords) {
        var mesh = new WGL.Mesh();
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

    return {
        makeCube: makeCube,
        makeCylinder: makeCylinder,
        makePlane: makePlane
    };
}());
