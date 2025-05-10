AFRAME.registerComponent('projectile-system', {
    schema: {
        speed: {type: 'number', default: 99},
        lifetime: {type: 'number', default: 3000},
        bounceEnergy: {type: 'number', default: 0.6}, // Increased from 0.7 to 0.9
        playerImpactForce: {type: 'number', default: 800},
        heightOffset: {type: 'number', default: 8} // Match loco_v3's height offset
    },

    init: function() {
        this.projectiles = [];
        this.terrainGenerator = null;
        this.setupProjectileControls();
        this.setupTerrainAccess();

        // Throttle shooting to prevent spam
        this.lastShot = 0;
        this.shootDelay = 25;

        // Listen for terrain ready event
        document.addEventListener('terrainReady', () => {
            console.log('Projectile system: Terrain ready event received');
            this.setupTerrainAccess();
        });
        
        // Try again after a delay
        setTimeout(() => {
            if (!this.terrainGenerator) {
                console.log('Projectile system: Retrying terrain access');
                this.setupTerrainAccess();
            }
        }, 2000);

        // Verify terrain height system
        setTimeout(() => {
            if (this.terrainGenerator) {
                const testX = 10034;
                const testZ = 8070;
                const rawHeight = this.terrainGenerator.generateTerrainHeight(testX, testZ);
                const adjustedHeight = rawHeight + (window.TerrainConfig.geometryHeight * 0.5);
                console.log('Projectile system terrain check:', {
                    raw: rawHeight,
                    adjusted: adjustedHeight,
                    config: window.TerrainConfig
                });
                // Add global listener for shoot events.
            document.addEventListener('shootProjectile', () => {
            // console.log('Shoot event received in projectile system');
            this.shoot();
        });
            } else {
                console.error('Projectile system: No terrain generator available after init');
            }
        }, 3000);

        
    },

    setupTerrainAccess: function() {
        console.log('Projectile system: Setting up terrain access');
        const scene = document.querySelector('a-scene');
        if (scene && scene.components['terrain-manager']) {
            const terrainManager = scene.components['terrain-manager'];
            if (terrainManager.chunkManager && terrainManager.chunkManager.terrainGenerator) {
                this.terrainGenerator = terrainManager.chunkManager.terrainGenerator;
                console.log('Projectile system: Successfully accessed terrain generator');
            } else {
                console.warn('Projectile system: Terrain generator not ready');
            }
        } else {
            console.warn('Projectile system: No terrain manager found');
        }
    },

    setupProjectileControls: function() {
        const isMobile = AFRAME.utils.device.isMobile();
        const isVR = AFRAME.utils.device.checkHeadsetConnected();
        
        if (isVR) {
            // VR head tilt detection - bind to the camera's parent entity to ensure proper context
            this.lastTiltTime = 0;
            this.tiltThreshold = 0.5;
            this.tiltDelay = 500;
            
            const subject = document.querySelector('#subject');
            if (!subject) {
                console.error('Projectile system: Cannot find subject entity for VR controls');
                return;
            }
            
            // Bind tick function to this component's context
            this.vrTick = this.vrTick.bind(this);
            subject.addEventListener('tick', this.vrTick);
            console.log('VR projectile controls initialized');
            
        } else if (isMobile) {
            // Listen for custom shoot event from free-controls
            document.addEventListener('shootProjectile', () => {
                console.log('Received shoot event from free-controls');
                this.shoot();
            });
        } else {
            // Desktop mouse control remains unchanged
            document.addEventListener('mousedown', (e) => {
                if (e.button === 0) this.shoot();
            });
        }
    },

    // Separate VR tick function for better control
    vrTick: function() {
        const camera = document.querySelector('#cam');
        if (!camera) return;
        
        const rotation = camera.object3D.rotation;
        const now = Date.now();
        
        // Right tilt to shoot (negative Z rotation)
        if (rotation.z < -this.tiltThreshold && now - this.lastTiltTime > this.tiltDelay) {
            this.shoot();
            this.lastTiltTime = now;
            console.log('VR head tilt detected, shooting');
        }
    },

    shoot: function() {
        const now = Date.now();
        if (now - this.lastShot < this.shootDelay) return;
        this.lastShot = now;

        const camera = document.querySelector('#cam').object3D;
        const position = new THREE.Vector3();
        camera.getWorldPosition(position);
        // console.log('Shooting from position:', position);

        const projectile = document.createElement('a-sphere');
        projectile.setAttribute('radius', '0.5');
        projectile.setAttribute('material', 'color: #00FF00; shader: standard; metalness: 0.3; roughness: 0.6');
        projectile.setAttribute('position', position);
        // console.log('Created projectile with initial position:', position);
        
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion);
        direction.multiplyScalar(this.data.speed);
        // console.log('Projectile direction and speed:', direction);

        const projectileData = {
            element: projectile,
            velocity: direction,
            birth: now,
            bounceCount: 0
        };

        this.projectiles.push(projectileData);
        document.querySelector('a-scene').appendChild(projectile);
        // console.log('Added projectile to scene, total projectiles:', this.projectiles.length);
    },

    tick: function(time, delta) {
        if (!delta) return;
        const dt = delta * 0.001;

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            const pos = new THREE.Vector3().copy(proj.element.object3D.position);

            // Log position every second (to avoid console spam)
            // if (time % 1000 < 20) {
            //     console.log(`Projectile ${i} position:`, pos, 'velocity:', proj.velocity);
            // }

            // Apply gravity.
            proj.velocity.y -= 98 * dt;

            // Update position.
            pos.addScaledVector(proj.velocity, dt);
            
            // Check terrain collision.
            if (this.terrainGenerator) {
                const terrainY = this.terrainGenerator.generateTerrainHeight(pos.x, pos.z);
                // Access geometryHeight directly from TerrainConfig
                const targetY = terrainY + TerrainConfig.geometryHeight;

                if (pos.y < targetY) {
                    // console.log(`Bounce at ${pos.y} -> ${targetY}`);
                    if (pos.y < targetY - 2){
                        proj.velocity.x *= -1;
                        proj.velocity.z *= -1;
                    }
                    pos.y = targetY + 0.1;
                    proj.velocity.y = Math.abs(proj.velocity.y) * this.data.bounceEnergy;
                    proj.bounceCount++;
                    // Change direction if likely to
                    // be striking a side of prism.
                    
                } 
            }

            // Check player collisions
            const players = document.querySelectorAll('[subject-locomotion], #players > a-entity');
            players.forEach(playerEl => {
                if (playerEl.id !== 'subject') {
                    const playerPos = playerEl.object3D.position;
                    const dist = pos.distanceTo(playerPos);
                    if (dist < 8) { // Collision radius
                        // Apply force to player
                        const force = proj.velocity.clone().normalize().multiplyScalar(this.data.playerImpactForce);
                        // If it's a remote player, send impact via websocket
                        if (window.socket && playerEl.id.startsWith('player-')) {
                            window.socket.send(JSON.stringify({
                                type: 'impact',
                                targetId: playerEl.id.replace('player-', ''),
                                force: {x: force.x, y: force.y, z: force.z}
                            }));
                        }
                        // If it's the local player, apply force directly
                        if (playerEl.components['subject-locomotion']) {
                            playerEl.components['subject-locomotion'].velocity.add(force);
                        }
                        // Remove projectile after hit
                        this.removeProjectile(i);
                        return;
                    }
                }
            });

            // Update projectile position
            proj.element.setAttribute('position', pos);

            // Max bounces 5.
            if (time - proj.birth > this.data.lifetime || proj.bounceCount > 5) {
                //console.log(`Removing projectile ${i} - Age:`, time - proj.birth, 'Bounces:', proj.bounceCount);
                this.removeProjectile(i);
            }
        }
    },

    removeProjectile: function(index) {
        const proj = this.projectiles[index];
        proj.element.parentNode.removeChild(proj.element);
        this.projectiles.splice(index, 1);
    }
});

// Add the system to the scene
document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    scene.setAttribute('projectile-system', '');
});
