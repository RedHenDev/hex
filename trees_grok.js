// trees_grok.js - Manages instanced tree rendering with hexagonal aesthetic

AFRAME.registerComponent('tree-manager', {
    schema: {
        maxTrees: { type: 'number', default: 128 },
        radius: { type: 'number', default: 1200 },
        noiseThreshold: { type: 'number', default: 0.2 },
        noiseScale: { type: 'number', default: 1.0 },
        treeHeight: { type: 'number', default: 64 },
        treeScale: { type: 'number', default: 8 }
    },

    init: function() {
        console.log("Tree manager initializing with instanced rendering...");
        this.trees = [];
        this.activeTreeCount = 0;
        this.lastSampledPosition = { x: 0, z: 0 };
        this.needsResampling = true;
        this.terrainGenerator = null;

        // Create instanced mesh
        this.treeMesh = window.TreeBuilder.createTreeMesh({}, this.data.maxTrees);
        this.treeEntity = document.createElement('a-entity');
        this.treeEntity.setObject3D('mesh', this.treeMesh);
        this.el.sceneEl.appendChild(this.treeEntity);

        // Initialize tree data
        for (let i = 0; i < this.data.maxTrees; i++) {
            this.trees.push({
                position: { x: 0, y: -999, z: 0 },
                scale: 1.0,
                color: [0.55, 0.27, 0.07], // Brown trunk
                rotation: 0,
                active: false
            });
        }

        // Setup terrain access
        this.setupTerrainAccess();
        document.addEventListener('terrainReady', () => {
            this.setupTerrainAccess();
        });

        // Initialize Perlin noise
        this.noise = {
            seed: 99,
            lerp: function(a, b, t) { return a + t * (b - a); },
            grad: function(hash, x, y) {
                const h = hash & 15;
                const grad_x = 1 + (h & 7);
                const grad_y = grad_x & 1 ? 1 : -1;
                return grad_x * x + grad_y * y;
            },
            fade: function(t) { return t * t * t * (t * (t * 6 - 15) + 10); },
            p: new Array(512)
        };

        const permutation = [];
        for (let i = 0; i < 256; i++) permutation[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor((i + 1) * Math.random());
            [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
        }
        for (let i = 0; i < 512; i++) {
            this.noise.p[i] = permutation[i & 255];
        }

        this.debugTimestamp = 0;
    },

    perlin2D: function(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = this.noise.fade(x);
        const v = this.noise.fade(y);
        const A = this.noise.p[X] + Y;
        const B = this.noise.p[X + 1] + Y;
        return this.noise.lerp(
            this.noise.lerp(
                this.noise.grad(this.noise.p[A], x, y),
                this.noise.grad(this.noise.p[B], x - 1, y),
                u
            ),
            this.noise.lerp(
                this.noise.grad(this.noise.p[A + 1], x, y - 1),
                this.noise.grad(this.noise.p[B + 1], x - 1, y - 1),
                u
            ),
            v
        ) * 0.5 + 0.5;
    },

    setupTerrainAccess: function() {
        try {
            const scene = document.querySelector('a-scene');
            if (!scene) return;

            if (scene.hasAttribute('terrain-manager')) {
                const terrainManager = scene.components['terrain-manager'];
                if (terrainManager && terrainManager.chunkManager && terrainManager.chunkManager.terrainGenerator) {
                    this.terrainGenerator = terrainManager.chunkManager.terrainGenerator;
                    console.log('Tree manager: Successfully obtained terrain generator');
                    this.needsResampling = true;
                }
            }
        } catch (err) {
            console.error('Tree manager: Error setting up terrain access:', err);
        }
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

    getGridPosition: function(x, z) {
        const gridStep = window.TerrainConfig ? window.TerrainConfig.geometrySize : 4.4;
        return {
            x: Math.round(x / gridStep) * gridStep,
            z: Math.round(z / gridStep) * gridStep
        };
    },

    checkNeedsResampling: function(subjectPos) {
        const dx = subjectPos.x - this.lastSampledPosition.x;
        const dz = subjectPos.z - this.lastSampledPosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        return distance > (this.data.radius * 0.01); // Lowered threshold for more frequent resampling
    },

    tick: function() {
        const subject = document.querySelector('#subject');
        if (!subject || !this.terrainGenerator) return;

        const subjectPos = subject.object3D.position;
        const halfRadius = this.data.radius * 0.5;

        // Update material uniforms
        window.updateTreeMaterials();

        // Log status every 5 seconds
        const now = Date.now();
        if (now - this.debugTimestamp > 5000) {
            console.log(`Tree manager: ${this.activeTreeCount} active trees, position: ${JSON.stringify({x: subjectPos.x.toFixed(0), z: subjectPos.z.toFixed(0)})}`);
            this.debugTimestamp = now;
        }

        // Check if we need to resample tree positions
        if (this.needsResampling || this.checkNeedsResampling(subjectPos)) {
            console.log("Tree manager: Resampling trees with Perlin noise");
            this.sampleTreePositions(subjectPos);
            this.lastSampledPosition = { x: subjectPos.x, z: subjectPos.z };
            this.needsResampling = false;

            // Update instanced mesh
            window.TreeBuilder.updateTrees(this.treeMesh, this.trees, this.activeTreeCount);
        }

        // Deactivate distant trees
        let activeCount = this.activeTreeCount;
        for (let i = 0; i < this.activeTreeCount; i++) {
            const tree = this.trees[i];
            if (tree.active) {
                const dx = tree.position.x - subjectPos.x;
                const dz = tree.position.z - subjectPos.z;
                const distanceSq = dx * dx + dz * dz;

                if (distanceSq > halfRadius * halfRadius) {
                    tree.position.y = -999;
                    tree.active = false;
                    activeCount--;
                    this.trees[i] = this.trees[activeCount];
                    this.trees[activeCount] = tree;
                }
            }
        }
        if (activeCount !== this.activeTreeCount) {
            this.activeTreeCount = activeCount;
            window.TreeBuilder.updateTrees(this.treeMesh, this.trees, this.activeTreeCount);
        }
    },

    sampleTreePositions: function(subjectPos) {
        this.activeTreeCount = 0;
        for (let i = 0; i < this.data.maxTrees; i++) {
            this.trees[i].active = false;
            this.trees[i].position.y = -999;
        }

        const gridStep = window.TerrainConfig ? window.TerrainConfig.geometrySize : 4.4;
        const radius = this.data.radius;
        const noiseScale = this.data.noiseScale;
        const maxTrees = this.data.maxTrees;

        const positions = [];
        const minX = Math.floor((subjectPos.x - radius) / gridStep) * gridStep;
        const maxX = Math.floor((subjectPos.x + radius) / gridStep) * gridStep;
        const minZ = Math.floor((subjectPos.z - radius) / gridStep) * gridStep;
        const maxZ = Math.floor((subjectPos.z + radius) / gridStep) * gridStep;

        for (let x = minX; x <= maxX; x += gridStep) {
            for (let z = minZ; z <= maxZ; z += gridStep) {
                const dx = x - subjectPos.x;
                const dz = z - subjectPos.z;
                const distSq = dx * dx + dz * dz;

                if (distSq <= radius * radius) {
                    const noiseValue = this.perlin2D(x * noiseScale, z * noiseScale);
                    if (noiseValue < this.data.noiseThreshold) {
                        positions.push({ x, z, noise: noiseValue });
                    }
                }
            }
        }

        positions.sort((a, b) => a.noise - b.noise);
        const selectedPositions = positions.slice(0, maxTrees);

        for (const pos of selectedPositions) {
            if (this.activeTreeCount >= maxTrees) break;

            const tree = this.trees[this.activeTreeCount];
            const terrainHeight = this.getTerrainHeight(pos.x, pos.z);
            const randomScale = this.data.treeScale * (0.8 + Math.random() * 0.4);
            const randomRotation = Math.random() * 2 * Math.PI;

            tree.position = {
                x: pos.x,
                y: terrainHeight + (this.data.treeHeight * 0.1),
                z: pos.z
            };
            tree.scale = randomScale / 8; // Normalize to geometry scale
            tree.color = terrainHeight > 6 ? [0.18, 0.55, 0.34] : [0.55, 0.27, 0.07]; // Green foliage, brown trunk
            tree.rotation = randomRotation;
            tree.active = true;

            console.log(`Placed tree at: x=${pos.x}, y=${terrainHeight + (this.data.treeHeight * 0.1)}, z=${pos.z}`);

            this.activeTreeCount++;
        }

        console.log(`Tree manager: Placed ${this.activeTreeCount} trees out of ${positions.length} candidate positions`);
    }
});