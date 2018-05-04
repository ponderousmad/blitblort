var GEO = (function () {
    "use strict";


    function makeCube(scale, uvCoords, gutterSize, generateTexture) {
        var mesh = new WGL.Mesh(),
            s = scale || 1,
            coords = uvCoords || WGL.uvFill(),
            gutter = gutterSize || 1.0 / 512;
        mesh.vertices = [
            //   V   U
            -s, -s, -s, //0 A
            -s, -s,  s, //1
            -s,  s,  s, //2
            -s,  s, -s, //3
            //   V   U
             s, -s, -s, // C
             s, -s,  s,
             s,  s,  s,
             s,  s, -s,
            //V      U
            -s, -s, -s, // Bottom
             s, -s, -s,
             s, -s,  s,
            -s, -s,  s,
            //V      U
            -s,  s, -s, // Top
             s,  s, -s,
             s,  s,  s,
            -s,  s,  s,
            //U  V
            -s, -s, -s, // D
            -s,  s, -s,
             s,  s, -s,
             s, -s, -s,
            //U  V
            -s, -s,  s, // B
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

        var uvSize = (1 - (2 * gutter)) / 3,
            u0 = WGL.mapU(coords, gutter),
            u1 = WGL.mapU(coords, gutter + uvSize),
            u2 = WGL.mapU(coords, gutter + 2 * uvSize),
            u3 = WGL.mapU(coords, 1 - gutter),
            v0 = WGL.mapV(coords, gutter),
            v1 = WGL.mapV(coords, gutter + uvSize),
            v2 = WGL.mapV(coords, 3 * gutter + uvSize),
            v3 = WGL.mapV(coords, 3 * gutter + 2 * uvSize);
        mesh.uvs = [
            u0, v1, // A
            u1, v1,
            u1, v0,
            u0, v0,

            u3, v1, // C
            u2, v1,
            u2, v0,
            u3, v0,

            u2, v2, // Bottom
            u2, v3,
            u3, v3,
            u3, v2,

            u1, v2, // Top
            u1, v3,
            u0, v3,
            u0, v2,

            u2, v2, // D
            u1, v2,
            u1, v3,
            u2, v3,

            u1, v1, // B
            u1, v0,
            u2, v0,
            u2, v1,
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
                SIZE = 128,
                THIRD = 126/3,
                G = 1,
                V0 = G,
                V1 = 3*G + THIRD;

            canvas.width = canvas.height = SIZE;
            context.globalAlpha = 0.5;

            context.fillStyle = "rgba(0, 0, 0, 255";
            context.fillRect(0, 0, SIZE, SIZE);
            context.fillStyle = "rgba(255, 0, 0, 255)";
            context.fillRect(G, V0, THIRD, THIRD);
            context.fillStyle = "rgba(0, 255, 0, 255)";
            context.fillRect(G + THIRD, V0, THIRD, THIRD);
            context.fillStyle = "rgba(0, 0, 255, 255)";
            context.fillRect(G + 2*THIRD, V0, THIRD, THIRD);
            context.fillStyle = "rgba(255, 255, 0, 255)";
            context.fillRect(G, V1, THIRD, THIRD);
            context.fillStyle = "rgba(0, 255, 255, 255)";
            context.fillRect(G + THIRD, V1, THIRD, THIRD);
            context.fillStyle = "rgba(255, 0, 255, 255)";
            context.fillRect(G + 2*THIRD, V1, THIRD, THIRD);
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
