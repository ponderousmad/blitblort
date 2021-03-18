var GEO = (function () {
    "use strict";


    function makeCube(scale, uvCoords, gutterSize, generateTexture, insideOut) {
        var mesh = new WGL.Mesh(),
            s = scale || 1,
            coords = uvCoords || WGL.uvFill(),
            gutter = gutterSize || 1.0 / 512;
        mesh.vertices = [
            //   V   U  A
            -s, -s, -s, //0
            -s, -s,  s, //1
            -s,  s,  s, //2
            -s,  s, -s, //3
            //U  V      B
            -s,  s,  s,
            -s, -s,  s,
             s, -s,  s,
             s,  s,  s,
            //   V   U  C
             s, -s,  s,
             s, -s, -s,
             s,  s, -s,
             s,  s,  s,
            //V      U  Top
             s,  s, -s,
            -s,  s, -s,
            -s,  s,  s,
             s,  s,  s,
            //U  V      D
            -s, -s, -s,
            -s,  s, -s,
             s,  s, -s,
             s, -s, -s,
            //V      U  Bottom
            -s, -s, -s,
             s, -s, -s,
             s, -s,  s,
            -s, -s,  s
        ];

        var out = 1;
        if(insideOut)
        {
            out = -1;
        }

        mesh.normals = [
            -out, 0, 0,
            -out, 0, 0,
            -out, 0, 0,
            -out, 0, 0,

            0, 0, out,
            0, 0, out,
            0, 0, out,
            0, 0, out,

            out, 0, 0,
            out, 0, 0,
            out, 0, 0,
            out, 0, 0,

            0, out, 0,
            0, out, 0,
            0, out, 0,
            0, out, 0,

            0, 0, -out,
            0, 0, -out,
            0, 0, -out,
            0, 0, -out,

            0, -out, 0,
            0, -out, 0,
            0, -out, 0,
            0, -out, 0,
        ];

        var uvSize = (1 - (2 * gutter)) / 3,
            uA = [
                WGL.mapU(coords, gutter),
                WGL.mapU(coords, gutter + uvSize),
                WGL.mapU(coords, gutter + 2 * uvSize),
                WGL.mapU(coords, 1 - gutter)
            ],
            uB = uA,
            vA = [
                WGL.mapV(coords, gutter),
                WGL.mapV(coords, gutter + uvSize)
            ],
            vB = [
                WGL.mapV(coords, 3 * gutter + uvSize),
                WGL.mapV(coords, 3 * gutter + 2 * uvSize)
            ];
        if (insideOut)
        {
            uA = uA.slice().reverse();
            vB.reverse();
        }
        mesh.uvs = [
            // A
            uA[0], vA[1],
            uA[1], vA[1],
            uA[1], vA[0],
            uA[0], vA[0],
            // B
            uA[1], vA[0],
            uA[1], vA[1],
            uA[2], vA[1],
            uA[2], vA[0],
            // C
            uA[2], vA[1],
            uA[3], vA[1],
            uA[3], vA[0],
            uA[2], vA[0],
            // Top
            uB[1], vB[1],
            uB[1], vB[0],
            uB[0], vB[0],
            uB[0], vB[1],
            // D
            uB[2], vB[0],
            uB[1], vB[0],
            uB[1], vB[1],
            uB[2], vB[1],
            // Bottom
            uB[2], vB[0],
            uB[2], vB[1],
            uB[3], vB[1],
            uB[3], vB[0],
        ];

        var face = [0, 1, 3, 1, 2, 3];
        if (insideOut) {
            face = [0, 3, 1, 1, 3, 2];
        }
        mesh.tris = [];

        for (var f = 0; f < 6; ++f) {
            for (var i = 0; i < face.length; ++i) {
                mesh.tris.push(face[i] + f * 4);
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
