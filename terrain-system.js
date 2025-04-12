// terrain-system.js - Handles terrain generation and management

// ========== IMPROVED NOISE FUNCTIONS ==========
const ImprovedNoise = {
    // Permutation table
    p: new Array(1024),
    
    // Initialize with a random seed
    seed: function(seed) {
        if(seed > 0 && seed < 1) {
            seed *= 65536;
        }
        
        seed = Math.floor(seed);
        if(seed < 256) {
            seed |= seed << 8;
        }
        
        const perm = new Array(256);
        
        // Initialize with values 0-255
        for(let i = 0; i < 256; i++) {
            perm[i] = i;
        }
        
        // Fisher-Yates shuffle with seed influence
        for(let i = 255; i > 0; i--) {
            const seedMix = (seed ^ (seed >> 5) ^ (seed << 7) ^ (i * 13)) & 0xFFFFFFFF;
            const j = seedMix % (i + 1);
            
            // Swap
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        
        // Extend the permutation table
        for(let i = 0; i < 256; i++) {
            this.p[i] = this.p[i + 256] = this.p[i + 512] = this.p[i + 768] = perm[i];
        }
    },
    
    // Improved fade function (Ken Perlin's improved curve)
    fade: function(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    },
    
    // Linear interpolation
    lerp: function(t, a, b) {
        return a + t * (b - a);
    },
    
    // Improved gradient function
    grad: function(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    },
    
    // 2D Perlin noise
    perlin2: function(x, y) {
        // Find unit grid cell containing point
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        // Get relative coords of point within cell
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        // Compute fade curves
        const u = this.fade(x);
        const v = this.fade(y);
        
        // Hash coordinates of the 4 square corners
        const A = this.p[X] + Y;
        const B = this.p[X + 1] + Y;
        const AA = this.p[A];
        const AB = this.p[A + 1];
        const BA = this.p[B];
        const BB = this.p[B + 1];
        
        // And add blended results from 4 corners of square
        return this.lerp(v, 
            this.lerp(u, 
                this.grad(this.p[AA], x, y, 0),
                this.grad(this.p[BA], x-1, y, 0)
            ),
            this.lerp(u,
                this.grad(this.p[AB], x, y-1, 0),
                this.grad(this.p[BB], x-1, y-1, 0)
            )
        );
    },
    
    // Fractal Brownian Motion for multi-octave noise
    fbm: function(x, y, octaves = 8, lacunarity = 2.0, gain = 0.5) {
        let total = 0;
        let frequency = 1.0;
        let amplitude = 1.0;
        let maxValue = 0;
        
        // Sum multiple noise functions with different frequencies
        for(let i = 0; i < octaves; i++) {
            total += this.perlin2(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }
        
        // Normalize to range -1 to 1
        return total / maxValue;
    },
    
    // Ridged multi-fractal noise - creates more realistic ridges
    ridgedMulti: function(x, y, octaves = 8, lacunarity = 2.0, gain = 0.5, offset = 1.0) {
        let total = 0;
        let frequency = 1.0;
        let amplitude = 1.0;
        let maxValue = 0;
        
        for(let i = 0; i < octaves; i++) {
            // Get absolute value of noise to create ridges
            let signal = this.perlin2(x * frequency, y * frequency);
            signal = offset - Math.abs(signal);
            // Square signal to increase sharpness of ridges
            signal *= signal;
            
            total += signal * amplitude;
            maxValue += amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }
        
        return total / maxValue;
    }
};

// Terrain Generator
class TerrainGenerator {
    constructor(options = {}) {
        // Parameters for the terrain
        this.hex = options.hex || false;

        this.cubeSize = options.cubeSize || 1.0;
        this.heightScale = options.heightScale || 20.0;
        this.noiseScale = options.noiseScale || 0.03;
        this.baseHeight = options.baseHeight || 0.1;
        this.seed = options.seed || Math.floor(Math.random() * 65536);
        
        // Additional parameters
        this.octaves = options.octaves || 8;
        this.ridgeOctaves = options.ridgeOctaves || 4;
        this.useRidges = options.useRidges !== undefined ? options.useRidges : true;
        this.ridgeFactor = options.ridgeFactor || 0.3;
        
        // Initialize noise with the seed
        ImprovedNoise.seed(this.seed);
        
        console.log(`TerrainGenerator initialized with seed: ${this.seed}`);
    }
    
    // Generate terrain height at a given position
    generateTerrainHeight(x, z) {
        // Base continents using FBM noise
        const continentScale = this.noiseScale;
        let baseHeight = ImprovedNoise.fbm(
            x * continentScale, 
            z * continentScale, 
            this.octaves
        );
        
        // Add ridged noise for mountain ranges if enabled
        if (this.useRidges) {
            const ridgeNoise = ImprovedNoise.ridgedMulti(
                x * continentScale * 2, 
                z * continentScale * 2, 
                this.ridgeOctaves
            );
            baseHeight = baseHeight * (1 - this.ridgeFactor) + ridgeNoise * this.ridgeFactor;
        }
        
        // Add small-scale detail noise
        const detailScale = this.noiseScale * 6;
        const detail = ImprovedNoise.perlin2(x * detailScale, z * detailScale) * 0.1;
        baseHeight += detail;
        
        // Scale to our height range
        baseHeight = this.baseHeight + ((baseHeight + 1) / 2) * this.heightScale;
        
        return baseHeight;
    }
    
    // Generate a color based on height
    getColor(x, z, height) {
        // Normalize height for color calculation
        const normalizedHeight = (height - this.baseHeight) / this.heightScale;
        
        // Add some local variation for texture
        const variationScale = this.noiseScale * 10;
        const variation = ImprovedNoise.perlin2(x * variationScale, z * variationScale) * 0.1;
        
        let r, g, b;
        
        // Deep water
        if (normalizedHeight < 0.2) {
            r = 0.0;
            g = 0.1 + normalizedHeight * 0.5;
            b = 0.4 + normalizedHeight * 0.5;
        }
        // Shallow water / sand
        else if (normalizedHeight < 0.3) {
            const t = (normalizedHeight - 0.2) * 10; // 0 to 1
            r = 0.7 * t + 0.0 * (1 - t);
            g = 0.7 * t + 0.2 * (1 - t);
            b = 0.5 * t + 0.5 * (1 - t);
        }
        // Grass / low terrain
        else if (normalizedHeight < 0.5) {
            r = 0.1 + variation * 0.05;
            g = 0.4 + normalizedHeight * 0.4 + variation * 0.05;
            b = 0.1 + variation * 0.05;
        }
        // Forest / hills
        else if (normalizedHeight < 0.7) {
            r = 0.2 + variation * 0.05;
            g = 0.3 + normalizedHeight * 0.2 + variation * 0.05;
            b = 0.1 + variation * 0.05;
        }
        // Mountain rock
        else if (normalizedHeight < 0.85) {
            r = 0.5 + normalizedHeight * 0.2 + variation * 0.1;
            g = 0.5 + normalizedHeight * 0.1 + variation * 0.1;
            b = 0.5 + variation * 0.1;
        }
        // Snow caps
        else {
            const t = (normalizedHeight - 0.85) * 6.67; // 0 to 1
            r = 0.9 * t + 0.6 * (1 - t);
            g = 0.9 * t + 0.6 * (1 - t);
            b = 0.9 * t + 0.6 * (1 - t);
        }
        
        // Ensure colors are in valid range
        return [
            Math.min(1.0, Math.max(0.0, r)),
            Math.min(1.0, Math.max(0.0, g)),
            Math.min(1.0, Math.max(0.0, b))
        ];
    }
    
    // Generate a chunk of terrain
    generateChunk(chunkX, chunkZ, chunkSize) {
        // Collection for cube data
        const cubes = [];
        
        // Generate the terrain
        for (let x = 0; x < chunkSize; x++) {
            for (let z = 0; z < chunkSize; z++) {
                // Calculate world position
                const worldX = chunkX + x * this.cubeSize;
                const worldZ = chunkZ + z * this.cubeSize;
                
                // Generate height
                const height = this.generateTerrainHeight(worldX, worldZ);
                
                // Generate color
                const color = this.getColor(worldX, worldZ, height);
                
                // Add cube to collection with LOCAL position relative to chunk
                cubes.push({
                    position: [x * this.cubeSize, 0, z * this.cubeSize],
                    height: height,
                    color: color
                });
            }
        }
        
        // Return chunk data
        return {
            chunkX: chunkX,
            chunkZ: chunkZ,
            size: chunkSize,
            cubes: cubes
        };
    }
}

// Register the terrain-manager component
AFRAME.registerComponent('terrain-manager', {
    schema: {
        loadDistance: {type: 'number', default: 100},
        unloadDistance: {type: 'number', default: 150},
        heightOffset: {type: 'number', default: 5.0},
        followTerrain: {type: 'boolean', default: false},
        chunkSize: {type: 'number', default: 16},
        cubeSize: {type: 'number', default: 1.0},
        seed: {type: 'number', default: 0}
    },
    
    init: function() {
        console.log("Terrain manager component initializing...");
        
        // Get subject entity
        this.subject = document.querySelector('#subject');
        if (!this.subject) {
            console.error('Element with id "subject" not found!');
            return;
        }
        
        // Get subject's Three.js object
        this.subjectObj = this.subject.object3D;
        
        // Last known position for chunk update check
        this.lastX = 0;
        this.lastZ = 0;
        
        // Initialize tracking variables
        this.chunkManager = null;
        this.lastChunkX = null;
        this.lastChunkZ = null;
        
        // Ensure we have a seed (either from schema or generate one)
        if (this.data.seed === 0) {
            this.data.seed = Math.floor(Math.random() * 1000000);
        }
        
        // Set up when scene is loaded
        const scene = this.el.sceneEl;
        
        if (scene.hasLoaded) {
            setTimeout(() => this.onSceneLoaded(), 100);
        } else {
            scene.addEventListener('loaded', () => {
                this.onSceneLoaded();
            });
        }
        
        console.log('Terrain manager initialized, waiting for scene to load...');
    },
    
    onSceneLoaded: function() {
        try {
            console.log("Scene loaded, initializing terrain...");
            
            // Create the chunk manager
            this.chunkManager = new TerrainChunkManager({
                chunkSize: this.data.chunkSize,
                cubeSize: this.data.cubeSize,
                seed: this.data.seed
            });
            
            // Get initial position
            const initialX = this.subjectObj.position.x;
            const initialZ = this.subjectObj.position.z;
            this.lastX = initialX;
            this.lastZ = initialZ;
            
            // Calculate chunk position
            const chunkWorldSize = this.data.chunkSize * this.data.cubeSize;
            
            // Store initial chunk coordinates
            this.lastChunkX = Math.floor(initialX / chunkWorldSize);
            this.lastChunkZ = Math.floor(initialZ / chunkWorldSize);
            
            // Initial terrain update
            this.updateTerrain(initialX, initialZ);
            
            // Create debug panel
            this.setupDebugPanel();
            
            // Set up tick function
            this.tick = AFRAME.utils.throttleTick(this.tick, 100, this);
            
            // Ensure full terrain coverage
            setTimeout(() => {
                this.updateTerrain(this.subjectObj.position.x, this.subjectObj.position.z);
                
                // Dispatch event when terrain is ready
                const event = new CustomEvent('terrainReady');
                document.dispatchEvent(event);
            }, 500);
            
            console.log("Terrain manager initialization complete");
        } catch (error) {
            console.error("Failed to initialize terrain:", error);
        }
    },
    
    updateTerrain: function(x, z) {
        if (this.chunkManager) {
            // Update chunks based on current position
            this.chunkManager.updateChunksFromPosition(
                x, z, 
                this.data.loadDistance, 
                this.data.unloadDistance
            );
        }
    },
    
    tick: function() {
        try {
            const x = this.subjectObj.position.x;
            const z = this.subjectObj.position.z;
            
            // Calculate distance moved
            const distX = x - this.lastX;
            const distZ = z - this.lastZ;
            const distance = Math.sqrt(distX * distX + distZ * distZ);
            
            // Calculate current chunk position
            const chunkWorldSize = this.data.chunkSize * this.data.cubeSize;
            const currentChunkX = Math.floor(x / chunkWorldSize);
            const currentChunkZ = Math.floor(z / chunkWorldSize);
            
            // Check if the player has moved to a new chunk
            const chunkChanged = currentChunkX !== this.lastChunkX || currentChunkZ !== this.lastChunkZ;
            
            // Update terrain if we've moved significantly
            if (chunkChanged || distance > 10) {
                this.updateTerrain(x, z);
                
                // Update last chunk position
                this.lastChunkX = currentChunkX;
                this.lastChunkZ = currentChunkZ;
                this.lastX = x;
                this.lastZ = z;
            }
            
            // Handle terrain following
            if (this.data.followTerrain && this.chunkManager && this.chunkManager.terrainGenerator) {
                try {
                    // Calculate terrain height at current position
                    const terrainHeight = this.chunkManager.terrainGenerator.generateTerrainHeight(x, z);
                    
                    // Add offset to keep above terrain
                    const targetHeight = terrainHeight + this.data.heightOffset;
                    
                    // Set the new height with smooth transition
                    if (this.subjectObj.position.y !== targetHeight) {
                        this.subjectObj.position.y += (targetHeight - this.subjectObj.position.y) * 0.8;
                    }
                } catch (error) {
                    console.warn("Error in terrain following:", error);
                }
            }
            
            // Update debug panel
            this.updateDebugPanel();
        } catch (error) {
            console.error('Error in terrain-manager tick:', error);
        }
    },
    
    // Setup debug panel
    setupDebugPanel: function() {
        try {
            // Create debug panel if it doesn't exist
            let panel = document.getElementById('debug-panel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'debug-panel';
                document.body.appendChild(panel);
            }
            
            // Clear any existing content
            panel.innerHTML = '';
            
            // Add title
            const title = document.createElement('h3');
            title.textContent = `Cube Terrain (Seed: ${this.data.seed})`;
            title.style.margin = '0 0 10px 0';
            panel.appendChild(title);
            
            // Add info elements
            const positionDisplay = document.createElement('div');
            positionDisplay.id = 'position-display';
            positionDisplay.textContent = 'Position: (0, 0, 0)';
            panel.appendChild(positionDisplay);
            
            const chunkDisplay = document.createElement('div');
            chunkDisplay.id = 'chunk-display';
            chunkDisplay.textContent = 'Current Chunk: (0, 0)';
            panel.appendChild(chunkDisplay);
            
            const heightDisplay = document.createElement('div');
            heightDisplay.id = 'height-display';
            heightDisplay.textContent = 'Terrain Height: 0.0';
            panel.appendChild(heightDisplay);
            
            const chunksDisplay = document.createElement('div');
            chunksDisplay.id = 'chunks-display';
            chunksDisplay.textContent = 'Loaded Chunks: 0';
            panel.appendChild(chunksDisplay);
            
            // Add teleport buttons
            const teleportHeading = document.createElement('h4');
            teleportHeading.textContent = 'Teleport To:';
            teleportHeading.style.margin = '10px 0 5px 0';
            panel.appendChild(teleportHeading);
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.flexWrap = 'wrap';
            buttonContainer.style.gap = '5px';
            
            // Create teleport buttons
            const locations = [
                { name: 'Origin', x: 0, z: 0 },
                { name: 'Mountains', x: 100, z: 100 },
                { name: 'Valley', x: -100, z: 50 },
                { name: 'Far Out', x: 300, z: 300 }
            ];
            
            locations.forEach(loc => {
                const button = document.createElement('button');
                button.textContent = loc.name;
                button.style.cssText = `
                    background: #333;
                    color: white;
                    border: 1px solid #555;
                    padding: 5px 10px;
                    cursor: pointer;
                    border-radius: 3px;
                `;
                button.addEventListener('click', () => {
                    const currentY = this.subjectObj.position.y;
                    this.subjectObj.position.set(loc.x, currentY, loc.z);
                });
                buttonContainer.appendChild(button);
            });
            
            panel.appendChild(buttonContainer);
            
            // Add follow terrain checkbox
            const followContainer = document.createElement('div');
            followContainer.style.margin = '10px 0';
            
            const followCheck = document.createElement('input');
            followCheck.type = 'checkbox';
            followCheck.id = 'follow-terrain';
            followCheck.checked = this.data.followTerrain;
            
            const followLabel = document.createElement('label');
            followLabel.htmlFor = 'follow-terrain';
            followLabel.textContent = 'Follow Terrain';
            followLabel.style.marginLeft = '5px';
            
            followContainer.appendChild(followCheck);
            followContainer.appendChild(followLabel);
            panel.appendChild(followContainer);
            
            followCheck.addEventListener('change', () => {
                this.data.followTerrain = followCheck.checked;
            });
            
            // Add reset button
            const resetButton = document.createElement('button');
            resetButton.textContent = 'Reset Terrain (New Seed)';
            resetButton.style.cssText = `
                background: #553333;
                color: white;
                border: 1px solid #555;
                padding: 5px 10px;
                cursor: pointer;
                border-radius: 3px;
                margin-top: 10px;
                width: 100%;
            `;
            resetButton.addEventListener('click', () => {
                window.location.reload();
            });
            panel.appendChild(resetButton);
        } catch (error) {
            console.error('Error setting up debug panel:', error);
        }
    },
    
    // Update debug panel
    updateDebugPanel: function() {
        try {
            const pos = this.subjectObj.position;
            
            // Update position display
            const positionDisplay = document.getElementById('position-display');
            if (positionDisplay) {
                positionDisplay.textContent = `Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;
            }
            
            // Update chunk display
            const chunkDisplay = document.getElementById('chunk-display');
            if (chunkDisplay) {
                const chunkWorldSize = this.data.chunkSize * this.data.cubeSize;
                const chunkX = Math.floor(pos.x / chunkWorldSize);
                const chunkZ = Math.floor(pos.z / chunkWorldSize);
                
                chunkDisplay.textContent = `Current Chunk: (${chunkX}, ${chunkZ})`;
            }
            
            // Update height display
            const heightDisplay = document.getElementById('height-display');
            if (heightDisplay && this.chunkManager && this.chunkManager.terrainGenerator) {
                try {
                    const height = this.chunkManager.terrainGenerator.generateTerrainHeight(pos.x, pos.z);
                    heightDisplay.textContent = `Terrain Height: ${height.toFixed(1)}`;
                } catch (error) {
                    heightDisplay.textContent = `Terrain Height: Error`;
                }
            }
            
            // Update chunks display
            const chunksDisplay = document.getElementById('chunks-display');
            if (chunksDisplay && this.chunkManager) {
                const loadedChunks = this.chunkManager.loadedChunks.size;
                chunksDisplay.textContent = `Loaded Chunks: ${loadedChunks}`;
            }
        } catch (error) {
            console.error('Error updating debug panel:', error);
        }
    }
});

// Terrain Chunk Manager class
class TerrainChunkManager {
    constructor(options = {}) {
        try {
            // Configuration
            this.chunkSize = options.chunkSize || 16;
            this.cubeSize = options.cubeSize || 1.0;
            this.seed = options.seed || Math.floor(Math.random() * 65536);
            
            console.log("TerrainChunkManager options:", {
                chunkSize: this.chunkSize,
                cubeSize: this.cubeSize,
                seed: this.seed
            });
            
            // Maps to track chunks
            this.loadedChunks = new Map();
            
            // Container for all terrain chunks
            this.terrainContainer = document.getElementById('terrain-container');
            if (!this.terrainContainer) {
                this.terrainContainer = document.createElement('a-entity');
                this.terrainContainer.id = 'terrain-container';
                document.querySelector('a-scene').appendChild(this.terrainContainer);
            }
            
            // Create cube material
            // if (this.hex){
            // this.cubeMaterial = window.HexTerrainBuilder.createHexMaterial();
            // }
            // else {
                this.cubeMaterial = window.CubeTerrainBuilder.createCubeMaterial();
            // }
            // Create the terrain generator
            this.terrainGenerator = new TerrainGenerator({
                cubeSize: this.cubeSize,
                heightScale: 20.0,
                noiseScale: 0.03,
                baseHeight: 0.2,
                seed: this.seed,
                octaves: 8
            });
            
            console.log('Terrain Chunk Manager initialized with seed:', this.seed);
        } catch (error) {
            console.error("Error in TerrainChunkManager constructor:", error);
            throw error;
        }
    }
    
    // Update chunks based on player position
    updateChunksFromPosition(viewX, viewZ, loadDistance, unloadDistance) {
        // Calculate the size of a chunk in world units
        const chunkWorldSize = this.chunkSize * this.cubeSize;
        
        // Calculate the center chunk coordinates
        const centerChunkX = Math.floor(viewX / chunkWorldSize);
        const centerChunkZ = Math.floor(viewZ / chunkWorldSize);
        
        // Calculate how many chunks to load in each direction
        const chunkRadius = Math.ceil(loadDistance / chunkWorldSize) + 1;
        
        // Keep track of chunks to keep
        const chunksToKeep = new Set();
        
        // Load chunks in a circular pattern around the viewer
        for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
            for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
                // Calculate this chunk's grid position
                const chunkX = (centerChunkX + dx) * chunkWorldSize;
                const chunkZ = (centerChunkZ + dz) * chunkWorldSize;
                
                // Calculate center of chunk for distance check
                const centerX = chunkX + chunkWorldSize / 2;
                const centerZ = chunkZ + chunkWorldSize / 2;
                
                // Calculate distance from viewer to chunk center
                const distX = centerX - viewX;
                const distZ = centerZ - viewZ;
                const distance = Math.sqrt(distX * distX + distZ * distZ);
                
                // If within load distance, add to chunksToKeep and load if needed
                if (distance <= loadDistance) {
                    const key = `${chunkX},${chunkZ}`;
                    chunksToKeep.add(key);
                    
                    // Load if not already loaded
                    if (!this.loadedChunks.has(key)) {
                        this.loadChunkAt(chunkX, chunkZ);
                    }
                }
            }
        }
        
        // Unload chunks that are too far away
        for (const [key, chunkInfo] of this.loadedChunks.entries()) {
            if (!chunksToKeep.has(key)) {
                // Extract coordinates from key
                const [chunkX, chunkZ] = key.split(',').map(Number);
                
                // Calculate center of chunk for distance check
                const centerX = chunkX + chunkWorldSize / 2;
                const centerZ = chunkZ + chunkWorldSize / 2;
                
                // Calculate distance from viewer to chunk center
                const distX = centerX - viewX;
                const distZ = centerZ - viewZ;
                const distance = Math.sqrt(distX * distX + distZ * distZ);
                
                // If beyond unload distance, unload it
                if (distance > unloadDistance) {
                    this.unloadChunk(key);
                }
            }
        }
    }
    
    // Load a chunk at the given coordinates
    loadChunkAt(chunkX, chunkZ) {
        const key = `${chunkX},${chunkZ}`;
        
        // Check if already loaded
        if (this.loadedChunks.has(key)) {
            return;
        }
        
        // Create entity for this chunk
        const entity = document.createElement('a-entity');
        entity.setAttribute('position', `${chunkX} 0 ${chunkZ}`);
        this.terrainContainer.appendChild(entity);
        
        // Generate the chunk data
        const chunkData = this.terrainGenerator.generateChunk(chunkX, chunkZ, this.chunkSize);
        
        // Create the chunk mesh
        const chunk = window.CubeTerrainBuilder.createChunkMesh(chunkData, this.cubeMaterial);
        
        // Add to loaded chunks map
        this.loadedChunks.set(key, {
            entity: entity,
            mesh: chunk
        });
        
        // Add to scene
        entity.setObject3D('mesh', chunk);
    }
    
    // Unload a chunk
    unloadChunk(key) {
        if (!this.loadedChunks.has(key)) return;
        
        const chunkInfo = this.loadedChunks.get(key);
        this.loadedChunks.delete(key);
        
        // Remove from scene
        chunkInfo.entity.removeObject3D('mesh');
        
        // Remove entity from DOM
        if (chunkInfo.entity.parentNode) {
            chunkInfo.entity.parentNode.removeChild(chunkInfo.entity);
        }
    }
}