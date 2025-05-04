// Global configuration for floating hex formations
window.FloatingFormationsConfig = {
    // Hexagon settings
    hexSize: 18.0,                // 2.54 Size of individual hexagons
    hexHeight: 9.0,               // 6.0 Base height of hexagons
    heightVariation: 0.0,        // 16.0 Amount hexagons can vary in height
    opacity: 1.0,               // NEW: Opacity of hexagons
    enableVerticalEdges: true,  // Enable vertical edges for floating formations
    
    // Formation settings.
    formationDensity: 0.1,        // 0.3 Threshold for formation placement (0-1)
    maxHexagonsPerFormation: 9,  // 32 Maximum hexagons in a single formation
    formationSpread: 60.0,        // 30.0 How spread out hexagons are within formation
    
    // Height settings
    heightOffset: 24,            // 84 Base height above terrain
    heightNoiseScale: 1.0,        // 0.1 Scale of height variation noise
    heightNoiseAmount: 100.0,      // 10.0 Amount of height variation
    
    // Performance settings
    cellSize: 420,                 // 80 Size of grid cells for placement
    loadDistance: 700,            // 300 Distance to start loading formations
    unloadDistance: 760,          // 360 Distance to unload formations

    // Color settings.
    baseColor: '#333333',          // Dark cyan base color
    topColor: '#AAAAAA',          // Dark magenta top color
    colorIntensity: 1.0,          // Overall color intensity
    colorContrast: 1.0,          // Contrast between base and top colors
    heightColorScale: 100.0,      // How quickly colors change with height
};

document.addEventListener('DOMContentLoaded', () => {
    const waitForDependencies = () => {
        const scene = document.querySelector('a-scene');
        if (!scene || !scene.hasLoaded) {
            console.log('Waiting for scene to load...');
            setTimeout(waitForDependencies, 100);
            return;
        }
    
        if (!window.TerrainConfig || !window.ImprovedNoise) {
            console.log('Waiting for terrain system...');
            setTimeout(waitForDependencies, 100);
            return;
        }
    
        console.log('Dependencies ready, initializing floating formations...');
        const formationsEntity = document.createElement('a-entity');
        formationsEntity.setAttribute('id', 'floating-formations');
        formationsEntity.setAttribute('floating-formations', {
            noiseScale: 0.002,
            formationDensity: window.FloatingFormationsConfig.formationDensity,
            minHeight: window.TerrainConfig.baseHeight,
            maxHeight: window.TerrainConfig.baseHeight + window.TerrainConfig.heightScale,
            loadDistance: window.FloatingFormationsConfig.loadDistance,
            unloadDistance: window.FloatingFormationsConfig.unloadDistance,
            cellSize: window.FloatingFormationsConfig.cellSize,
            maxHexagonsPerFormation: window.FloatingFormationsConfig.maxHexagonsPerFormation,
            hexSize: window.FloatingFormationsConfig.hexSize // Pass hexSize from config
        });
        scene.appendChild(formationsEntity);
        console.log('Floating hex formations initialized');
    };
    
    if (document.querySelector('a-scene').hasLoaded) {
        waitForDependencies();
    } else {
        document.querySelector('a-scene').addEventListener('loaded', waitForDependencies);
    }
});

