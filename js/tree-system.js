AFRAME.registerComponent('tree-system', {
    schema: {
        poolSize: { type: 'number', default: 1024 },
        activationRadius: { type: 'number', default: 360 },
        noiseThreshold: { type: 'number', default: 0.6 }
    },

    init: function() {
        this.treePool = [];
        this.activeTreePositions = new Map(); // Map<Entity, Vector3>
        this.noise = new SimplexNoise();
        
        // Create tree pool
        for (let i = 0; i < this.data.poolSize; i++) {
            const tree = document.createElement('a-entity');
            tree.setAttribute('geometry', {
                primitive: 'cone',
                radiusBottom: 2,
                radiusTop: 0,
                height: 8
            });
            tree.setAttribute('material', 'color: #2d4c1e');
            tree.object3D.position.y = -999; // Initial inactive position
            tree.setAttribute('visible', false);
            this.el.appendChild(tree);
            this.treePool.push(tree);
        }

        this.playerEl = document.querySelector('[camera]');
        this.tick = AFRAME.utils.throttleTick(this.tick, 100, this);
    },

    tick: function() {
        if (!this.playerEl) return;
        const playerPos = this.playerEl.object3D.position;
        
        // Update tree positions
        this.updateTrees(playerPos);
        
        // Deactivate distant trees
        for (const [tree, pos] of this.activeTreePositions) {
            const dist = new THREE.Vector2(pos.x - playerPos.x, pos.z - playerPos.z).length();
            if (dist > this.data.activationRadius) {
                this.deactivateTree(tree);
            }
        }
    },

    updateTrees: function(playerPos) {
        const checkRadius = this.data.activationRadius;
        const resolution = 10;
        
        for (let x = -checkRadius; x < checkRadius; x += resolution) {
            for (let z = -checkRadius; z < checkRadius; z += resolution) {
                const worldX = playerPos.x + x;
                const worldZ = playerPos.z + z;
                
                // Use same noise function as terrain
                const noiseVal = this.noise.noise2D(worldX * 0.01, worldZ * 0.01);
                
                if (noiseVal > this.data.noiseThreshold) {
                    const pos = new THREE.Vector3(worldX, 0, worldZ);
                    this.placeTree(pos);
                }
            }
        }
    },

    placeTree: function(position) {
        let tree = this.getInactiveTree();
        if (!tree) {
            tree = this.getFarthestTree(position);
        }
        
        if (tree) {
            tree.setAttribute('visible', true);
            tree.object3D.position.copy(position);
            // Adjust Y position based on terrain height
            // You'll need to implement this based on your terrain system
            this.activeTreePositions.set(tree, position);
        }
    },

    getInactiveTree: function() {
        return this.treePool.find(tree => !tree.getAttribute('visible'));
    },

    getFarthestTree: function(position) {
        let farthestDist = 0;
        let farthestTree = null;
        
        for (const [tree, pos] of this.activeTreePositions) {
            const dist = position.distanceTo(pos);
            if (dist > farthestDist) {
                farthestDist = dist;
                farthestTree = tree;
            }
        }
        
        return farthestTree;
    },

    deactivateTree: function(tree) {
        tree.setAttribute('visible', false);
        tree.object3D.position.y = -999;
        this.activeTreePositions.delete(tree);
    }
});
