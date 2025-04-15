// Player movement component with terrain following.
AFRAME.registerComponent('subject-locomotion', {
    schema: {
        heightOffset: {type: 'number', default: 4.6} // Height above ground.
    },

    init: function() {
        this.velocity = new THREE.Vector3();
        this.targetY = 0;

        // For updating hud location data message
        // in tick function, if X and Z movement non-zero.
        if (document.querySelector("#hud"))
            this.h = document.querySelector("#hud");

        this.cam=document.querySelector("#cam").object3D;
        this.rig=document.querySelector("#subject").object3D;
        this.timeStamp=Date.now();
        this.moveZ=0;
        this.moveX=0;

        this.running=false;
        this.flying=false;
        // this.hud=document.querySelector("#hud").object3D;
        
        // Setup key listeners for smoother movement.
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            w: false,
            s: false,
            a: false,
            d: false,
            ShiftLeft: false
        };
        
        document.addEventListener('keydown', (e) => this.keys[e.key] = true);
        document.addEventListener('keyup', (e) => this.keys[e.key] = false);
        // Also listen for shift key...
        document.addEventListener('keydown', (e) => {
            if (e.code === 'ShiftLeft') {
                this.keys.ShiftLeft = true;
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'ShiftLeft') {
                this.keys.ShiftLeft = false;
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                // this.hudToggle();
            }
        });
    },

    // Updated hudToggle function to safely handle updating the HUD.
    hudToggle: function(){
        this.hud.visible=!this.hud.visible;
        
        if (this.hud.visible){
            const h = document.querySelector("#hud");
            
            // Add error handling when calling updateHud
            if (h && typeof h.updateHud === 'function') {
                try {
                    h.updateHud();
                } catch (err) {
                    console.error("Error updating HUD:", err);
                }
            }
            this.hud.position.y=2;
            this.hud.rotation.y=this.cam.rotation.y;
        }
        else {
            this.hud.position.y=-999;
        }
    },

    tick: function(time, delta) {
        
        if (!delta) return;
        delta = delta * 0.001; // Convert to seconds.

        const position = this.rig.position;
        const rotation = this.cam.rotation;

        // Camera controls testing, for VR (and mobile).
        //if(AFRAME.utils.device.isMobile()){
            const pitch=rotation.x;
            const roll=rotation.z;
            
            // Let's try a toggle left.
            const minZ=0.3;  // Default 0.2.
			const maxZ=0.5; // Default 0.4.
                if ((roll > minZ && roll < maxZ)){
                    //console.log('rooling?');
            // Log time stamp. This will be for
            // toggling via head z rotations.
            // Have 2s elapsed?
            let cTime = Date.now();
            if (cTime-this.timeStamp > 2000){
            
                // Toggle locomotion.
                this.timeStamp=Date.now();
                if(this.moveZ==1) this.moveZ=0;
                else this.moveZ=1;
            }
        }

        // Let's try a toggle to the right.
        const RminZ=-0.3;  
        const RmaxZ=-0.5;
         //document.querySelector('#hud-text').setAttribute('value',`${roll}`);
        if ((roll < RminZ && roll > RmaxZ)){
            //console.log('right toggle!');
         // Log time stamp. This will be for
         // toggling via head z rotations.
         // Have 2s elapsed?
            let cTime = Date.now();
            if (cTime-this.timeStamp > 2000){
                this.timeStamp=Date.now();
                this.hudToggle();
            }
        }

        // Calculate movement direction.
        // Have negated sign of 1 here -- before, inverted movement bug.
        if(!AFRAME.utils.device.isMobile()){
            
            this.moveX =    (this.keys.a || this.keys.ArrowLeft ? -1 : 0) + 
                            (this.keys.d || this.keys.ArrowRight ? 1 : 0);
            this.moveZ =    (this.keys.w || this.keys.ArrowUp ? 1 : 0) + 
                            (this.keys.s || this.keys.ArrowDown ? -1 : 0);

            // Running toggle via shift.
            let sTime = Date.now();
            if (sTime-this.timeStamp > 500){
                if (this.keys.ShiftLeft) {
                    //this.running=!this.running;
                    this.timeStamp=Date.now();
                }
            }
        } 

        // Running settings!
        let run_speed=1;
        if (this.running) { 
            run_speed = 5;
            } else {
                run_speed = 1;
                }
        
        // Apply movement in camera direction.
        if (this.moveX !== 0 || this.moveZ !== 0) {

            const angle = rotation.y;
            const speed = 5 * run_speed;

            this.velocity.x = (-this.moveZ * Math.sin(angle) + this.moveX * Math.cos(angle)) * speed;
            this.velocity.z = (-this.moveZ * Math.cos(angle) - this.moveX * Math.sin(angle)) * speed;
        } else {
            this.velocity.x *= 0.9;
            this.velocity.z *= 0.9;
        }
        
        // Update position.
        position.x += this.velocity.x * delta;
        position.z += this.velocity.z * delta;
        
        // Get terrain height at current position.
        const terrainY = getTerrainHeight(position.x, position.z);
        this.targetY = terrainY + this.data.heightOffset;
        
        // Test hack to use ridges button as luna bounce.
        if (this.flying){
            // Pitch can affect y position...for flight :D
            position.y += pitch * 0.08 * this.moveZ;
        } 
            
        // Prevent falling below present surface.
        if (position.y < this.targetY) {
            position.y = terrainY + this.data.heightOffset;
        }
    }
});