// Floating hex formations that appear around the player using noise-based placement

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
            noiseScale: 0.002, // Increased for more variation
            formationDensity: 0.3, // Much higher for more formations
            minHeight: window.TerrainConfig.baseHeight + 100, // Lower to terrain
            maxHeight: window.TerrainConfig.baseHeight + 300, // Lower to terrain
            loadDistance: window.TerrainConfig.loadDistance * 0.75,
            unloadDistance: window.TerrainConfig.unloadDistance * 0.75,
            cellSize: 80, // Smaller cells = more formations
            maxHexagonsPerFormation: 32 // Fewer but more visible
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
        // Use absolute value of noise for more frequent formations
        const noiseValue = (Math.abs(this.noise.fbm(
            baseX * this.data.noiseScale, 
            baseZ * this.data.noiseScale,
            4, 2.0, 0.5
        )) + 1.0) * 0.5; // Normalize to 0-1 range

        console.log(`Formation check at ${baseX},${baseZ}: noise=${noiseValue.toFixed(3)}, threshold=${this.data.formationDensity}`);
        
        if (noiseValue < this.data.formationDensity) return null;

        const formationSize = Math.floor(
            (noiseValue - this.data.formationDensity) * 
            this.data.maxHexagonsPerFormation * 2
        );

        // Get terrain height and stay closer to it
        const terrainHeight = window.getTerrainHeight(baseX, baseZ);
        const baseHeight = terrainHeight + 100 + (noiseValue * 200); // 100-300 units above terrain

        // Create tighter formation
        for (let i = 0; i < formationSize; i++) {
            const angle = this.noise.perlin2(baseX + i * 0.1, baseZ + i * 0.1) * Math.PI * 2;
            const distance = this.noise.perlin2(baseX - i * 0.2, baseZ + i * 0.3) * 25; // Tighter spread
            
            const x = baseX + Math.cos(angle) * distance;
            const z = baseZ + Math.sin(angle) * distance;
            
            const heightNoise = this.noise.perlin2(x * 0.1, z * 0.1);
            const y = baseHeight + heightNoise * 50; // Less vertical spread

            hexagons.push({
                position: [x, y, z],
                height: 8.0 + Math.abs(heightNoise) * 16,
                color: this.getColorForHeight((y - terrainHeight) / 300) // Color based on height above terrain
            });
        }

        console.log(`Created formation with ${hexagons.length} hexagons at height ${baseHeight.toFixed(1)} (${(baseHeight - terrainHeight).toFixed(1)} above terrain)`);
        return hexagons;
    },

    getColorForHeight: function(heightFactor) {
        // More distinct colors
        const baseColor = new THREE.Color(0x88aaff); // Blueish
        const highColor = new THREE.Color(0xffaa88); // Orangeish
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
