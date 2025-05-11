AFRAME.registerComponent('npc-walk', {
    schema: {
        speed: { type: 'number', default: 2 },
        wanderRadius: { type: 'number', default: 100 },
        heightOffset: { type: 'number', default: 2 }
    },

    init: function() {
        // For height.
        this.terrainGenerator = null;
        this.originalPos = this.el.object3D.position.clone();
        this.targetPos = new THREE.Vector3();
        this.setNewTarget();

        // Listen for terrain ready event.
        document.addEventListener('terrainReady', () => {
            console.log('NPC walk: Terrain ready event received');
            this.setupTerrainAccess();
        });

        // Animation states
        this.currentAnim = 'Walk';
        this.animationTime = 0;
        this.walkDuration = 8000; // 8 seconds of walking
        this.idleDuration = 4000; // 4 seconds of idle
        this.animationsLoaded = false;
        
        if (this.el.id === 'jojo') {
            // Wait for model to load before setting up animations
            this.el.addEventListener('model-loaded', () => {
                const mesh = this.el.getObject3D('mesh');
                if (mesh) {
                    console.log('Available animations:', mesh.animations.map(a => a.name));
                    this.animationsLoaded = true;
                    
                    // Initialize with walk animation after a short delay
                    setTimeout(() => {
                        try {
                            this.el.setAttribute('animation-mixer', {
                                clip: 'Walk',
                                loop: 'repeat',
                                crossFadeDuration: 0.3
                            });
                            console.log('Initial walk animation set');
                        } catch (error) {
                            console.error('Failed to set initial animation:', error);
                        }
                    }, 1000);
                }
            });
        } else {
            console.log('not jojo, so no anim on this model.')
        }

        //console.log('npc-walk init correct.');
    },

    setupTerrainAccess: function() {
        console.log('npc-walk: Setting up terrain access');
        const scene = document.querySelector('a-scene');
        if (scene && scene.components['terrain-manager']) {
            const terrainManager = scene.components['terrain-manager'];
            if (terrainManager.chunkManager && terrainManager.chunkManager.terrainGenerator) {
                this.terrainGenerator = terrainManager.chunkManager.terrainGenerator;
                console.log('npc-walk: Successfully accessed terrain generator');
            } else {
                console.warn('npc-walk: Terrain generator not ready');
            }
        } else {
            console.warn('npc-walk: No terrain manager found');
        }
    },

    setNewTarget: function() {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.data.wanderRadius;
        this.targetPos.x = this.originalPos.x + Math.cos(angle) * radius;
        this.targetPos.z = this.originalPos.z + Math.sin(angle) * radius;
    },

    switchAnimation: function() {
        if (!this.el.id === 'jojo' || !this.animationsLoaded) return;
        
        try {
            const newAnim = this.currentAnim === 'Walk' ? 'Idle' : 'Walk';
            //console.log('Switching animation to:', newAnim);
            
            this.el.setAttribute('animation-mixer', {
                clip: newAnim,
                loop: 'repeat',
                crossFadeDuration: 0.3
            });
            this.currentAnim = newAnim;
            this.animationTime = 0;
        } catch (error) {
            console.error('Failed to switch animation:', error);
        }
    },

    tick: function(time, deltaTime) {
        // Convert deltaTime to seconds
        const dt = deltaTime * 0.001;
        const currentPos = this.el.object3D.position;
        const direction = new THREE.Vector3();
        
        // Calculate direction to target.
        direction.subVectors(this.targetPos, currentPos);
        direction.y = 0; // Keep y movement separate.

        // Check if we need a new target.
        if (direction.length() < 0.5) {
            this.setNewTarget();
            return;
        }

        // Normalize and apply speed.
        direction.normalize();
        direction.multiplyScalar(this.data.speed * dt);

        // Lerp position for smooth movement.
        const targetX = currentPos.x + direction.x;
        const targetZ = currentPos.z + direction.z;
        const lerpAlpha = 0.33; // 0.15 Smoothing factor (0 = no move, 1 = instant)
        currentPos.x += (targetX - currentPos.x) * lerpAlpha;
        currentPos.z += (targetZ - currentPos.z) * lerpAlpha;

        // Get terrain height.
        if (this.terrainGenerator !== null){
            const rawHeight = this.terrainGenerator.generateTerrainHeight(currentPos.x, currentPos.z);
            const adjustedHeight = rawHeight + (window.TerrainConfig.geometryHeight * 0.5);
            currentPos.y = adjustedHeight + this.data.heightOffset;       
        }
        /*
        
        const terrainSystem = document.querySelector('a-scene').systems['terrain-manager'];
        if (terrainSystem) {
            const height = terrainSystem.getHeightAt(currentPos.x, currentPos.z);
            if (height !== null) {
                currentPos.y = height + this.data.heightOffset;
            } else {
                console.log('npc height no dice.');
            }
        }
        */

        // Optional: Make entity face movement direction with lerp.
        if (direction.length() > 0) {
            const targetRotY = Math.PI + Math.atan2(-direction.x, -direction.z);
            const currentRotY = this.el.object3D.rotation.y;
            // Lerp rotation
            const rotLerpAlpha = 0.33;
            let deltaRot = targetRotY - currentRotY;
            // Keep in -PI to PI range
            deltaRot = ((deltaRot + Math.PI) % (2 * Math.PI)) - Math.PI;
            this.el.object3D.rotation.y += deltaRot * rotLerpAlpha;
        }

        // Handle animation switching for jojo.
        if (this.el.id === 'jojo') {
            this.animationTime += deltaTime;
            const duration = this.currentAnim === 'walk' ? this.walkDuration : this.idleDuration;
            
            if (this.animationTime >= duration) {
                this.switchAnimation();
            }
        }
    }
});
