var BLOB = (function () {
   "use strict";
   
   function Thing(mesh) {
       this.position = R3.origin();
       this.orientation = R3.zeroQ();
       this.scale = 1;
       this.toWorld = new R3.M();
       this.toLocal = null;
       this.transformDirty = false;

       this.mesh = mesh ? mesh : null;
   }

   Thing.prototype.move = function (offset) {
        this.position.add(offset);
        this.transformDirty = true;
   };

   Thing.prototype.rotate = function (angle, axis) {
        var delta = R3.angleAxisQ(angle, axis);
        this.orientation.times(delta);
        this.transformDirty = true;
   };

   Thing.prototype.render = function(room, program) {
        if (this.mesh) {
            var m = this.toWorld;

            if (this.transformDirty) {
                var rotate = R3.makeRotateQ(this.orientation);
                m.setIdentity();
                m.translate(this.position);
                m.scale(this.scale);
                R3.matmul(m, rotate, m);
                this.transformDirty = false;
            }

            room.drawMesh(this.mesh, program, m);
        }
   };

   Thing.prototype.getToLocal = function () {
        if (this.transformDirty || this.toLocal === null) {
            this.toLocal = this.toWorld.inverse();
        }
        return this.toLocal;
   };

   Thing.prototype.toLocalP = function (point) {
       return this.getToLocal().transformP(point);
   };

   Thing.prototype.toLocalV = function (vector) {
       return this.getToLocal().transformV(vector);
   };

   return {
       Thing: Thing
   };
}());
