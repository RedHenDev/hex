// Player movement component with terrain following.
AFRAME.registerComponent('terrain-movement', {
    schema: {
        height: {type: 'number', default: 4.6} // Height above ground.
    },

    init: function() {
        this.velocity = new THREE.Vector3();
        this.targetY = 0;

        // For updating hud location data message
        // in tick function, if X and Z movement non-zero.
        if (document.querySelector("#hud"))
        this.h = document.querySelector("#hud");

        // Experiment. Monty the armadillo.
        //this.monty=document.querySelector("#monty").object3D;

        // Quest management.
        /*
        this.questManager=
        document.querySelector('[quest-manager]').components['quest-manager'];
        */

        this.fov=80;
        this.cam=document.querySelector("#cam").object3D;
        this.rig=document.querySelector("#player").object3D;
        this.timeStamp=Date.now();
        this.moveZ=0;
        this.moveX=0;

        this.running=false;
        this.flying=false;
        // this.hud=document.querySelector("#hud").object3D;
        // NB not using for time being...
        // this.minihud=document.querySelector("#micro-hud");

        // Luna bounce.
        this.lunaBounce=false;
        this.jumpTime=Date.now();
        this.jumping=false;
        this.presentJumpSpeed=0.5;
        
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

    // Updated hudToggle function to safely handle updating the HUD

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
            this.hud.position.y=999;
        }
    },

    tick: function(time, delta) {
        
        if (!delta) return;
        delta = delta * 0.001; // Convert to seconds.

        const position = this.rig.position;
        const rotation = this.cam.rotation;

        // Quest updates. Should be handled by quest module, not here.
        //const questManager = document.querySelector('[quest-manager]').components['quest-manager'];
        /*
        this.questManager.checkLocation(position.x, position.y, position.z);
        this.questManager.checkPickup(position.x, position.y, position.z);
        */

        // Camera controls testing, for VR (and mobile).
        //if(AFRAME.utils.device.isMobile()){
            const pitch=rotation.x;
            const roll=rotation.z;

/*
// Location of co-ords projected to a HUD.
// Add player count if available.
const playerCount = window.playerCount || 1;
document.querySelector('#micro-hud-text').setAttribute(
    'value',`X ${Math.floor(position.x)} Z ${Math.floor(position.z)} | Souls: ${playerCount}`);
    //${Math.floor(position.y)}    
*/
    
    /*
        document.querySelector('#micro-hud-text').setAttribute(
            'value',`${Math.floor(position.x)} ${Math.floor(position.y)} ${Math.floor(position.z)}`);
        */
            // document.querySelector('#micro-hud-text').setAttribute(
        //     'value',`${Math.floor(rotation.y)} `);

            // document.querySelector('#micro-hud-text').setAttribute(
            //     'value',`${pitch}`);
            
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

                // Build testing...
                // const bud = document.createElement('a-box');
                // bud.setAttribute('position', `  ${position.x} 
                //                                 ${position.y+5}
                //                                 ${position.z-5}`);
                // bud.setAttribute('scale','2 2 2');
                // bud.setAttribute('color','#FFF');
                // document.querySelector('a-scene').appendChild(bud);
                //console.log('boomy');
                
            }
        //}
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
                //this.hud.visible=!this.hud.visible;
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
        
        
        // Return fov to normal, i.e. not running.
        if (this.fov<80){this.fov=80;}
        else 
            {document.querySelector("#cam").setAttribute("fov",`${this.fov-=0.5}`);}
        

        // Apply movement in camera direction.
        if (this.moveX !== 0 || this.moveZ !== 0) {

            // Update menu data on subject location.
            // Add error handling when calling updateHud
            if (this.h && typeof this.h.updateHud === 'function') {
                try {
                    this.h.updateHud();
                } catch (err) {
                    console.error("Error updating HUD:", err);
                }
            }

            const angle = rotation.y;
            
            if (this.running)
            document.querySelector("#cam").setAttribute("fov",`${this.fov+=0.6}`);
            if (this.fov>120)this.fov=120;

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
        this.targetY = terrainY + this.data.height;
        
        // Test hack to use ridges button as luna bounce.
        //this.lunaBounce=ridges;
        if (this.flying){
            // Pitch can affect y position...for flight :D
            //position.y += pitch*0.06 * Math.abs(this.velocity.z+this.velocity.x);
            position.y += pitch*0.08*this.moveZ;
        } else if (this.lunaBounce) {
            if (!this.jumping){
                position.y -= this.presentJumpSpeed;
                // Moony = 1.01 Earthy = 1.1
                this.presentJumpSpeed *= 1.03;
            }
            else if (this.jumping && this.moveZ==1){
                position.y += this.presentJumpSpeed;
                // Friction upward is 0.986.
                this.presentJumpSpeed *= 0.986;
                // The smaller the number below, the smoother the crest and fall.
                // 0.0085 is nice.
                if (this.presentJumpSpeed <= 0.0085){
                    this.jumping=false;
                }
            }
        } else if (!this.lunaBounce) {
            // So, just walking...interpolate to target. Slower if in water (<=-12).
            if (position.y <= -12) 
                position.y += (this.targetY - position.y) * 0.01;
            else
                position.y += (this.targetY - position.y) * 0.1;
        }

        // Prevent falling below present surface.
        if (position.y < this.targetY) {
            //this.jumpTime=Date.now();
            if (this.lunaBounce){
                this.jumping=true;
                this.presentJumpSpeed=0.1;
            }
            position.y = terrainY + this.data.height;
        }
    }
});