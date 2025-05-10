// Player movement component with terrain following.
AFRAME.registerComponent('subject-locomotion', {
    schema: {
        heightOffset: {type: 'number', default: 5.25}, // Height above ground.
        debug: {type: 'boolean', default: true}       // Enable debug logging
    },

    init: function() {
        // Initialize basic properties
        this.velocity = new THREE.Vector3();
        this.targetY = 0;
        this.terrainHeight = 0;
        
        // Store reference to terrain generator when available
        this.terrainGenerator = null;
        
        if (this.data.debug) console.log('Locomotion: Component initializing');

        // For updating hud location data message
        if (document.querySelector("#hud"))
            this.h = document.querySelector("#hud");

        this.cam = document.querySelector("#cam").object3D;
        this.rig = document.querySelector("#subject").object3D;
        this.timeStamp = Date.now();
        this.moveZ = 0;
        this.moveX = 0;

        // Added this.moving to allow mobile
        // and VR users to experience same
        // colission mechanic as desktop users.
        // Colission with a tree switches
        // off this.moveZ rather than this.moving.
        // For, this.moving is the mode/state of
        // locomotion toggled.
        this.moving = false;
        this.running = false;
        this.flying = false;
        this.jumping = false;
        this.verticalVelocity = 0;

        // Setup direct access to terrain generator
        this.setupTerrainAccess();
        
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
            g: false,
            ShiftLeft: false
        };
        
        document.addEventListener('keydown', (e) => this.keys[e.key] = true);
        document.addEventListener('keyup', (e) => this.keys[e.key] = false);
        
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

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (!this.flying && !this.jumping) {
                    this.jumping = true;
                    // Jump impulse.
                    this.verticalVelocity = this.running ? 64 : 42; // Adjust jump impulse based on running state.
                }
                // If you want to keep flying toggle, use another key or modifier
                // else remove flying toggle here
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyG') {
                //this.flying = !this.flying;
                window.toggleHexPulse(true);
            }
        });
        
        // Listen for terrain ready event to try again to get terrain generator
        document.addEventListener('terrainReady', () => {
            if (this.data.debug) console.log('Locomotion: Terrain ready event received');
            this.setupTerrainAccess();
        });
        
        // Also try a bit later after everything has loaded.
        setTimeout(() => {
            if (!this.terrainGenerator) {
                if (this.data.debug) console.log('Locomotion: Trying terrain access again after timeout');
                this.setupTerrainAccess();
            }
        }, 2000);
        
        if (this.data.debug) console.log('Locomotion: Component initialized');
    },

    setupTerrainAccess: function() {
        if (this.data.debug) console.log('Locomotion: Setting up terrain access');
        
        try {
            // Get the scene element
            const scene = document.querySelector('a-scene');
            if (!scene) {
                if (this.data.debug) console.log('Locomotion: Scene not found yet');
                return;
            }
            
            // IMPORTANT FIX: Check if terrain-manager is on the scene itself.
            if (scene.hasAttribute('terrain-manager')) {
                
                if (this.data.debug) console.log('Locomotion: Found terrain-manager on scene element');
                
                const terrainManager = scene.components['terrain-manager'];
                if (!terrainManager) {
                    if (this.data.debug) console.log('Locomotion: Terrain manager component not found on scene');
                    return;
                }
                
                if (!terrainManager.chunkManager) {
                    if (this.data.debug) console.log('Locomotion: Chunk manager not found on scene');
                    return;
                }
                
                if (!terrainManager.chunkManager.terrainGenerator) {
                    if (this.data.debug) console.log('Locomotion: Terrain generator not found on scene');
                    return;
                }
                
                
                // Store direct reference.
                this.terrainGenerator = terrainManager.chunkManager.terrainGenerator;
                if (this.data.debug) console.log('Locomotion: Successfully obtained terrain generator from scene!');
                
                // Test the generator.
                try {
                    const testHeight = this.terrainGenerator.generateTerrainHeight(0, 0);
                    if (this.data.debug) console.log('Locomotion: Test terrain height at origin:', testHeight);
                } catch (err) {
                    console.error('Locomotion: Error testing terrain generator:', err);
                }
                
                return;
            }
            
            // Fallback: look for a child element with terrain-manager (the old way)
            const terrainManagerEl = scene.querySelector('[terrain-manager]');
            if (!terrainManagerEl) {
                if (this.data.debug) console.log('Locomotion: Terrain manager element not found as child');
                return;
            }
            
            const terrainManager = terrainManagerEl.components['terrain-manager'];
            if (!terrainManager) {
                if (this.data.debug) console.log('Locomotion: Terrain manager component not found');
                return;
            }
            
            if (!terrainManager.chunkManager) {
                if (this.data.debug) console.log('Locomotion: Chunk manager not found');
                return;
            }
            
            if (!terrainManager.chunkManager.terrainGenerator) {
                if (this.data.debug) console.log('Locomotion: Terrain generator not found');
                return;
            }
            
            // Store direct reference
            this.terrainGenerator = terrainManager.chunkManager.terrainGenerator;
            if (this.data.debug) console.log('Locomotion: Successfully obtained terrain generator!');
            
            // Test the generator
            try {
                const testHeight = this.terrainGenerator.generateTerrainHeight(0, 0);
                if (this.data.debug) console.log('Locomotion: Test terrain height at origin:', testHeight);
            } catch (err) {
                console.error('Locomotion: Error testing terrain generator:', err);
            }
        } catch (err) {
            console.error('Locomotion: Error setting up terrain access:', err);
        }
    },
    
    getTerrainHeight: function(x, z) {
        // Method 1: Use direct reference to generator (fastest).
        if (this.terrainGenerator) {
            try {
                return this.terrainGenerator.generateTerrainHeight(x, z);
            } catch (err) {
                if (this.data.debug) console.warn('Locomotion: Error using direct terrain generator:', err);
                // Fall through to other methods. Nope. Deleted :)
            }
        }
    },

    tick: function(time, delta) {
        if (!delta) return;
        delta = delta * 0.001; // Convert to seconds
        
        const position = this.rig.position;
        const rotation = this.cam.rotation;
        
        // Process VR head rotation controls.
        const pitch = rotation.x;
        const roll = rotation.z;
        
        // Left head tilt.
        const minZ = 0.3;
        const maxZ = 0.5;
        if (roll > minZ && roll < maxZ) {
            let cTime = Date.now();
            if (cTime - this.timeStamp > 2000) {
                this.timeStamp = Date.now();
                this.moving = !this.moving;
                //this.moveZ = this.moveZ === 1 ? 0 : 1;
                //if (this.data.debug) console.log('Locomotion: Head tilt left - moveZ:', this.moveZ);
            }
        }
        // Switch on forward movement.
        // NB this.moveZ can be switched off
        // by collision with a tree.
        // While, this.moving is state
        // remains on.
        // I.e. we don't want collisions with
        // trees to toggle off locomotive intent.
        this.moveZ = this.moving ? 1 : 0;
        
        // Right head tilt
        const RminZ = -0.3;
        const RmaxZ = -0.5;
        if (roll < RminZ && roll > RmaxZ) {
            let cTime = Date.now();
            if (cTime - this.timeStamp > 2000) {
                this.timeStamp = Date.now();
                this.flying = !this.flying;
                window.toggleHexPulse(this.flying);
                //this.running = !this.running;
                //if (this.data.debug) console.log('Locomotion: Head tilt right - flying:', this.flying);
            }
        }
        
        // Process keyboard controls
        if (!AFRAME.utils.device.isMobile()) {
            this.moveX = (this.keys.a || this.keys.ArrowLeft ? -1 : 0) + 
                         (this.keys.d || this.keys.ArrowRight ? 1 : 0);
            this.moveZ = (this.keys.w || this.keys.ArrowUp ? 1 : 0) + 
                         (this.keys.s || this.keys.ArrowDown ? -1 : 0);
            
            // Running toggle via shift.
            let sTime = Date.now();
            if (sTime - this.timeStamp > 500) {
                if (this.keys.ShiftLeft) {
                    this.running = !this.running;
                    //window.toggleHexPulse(this.running);
                    this.timeStamp = Date.now();
                    if (this.data.debug) console.log('Locomotion: Running:', this.running);
                }
            }
        }
        
        // Calculate movement speed.
        const run_speed = this.running ? 5 : 1;
        //const fly_speed = (this.flying && !this.running) ? 15 : 1;
        const fly_speed = (this.flying && this.running ? 1 : 1);

        // New: Collision detection using a Map of tree positions.
        // Placed before locomotive control logic, so that
        // trees feel solid.
        const baseCollisionRadius = 40; // 40 Base collision radius value. 38.
        const cellSize = baseCollisionRadius * 2;
        const subjectCellX = Math.floor(position.x / cellSize);
        const subjectCellZ = Math.floor(position.z / cellSize);
        const treeManagerEl = document.querySelector('[tree-hex-manager]');
        if (treeManagerEl && treeManagerEl.components && treeManagerEl.components['tree-hex-manager']) {
            const treeManager = treeManagerEl.components['tree-hex-manager'];
            const collisionMap = new Map();
            // Build collision map from active trees.
            for (let tree of treeManager.pool) {
                if (!tree.active) continue;
                const cellX = Math.floor(tree.worldPos.x / cellSize);
                const cellZ = Math.floor(tree.worldPos.z / cellSize);
                const key = `${cellX},${cellZ}`;
                if (!collisionMap.has(key)) {
                    collisionMap.set(key, []);
                }
                collisionMap.get(key).push(tree);
            }
            
            // Check subject's cell and neighboring cells.
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const key = `${subjectCellX + dx},${subjectCellZ + dz}`;
                    if (!collisionMap.has(key)) continue;
                    for (let tree of collisionMap.get(key)) {
                        const diffX = position.x - tree.worldPos.x;
                        const diffZ = position.z - tree.worldPos.z;
                        const d = Math.sqrt(diffX * diffX + diffZ * diffZ);
                        // Effective collision radius depends on the tree's scale factor.
                        const effectiveCollisionRadius = baseCollisionRadius * (tree.scaleFactor || 1);
                        // Also check we are not over tree (height is 4 * 64 * tree.scaleFactor)
                        // Note that we have calculated the height of tree to 232 by trial and error.
                        if (d < effectiveCollisionRadius && position.y < 
                                this.getTerrainHeight(tree.worldPos.x, 
                                    tree.worldPos.z) + 232 * tree.scaleFactor) {
                            // Compute overlap and rebound the subject.
                            const overlap = effectiveCollisionRadius - d;
                            const normX = diffX / (d || 1);
                            const normZ = diffZ / (d || 1);
                            // Turn off movement.
                            this.moveX = 0;
                            this.moveZ = 0;
                            this.velocity.x = 0;
                            this.velocity.z = 0;
                            // Rebound by adding to velocity.
                            this.velocity.x += normX * overlap * 100;
                            this.velocity.z += normZ * overlap * 100;
                            position.z += normZ * overlap * 2;
                            position.x += normX * overlap * 2;
                            
                            if (this.data.debug) {
                                console.log('Collision: Rebounding subject from tree at', tree.worldPos, 
                                            'Effective Radius:', effectiveCollisionRadius.toFixed(2));
                            }
                        }
                    }
                }
            }
        }

        // Apply movement in camera direction.
        if (this.moveX !== 0 || this.moveZ !== 0) {
            const angle = rotation.y;
            const speed = 15 * run_speed * fly_speed;
            
            this.velocity.x = (-this.moveZ * Math.sin(angle) + this.moveX * Math.cos(angle)) * speed;
            this.velocity.z = (-this.moveZ * Math.cos(angle) - this.moveX * Math.sin(angle)) * speed;
        } else {
            this.velocity.x *= 0.9;
            this.velocity.z *= 0.9;
        }
        
        // Update position.
        position.x += this.velocity.x * delta;
        position.z += this.velocity.z * delta;
        
        // Floor values to aim for centre of voxel.
        const px = position.x;//Math.floor(position.x);
        const pz = position.z;//Math.floor(position.z);
        const terrainY = this.getTerrainHeight(px, pz);
        //this.terrainHeight = terrainY; // Store for debugging
        
        this.targetY = (window.TerrainConfig.geometryHeight*0.5) 
        + terrainY + (this.data.heightOffset);
        
        // Handle flying mode.
        if (this.flying) {
            position.y += pitch * this.moveZ * fly_speed;
        }
        
        // Handle jumping and gravity.
        if (!this.flying) {
            if (this.jumping) {
                this.verticalVelocity -= 80 * delta; // Gravity, default 40.
                position.y += this.verticalVelocity * delta;
                if (position.y <= this.targetY + (this.data.heightOffset*2)) {
                    position.y = this.targetY + (this.data.heightOffset*2);
                    this.jumping = false;
                    this.verticalVelocity = 0;
                }
            }
        } else {
            // Flying mode: (keep your flying logic here)
            // position.y += pitch * this.moveZ * fly_speed;
        }

        // Prevent falling below terrain.
        if (position.y < this.targetY) {
            position.y = this.targetY + (this.data.heightOffset*2);
        } else if (!this.flying && !this.jumping){
            position.y = this.targetY + (this.data.heightOffset*2);
        }
    }
});