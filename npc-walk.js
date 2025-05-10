AFRAME.registerComponent('npc-walk', {
    schema: {
        speed: { type: 'number', default: 2 },
        wanderRadius: { type: 'number', default: 50 },
        heightOffset: { type: 'number', default: 0 }
    },

    init: function() {
        // For height.
        this.terrainGenerator = null;
        this.originalPos = this.el.object3D.position.clone();
        this.targetPos = new THREE.Vector3();
        this.setNewTarget();

        // Listen for terrain ready event.
        document.addEventListener('terrainReady', () => {
            console.log('Projectile system: Terrain ready event received');
            this.setupTerrainAccess();
        });


        console.log('npc-walk init correct.');
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

    tick: function(time, deltaTime) {
        // Convert deltaTime to seconds
        const dt = deltaTime / 1000;
        const currentPos = this.el.object3D.position;
        const direction = new THREE.Vector3();
        
        // Calculate direction to target
        direction.subVectors(this.targetPos, currentPos);
        direction.y = 0; // Keep y movement separate

        // Check if we need a new target
        if (direction.length() < 0.5) {
            this.setNewTarget();
            return;
        }

        // Normalize and apply speed
        direction.normalize();
        direction.multiplyScalar(this.data.speed * dt);

        // Update position
        currentPos.x += direction.x;
        currentPos.z += direction.z;

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

        // Optional: Make entity face movement direction
        if (direction.length() > 0) {
            this.el.object3D.rotation.y = 170+Math.atan2(-direction.x, -direction.z);
        }
    }
});
