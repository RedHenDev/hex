// Floating hex formations that appear around the player using noise-based placement

document.addEventListener('DOMContentLoaded', () => {
    const waitForDependencies = () => {
        // Wait for both terrain system and ImprovedNoise
        if (!window.TerrainConfig || !window.ImprovedNoise) {
            console.log('Waiting for terrain system...');
            setTimeout(waitForDependencies, 100);
            return;
        }

        // Initialize floating formations component
        const scene = document.querySelector('a-scene');
        if (scene) {
            const formationsEntity = document.createElement('a-entity');
            formationsEntity.setAttribute('id', 'floating-formations');
            formationsEntity.setAttribute('floating-formations', {
                noiseScale: window.TerrainConfig.noiseScale * 2,
                formationDensity: 0.25,
                // Increase height range significantly
                minHeight: window.TerrainConfig.baseHeight + 200, // Float well above terrain
                maxHeight: window.TerrainConfig.baseHeight + 400,
                loadDistance: window.TerrainConfig.loadDistance * 0.5,
                unloadDistance: window.TerrainConfig.unloadDistance * 0.5,
                cellSize: window.TerrainConfig.geometrySize * 4
            });
            scene.appendChild(formationsEntity);
            console.log('Floating hex formations initialized with terrain config');
        }
    };

    waitForDependencies();
});

AFRAME.registerComponent('floating-formations', {
    schema: {
        loadDistance: { type: 'number', default: 120 },
        unloadDistance: { type: 'number', default: 150 },
        minHeight: { type: 'number', default: -10 },
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

        // Use terrain system's noise directly
        this.noise = window.ImprovedNoise;
        
        // Create material from hex-simple system
        this.material = window.CubeTerrainBuilder.createCubeMaterial();
        
        // Track last position for updates
        this.lastUpdate = {
            x: 0,
            z: 0
        };

        // Set up faster tick rate for more responsive formation generation
        this.tick = AFRAME.utils.throttleTick(this.tick, 100, this);
        
        console.log('Floating formations component initialized');
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
        const hexagons = [];
        const noiseValue = this.noise.fbm(
            baseX * this.data.noiseScale, 
            baseZ * this.data.noiseScale,
             4,
            2.0,
            0.5
        );
        
        if (noiseValue < this.data.formationDensity) return null;

        const formationSize = Math.floor(
            (noiseValue - this.data.formationDensity) * 
            this.data.maxHexagonsPerFormation * 2
        );

        // Get terrain height at this position
        const terrainHeight = window.getTerrainHeight(baseX, baseZ);
        
        // Base height for the formation, ensuring it's well above terrain
        const baseHeight = Math.max(
            terrainHeight + 200, // Minimum 200 units above terrain
            this.data.minHeight + (noiseValue * (this.data.maxHeight - this.data.minHeight))
        );

        // Create cluster of hexagons
        for (let i = 0; i < formationSize; i++) {
            const angle = this.noise.perlin2(baseX + i * 0.1, baseZ + i * 0.1) * Math.PI * 2;
            const distance = this.noise.perlin2(baseX - i * 0.2, baseZ + i * 0.3) * 15; // Increased spread
            
            const x = baseX + Math.cos(angle) * distance;
            const z = baseZ + Math.sin(angle) * distance;
            
            // Vary height based on distance from center with larger variation
            const heightNoise = this.noise.perlin2(x * 0.1, z * 0.1);
            const y = baseHeight + heightNoise * 50; // Increased height variation

            const heightFactor = (y - this.data.minHeight) / 
                               (this.data.maxHeight - this.data.minHeight);
            const color = this.getColorForHeight(heightFactor);

            hexagons.push({
                position: [x, y, z],
                height: 4.0 + Math.abs(heightNoise) * 8, // Increased hexagon height
                color: color
            });
        }

        return hexagons;
    },

    getColorForHeight: function(heightFactor) {
        // Use a color gradient based on height
        const baseColor = new THREE.Color(0x666677);
        const highColor = new THREE.Color(0x8888aa);
        const finalColor = baseColor.lerp(highColor, heightFactor);
        return [finalColor.r, finalColor.g, finalColor.b];
    },

    updateFormations: function(subjectX, subjectZ) {
        // Get grid coordinates
        const gridX = Math.floor(subjectX / this.data.cellSize);
        const gridZ = Math.floor(subjectZ / this.data.cellSize);
        
        // Check cells in range
        const range = Math.ceil(this.data.loadDistance / this.data.cellSize);
        
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
                                { cubes: formation }, 
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
