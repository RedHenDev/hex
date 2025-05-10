// An attempt to implement pulse-thrust.

// Player movement component with terrain following.
AFRAME.registerComponent('subject-locomotion', {
    schema: {
        heightOffset: {type: 'number', default: 5.25}, // Height above ground.
        debug: {type: 'boolean', default: true},       // Enable debug logging
        thrustPower: {type: 'number', default: 41},    // 164 82 Power of thrust
        friction: {type: 'number', default: 0.96},     // 0.96 Air friction (1 = no friction)
        maxGradient: {type: 'number', default: 0.8},   // Maximum slope gradient (0.8 = ~38 degrees)
        sampleDistance: {type: 'number', default: 2.0} // Distance ahead to check slope
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
        this.verticalVelocity = 0;
        this.jumping = true; // means 'jumpReady'.

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
                    // Event shoot test.
                    // console.log('Dispatching shootProjectile event from loco_v3');
                    // const shootEvent = new CustomEvent('shootProjectile');
                    // document.dispatchEvent(shootEvent);
                    // console.log('Event dispatched');
                    // Jump impulse.
                    this.verticalVelocity = this.running ? 64 : 42; // Adjust jump impulse based on running state.
                    this.velocity.y += this.verticalVelocity;
                }
                // If you want to keep flying toggle, use another key or modifier
                // else remove flying toggle here
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyG') {
                // Toggle hex outline on G key
                //window.toggleHexOutline(!window.HexConfigSimple.enableOutline);
                this.flying = !this.flying;
                window.toggleHexOutline(!this.flying);
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

    calculateGradient: function(position, velocity) {
        if (!velocity.length()) return 0;
        
        // Get normalized direction
        const direction = velocity.clone().normalize();
        
        // Sample points
        const currentHeight = this.getTerrainHeight(position.x, position.z);
        const aheadPos = {
            x: position.x + direction.x * this.data.sampleDistance,
            z: position.z + direction.z * this.data.sampleDistance
        };
        const aheadHeight = this.getTerrainHeight(aheadPos.x, aheadPos.z);
        
        // Calculate gradient
        return (aheadHeight - currentHeight) / this.data.sampleDistance;
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
                const shootEvent = new CustomEvent('shootProjectile');
                document.dispatchEvent(shootEvent);
                //this.flying = !this.flying;
                //window.toggleHexPulse(this.flying);
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
            
            // Running now controls thrust power.
            this.running = this.keys.ShiftLeft;
        }
        
        // Calculate thrust power
        const thrustMultiplier = this.running ? 5 : 1;
        
        // Apply thrust in camera direction.
        if (this.moveX !== 0 || this.moveZ !== 0) {
            const angle = rotation.y;
            const thrust = this.data.thrustPower * thrustMultiplier;
            
            // Add thrust to current velocity.
            this.velocity.x += (-this.moveZ * Math.sin(angle) + this.moveX * Math.cos(angle)) * thrust * delta;
            this.velocity.z += (-this.moveZ * Math.cos(angle) - this.moveX * Math.sin(angle)) * thrust * delta;
        }
        
        // Apply vertical thrust based on pitch.
        if (this.flying)
            this.velocity.y += pitch * 1.8 * this.moveZ * this.data.thrustPower * thrustMultiplier * delta;
        // Experimental hack. Removing positive y thrust, to simulate
        // a rough lunar buggy.
        // So, gravity.
        if (!this.flying)
            this.velocity.y -= 100 * delta;

        // After calculating new velocity but before applying it, check gradient
        if (!this.flying && this.velocity.length() > 0) {
            const gradient = this.calculateGradient(position, this.velocity);
            
            if (gradient > this.data.maxGradient) {
                // Scale down velocity based on how much we exceed the max gradient
                const reduction = 1.0 - ((gradient - this.data.maxGradient) / this.data.maxGradient);
                this.velocity.multiplyScalar(Math.max(0, reduction));
                //if (this.data.debug) console.log('Gradient limiting:', gradient.toFixed(2));
            }
        }

        // Apply friction.
        this.velocity.multiplyScalar(this.data.friction);
        
        // Update position with vertical movement
        position.x += this.velocity.x * delta;
        position.y += this.velocity.y * delta;
        position.z += this.velocity.z * delta;

        // Get terrain height and enforce minimum height.
        const terrainY = this.getTerrainHeight(position.x, position.z);
        this.targetY = (window.TerrainConfig.geometryHeight*0.5) + terrainY + this.data.heightOffset;
        // Prevent going below terrain height.
        if (position.y < terrainY + this.data.heightOffset * 4) {
            position.y = terrainY + this.data.heightOffset * 4;
            // We've hit the ground, so can
            // jump again.
            // Must be false to allow new jump.
            this.jumping = false;
            // Stop downward momentum when hitting terrain.
            if (this.velocity.x === 0 &&
                this.velocity.z === 0) {
                    // Land deftly if no other
                    // velocity, no movement.
                    this.velocity.y = 0;
                }
            else {
                // Bounce up if moving.
                //this.velocity.y = Math.abs(this.velocity.length()*0.8);
                this.velocity.y = Math.abs(this.velocity.y*0.28);
            }
            
            } else if (this.flying) {
            // I.e. if above terrain.
            // Drift to ground if slow enough.
            if (this.velocity.length() < 1.0) {
                // this.velocity.set(0, -32.0, 0);
                // -1.1
                this.velocity.y = -2.0;
            }
        }

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
                                    tree.worldPos.z) + (8 * 64) * tree.scaleFactor) {
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
    }
});