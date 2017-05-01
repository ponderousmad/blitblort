var BLOB = (function () {
   "use strict";
   
   function Thing(mesh) {
       this.position = R3.origin();
       this.orientation = R3.zeroQ();
       this.scale = 1;

       this.mesh = mesh ? mesh : null;
   }

   Thing.prototype.move = function (offset) {
        this.position.add(offset);
   };

   Thing.prototype.rotate = function (angle, axis) {
        var delta = R3.angleAxisQ(angle, axis);
        this.orientation.times(delta);
   };

   Thing.prototype.render = function(room, program) {
        if (this.mesh) {
            var m = this.mesh.transform,
                rotate = R3.makeRotateQ(this.orientation);
            if (!m) {
                m = new R3.M();
                this.mesh.transform = m;
            }
            m.setIdentity();
            m.translate(this.position);
            m.scale(this.scale);
            R3.matmul(m, rotate, m);

            room.drawMesh(this.mesh, program);
        }
   };

   return {
       Thing: Thing
   };
}());