AFRAME.registerComponent('floating-formations', {
    schema: {
        loadDistance: { type: 'number', default: 700 }, // 120
        unloadDistance: { type: 'number', default: 720 }, // 150
        minHeight: { type: 'number', default: 10 },
        maxHeight: { type: 'number', default: 40 },
        formationDensity: { type: 'number', default: 0.45 }, // Threshold for formation placement
        noiseScale: { type: 'number', default: 0.015 },
        cellSize: { type: 'number', default: 20 }, // Size of grid cells for placement
        hexSize: { type: 'number', default: 2.54 }, // Size of individual hexagons
        maxHexagonsPerFormation: { type: 'number', default: 24 }
    },
    init: function() {
        this.loadedFormations = new Map();
        this.subject = document.querySelector('#subject');
        if (!this.subject) {
            console.error('Subject not found!');
            return;
        }
        this.noise = window.ImprovedNoise;
        this.material = window.CubeTerrainBuilder.createCubeMaterial({
            transparent: window.FloatingFormationsConfig.opacity < 1.0,
            opacity: window.FloatingFormationsConfig.opacity,
            isFloatingFormation: true,
            enableVerticalEdges: window.FloatingFormationsConfig.enableVerticalEdges
        });
        this.lastUpdate = { x: 0, z: 0 };
        this.terrainGenerator = null;
        document.addEventListener('terrainReady', () => {
            this.setupTerrainAccess();
        });
        this.tick = AFRAME.utils.throttleTick(this.tick, 100, this);
        console.log('Floating formations component initialized with instanced hexagons');
    },
    setupTerrainAccess: function() {
        try {
            const scene = document.querySelector('a-scene');
            if (!scene) return;
            if (scene.hasAttribute('terrain-manager')) {
                const terrainManager = scene.components['terrain-manager'];
                if (terrainManager && terrainManager.chunkManager && terrainManager.chunkManager.terrainGenerator) {
                    this.terrainGenerator = terrainManager.chunkManager.terrainGenerator;
                    console.log('Floating formations: Successfully connected to terrain generator');
                }
            }
        } catch (err) {
            console.error('Floating formations: Error setting up terrain access:', err);
        }
    },
    getTerrainHeight: function(x, z) {
        if (this.terrainGenerator) {
            try {
                return this.terrainGenerator.generateTerrainHeight(x, z);
            } catch (err) {
                console.warn('Error getting terrain height:', err);
                return 0;
            }
        }
        if (typeof window.getTerrainHeight === 'function') {
            return window.getTerrainHeight(x, z);
        }
        return 0;
    },
    setupSimpleNoise: function() {
        // Simplified noise fallback if terrain system's noise isn't available
        this.noise = {
            seed: function(seed) {
                this.currentSeed = seed;
            },
            perlin2: function(x, y) {
                return Math.sin(x * 0.3 + y * 0.5 + this.currentSeed);
            },
            fbm: function(x, y) {
                let value = 0;
                let amplitude = 1.0;
                for (let i = 0; i < 4; i++) {
                    value += this.perlin2(x * Math.pow(2, i), y * Math.pow(2, i)) * amplitude;
                    amplitude *= 0.5;
                }
                return value;
            }
        };
        this.noise.seed(Math.random() * 65536);
    },
    createFormation: function(baseX, baseZ) {
        if (!this.terrainGenerator) return null;

        // Create custom mesh for this formation using configured hex size
        const hexagons = [];
        const hexSize = window.FloatingFormationsConfig.hexSize;

        const noiseValue = (Math.abs(this.noise.fbm(
            baseX * this.data.noiseScale, 
            baseZ * this.data.noiseScale,
            4, 2.0, 0.5 
        )) + 1.0) * 0.5;
        if (noiseValue < this.data.formationDensity) return null;

        const formationSize = Math.floor(
            (noiseValue - this.data.formationDensity) * 
            this.data.maxHexagonsPerFormation * 4
        );

        const terrainHeight = this.getTerrainHeight(baseX, baseZ);
        const heightOffset = window.FloatingFormationsConfig.heightOffset;
        const baseHeight = terrainHeight + heightOffset;

        for (let i = 0; i < formationSize; i++) {
            // Increase spacing based on hexSize
            const angle = this.noise.perlin2(baseX + i * 0.1, baseZ + i * 0.1) * Math.PI * 2;
            const distance = this.noise.perlin2(baseX - i * 0.2, baseZ + i * 0.3) * 
                           window.FloatingFormationsConfig.formationSpread * (hexSize / 2.54); // Scale spread with hex size
            const x = baseX + Math.cos(angle) * distance;
            const z = baseZ + Math.sin(angle) * distance;
            
            const heightNoise = this.noise.perlin2(
                x * window.FloatingFormationsConfig.heightNoiseScale, 
                z * window.FloatingFormationsConfig.heightNoiseScale
            );
            const y = baseHeight + heightNoise * window.FloatingFormationsConfig.heightNoiseAmount;

            hexagons.push({
                position: [x, y, z],
                size: hexSize, // Add size to the hex data
                height: window.FloatingFormationsConfig.hexHeight + 
                        Math.abs(heightNoise) * window.FloatingFormationsConfig.heightVariation,
                color: this.getColorForHeight((y - terrainHeight) / 300)
            });
        }
        // console.log(`Created formation with ${hexagons.length} hexagons at height ${baseHeight.toFixed(1)} (relative to terrain at ${terrainHeight.toFixed(1)})`);
        return { cubes: hexagons };
    },
    getColorForHeight: function(heightFactor) {
        // Scale height factor by config
        const scaledFactor = Math.min(1.0, Math.max(0.0, heightFactor * 
            window.FloatingFormationsConfig.heightColorScale));
        
        // Create colors from config
        const baseColor = new THREE.Color(window.FloatingFormationsConfig.baseColor);
        const topColor = new THREE.Color(window.FloatingFormationsConfig.topColor);
        
        // Apply intensity and contrast
        baseColor.multiplyScalar(window.FloatingFormationsConfig.colorIntensity);
        topColor.multiplyScalar(window.FloatingFormationsConfig.colorIntensity);
        
        // Calculate final color with contrast adjustment
        const contrastFactor = Math.pow(scaledFactor, 1.0 + window.FloatingFormationsConfig.colorContrast);
        const finalColor = baseColor.lerp(topColor, contrastFactor);
        
        return [finalColor.r, finalColor.g, finalColor.b];
    },
    updateFormations: function(subjectX, subjectZ) {
        // Get grid coordinates
        const gridX = Math.floor(subjectX / this.data.cellSize);
        const gridZ = Math.floor(subjectZ / this.data.cellSize);
        const range = Math.ceil(this.data.loadDistance / this.data.cellSize);
        // Check cells in range
        for (let dx = -range; dx <= range; dx++) {
            for (let dz = -range; dz <= range; dz++) {
                const cellX = gridX + dx;
                const cellZ = gridZ + dz;
                const cellKey = `${cellX},${cellZ}`;
                const worldX = cellX * this.data.cellSize;
                const worldZ = cellZ * this.data.cellSize;
                const distance = Math.sqrt(
                    Math.pow(worldX - subjectX, 2) + 
                    Math.pow(worldZ - subjectZ, 2)
                );

                if (distance <= this.data.loadDistance) {
                    if (!this.loadedFormations.has(cellKey)) {
                        const formation = this.createFormation(worldX, worldZ);
                        if (formation) {
                            const mesh = window.CubeTerrainBuilder.createChunkMesh(
                                formation,
                                this.material
                            );
                            this.loadedFormations.set(cellKey, {
                                mesh: mesh,
                                position: { x: worldX, z: worldZ }
                            });
                            this.el.object3D.add(mesh);
                        }
                    }
                } else if (distance > this.data.unloadDistance) {
                    const formation = this.loadedFormations.get(cellKey);
                    if (formation) {
                        this.el.object3D.remove(formation.mesh);
                        this.loadedFormations.delete(cellKey);
                    }
                }
            }
        }
    },
    tick: function() {
        if (!this.subject) return;

        const position = this.subject.object3D.position;
        const distMoved = Math.sqrt(
            Math.pow(position.x - this.lastUpdate.x, 2) +
            Math.pow(position.z - this.lastUpdate.z, 2)
        );

        if (distMoved > this.data.cellSize * 0.5) {
            this.updateFormations(position.x, position.z);
            this.lastUpdate.x = position.x;
            this.lastUpdate.z = position.z;
        }

        // Update time uniform for any pulse effects
        if (this.material && this.material.uniforms) {
            this.material.uniforms.time.value = performance.now() / 1000.0;
        }
    }
});
