AFRAME.registerComponent('tree-manager', {
    schema: {
        gridStep: { type: 'number', default: 4.4 }, // Match terrain geometry size
        poolSize: { type: 'number', default: 512 },
        maxActive: { type: 'number', default: 128 },
        placementRadius: { type: 'number', default: 200 },
        movementThreshold: { type: 'number', default: 100 },
        noiseScale: { type: 'number', default: 0.02 },
        noiseThreshold: { type: 'number', default: 0.6 }
    },

    init: function() {
        // Apply TerrainConfig if available
        if (window.TerrainConfig && window.TerrainConfig.trees) {
            Object.assign(this.data, window.TerrainConfig.trees);
            this.data.gridStep = window.TerrainConfig.geometrySize;
        }

        this.pool = [];
        this.lastPlacementPos = null;
        this.createTreePool();
        this.subject = document.querySelector('#subject');
        this.terrainGenerator = null;

        // Wait for terrain system to be ready
        document.addEventListener('terrainReady', () => {
            this.setupTerrainAccess();
            console.log("Tree manager: Terrain system ready, starting tree placement");
        });
    },

    setupTerrainAccess: function() {
        const scene = document.querySelector('a-scene');
        if (!scene || !scene.hasAttribute('terrain-manager')) return;
        
        const terrainManager = scene.components['terrain-manager'];
        if (terrainManager && terrainManager.chunkManager) {
            this.terrainGenerator = terrainManager.chunkManager.terrainGenerator;
        }
    },

    createTreePool: function() {
        for (let i = 0; i < this.data.poolSize; i++) {
            let tree = document.createElement('a-entity');
            
            const trunk = document.createElement('a-cylinder');
            trunk.setAttribute('height', '6');
            trunk.setAttribute('radius', '0.8');
            trunk.setAttribute('material', { color: '#8B4513', roughness: 0.8 });
            trunk.setAttribute('position', { x: 0, y: 3, z: 0 });
            
            const foliage = document.createElement('a-cone');
            foliage.setAttribute('height', '18');
            foliage.setAttribute('radius-bottom', '8');
            foliage.setAttribute('radius-top', '0');
            foliage.setAttribute('material', { color: '#2E8B57', emissive: '#003300', emissiveIntensity: 0.2 });
            foliage.setAttribute('position', { x: 0, y: 15, z: 0 });
            
            tree.appendChild(trunk);
            tree.appendChild(foliage);
            
            tree.setAttribute('scale', '4 4 4');
            tree.setAttribute('visible', false);
            tree.setAttribute('position', { x: 0, y: -999, z: 0 });
            this.el.sceneEl.appendChild(tree);
            this.pool.push({ entity: tree, active: false });
        }
    },

    tick: function() {
        if (!this.subject) return;
        
        const currentPos = this.subject.object3D.position;
        
        if (!this.lastPlacementPos || 
            this.getDistance2D(currentPos, this.lastPlacementPos) > this.data.movementThreshold) {
            this.placeTreesAroundPosition(currentPos);
            this.lastPlacementPos = {x: currentPos.x, z: currentPos.z};
        }

        this.deactivateDistantTrees(currentPos);
    },

    placeTreesAroundPosition: function(center) {
        if (this.getActiveTreeCount() > this.data.maxActive) {
            this.deactivateAllTrees();
        }

        const radius = this.data.placementRadius;
        const step = this.data.gridStep;

        const startX = Math.floor((center.x - radius) / step) * step;
        const startZ = Math.floor((center.z - radius) / step) * step;
        const endX = Math.ceil((center.x + radius) / step) * step;
        const endZ = Math.ceil((center.z + radius) / step) * step;

        for (let x = startX; x <= endX; x += step) {
            for (let z = startZ; z <= endZ; z += step) {
                const dx = x - center.x;
                const dz = z - center.z;
                const distSq = dx * dx + dz * dz;

                if (distSq <= radius * radius) {
                    const noise = this.getNoise(x, z);
                    if (noise > this.data.noiseThreshold) {
                        this.placeTile({x: x, z: z});
                    }
                }
            }
        }
    },

    deactivateDistantTrees: function(center) {
        const thresholdSq = this.data.placementRadius * this.data.placementRadius;
        this.pool.forEach(tree => {
            if (tree.active) {
                const pos = tree.entity.object3D.position;
                const distSq = this.getDistance2DSq(center, pos);
                if (distSq > thresholdSq) {
                    this.deactivateTree(tree);
                }
            }
        });
    },

    getDistance2D: function(pos1, pos2) {
        return Math.sqrt(this.getDistance2DSq(pos1, pos2));
    },

    getDistance2DSq: function(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dz = pos1.z - pos2.z;
        return dx * dx + dz * dz;
    },

    getActiveTreeCount: function() {
        return this.pool.filter(t => t.active).length;
    },

    deactivateAllTrees: function() {
        this.pool.forEach(this.deactivateTree.bind(this));
    },

    deactivateTree: function(tree) {
        tree.active = false;
        tree.entity.setAttribute('visible', false);
        tree.entity.setAttribute('position', {x: 0, y: -999, z: 0});
    },

    placeTile: function(candidate) {
        let treeObj = this.pool.find(t => !t.active);
        if (!treeObj) {
            const farthestTree = this.pool.reduce((prev, curr) => {
                if (!curr.active) return prev;
                const prevDist = this.getDistance2DSq(prev.entity.object3D.position, candidate);
                const currDist = this.getDistance2DSq(curr.entity.object3D.position, candidate);
                return currDist > prevDist ? curr : prev;
            }, this.pool[0]);

            if (farthestTree && this.getDistance2DSq(farthestTree.entity.object3D.position, candidate) > 800 * 800) {
                treeObj = farthestTree;
            } else {
                return;
            }
        }

        const terrainHeight = this.getTerrainHeight(candidate.x, candidate.z);
        const randomRotation = Math.random() * 360;
        const randomScale = 0.8 + Math.random() * 0.4;
        
        treeObj.entity.setAttribute('position', { 
            x: candidate.x, 
            y: terrainHeight + 2, 
            z: candidate.z 
        });
        treeObj.entity.setAttribute('rotation', { x: 0, y: randomRotation, z: 0 });
        treeObj.entity.setAttribute('scale', {
            x: 4 * randomScale,
            y: 4 * randomScale,
            z: 4 * randomScale
        });
        treeObj.entity.setAttribute('visible', true);
        treeObj.active = true;
    },

    getTerrainHeight: function(x, z) {
        if (this.terrainGenerator) {
            try {
                return this.terrainGenerator.generateTerrainHeight(x, z);
            } catch (err) {
                return 0;
            }
        }
        
        if (typeof window.getTerrainHeight === 'function') {
            return window.getTerrainHeight(x, z);
        }
        
        return 0;
    },

    getNoise: function(x, z) {
        // Use terrain's noise system if available, otherwise fallback to simple noise
        if (window.ImprovedNoise) {
            return (window.ImprovedNoise.perlin2(x * this.data.noiseScale, z * this.data.noiseScale) + 1) * 0.5;
        }
        // Simple fallback noise
        return Math.abs(Math.sin(x * this.data.noiseScale) * Math.sin(z * this.data.noiseScale));
    }
});