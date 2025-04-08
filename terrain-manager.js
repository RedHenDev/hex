// Register the terrain-manager component that will handle dynamic chunks
AFRAME.registerComponent('terrain-manager', {
    schema: {
        loadDistance: {type: 'number', default: 150},
        unloadDistance: {type: 'number', default: 200},
        heightOffset: {type: 'number', default: 5.0},
        followTerrain: {type: 'boolean', default: true},
        chunkSize: {type: 'number', default: 16}, // Size of each chunk in hex units
        hexSize: {type: 'number', default: 1.0},  // Size of each hexagon
        seed: {type: 'number', default: 0}         // Seed for terrain generation
    },
    
    init: function() {
        console.log("Terrain manager component initializing...");
        
        // Get subject entity and ensure it exists
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
        this.chunkManager = null;
        this.lastChunkX = null;
        this.lastChunkZ = null;
        
        // Initialize variables for half-chunk tracking
        this.lastHalfX = 0;
        this.lastHalfZ = 0;
        
        // Check if scene is already loaded
        const scene = this.el.sceneEl;
        console.log("Scene loaded state:", scene.hasLoaded);
        
        if (scene.hasLoaded) {
            console.log("Scene already loaded, initializing directly");
            // Call onSceneLoaded directly if scene is already loaded
            setTimeout(() => this.onSceneLoaded(), 100);
        } else {
            // Wait for the scene to fully load
            console.log("Waiting for scene loaded event");
            scene.addEventListener('loaded', () => {
                console.log("Scene loaded event fired");
                this.onSceneLoaded();
            });
        }
        
        console.log('Terrain manager initialized, waiting for scene to load...');
    },
    
    // Update the onSceneLoaded method in terrain-manager.js

onSceneLoaded: function() {
    try {
        console.log("Scene loaded, initializing terrain chunk manager...");
        
        // Check if required dependencies are available
        console.log("Checking dependencies:");
        console.log("- THREE.HexagonBufferGeometry exists:", typeof THREE.HexagonBufferGeometry !== 'undefined');
        console.log("- hexVertexShader exists:", typeof hexVertexShader !== 'undefined');
        console.log("- hexFragmentShader exists:", typeof hexFragmentShader !== 'undefined');
        console.log("- TerrainGenerator exists:", typeof TerrainGenerator !== 'undefined');
        console.log("- EnhancedTerrainGenerator exists:", typeof EnhancedTerrainGenerator !== 'undefined');
        console.log("- ImprovedNoise exists:", typeof ImprovedNoise !== 'undefined');
        
        // Create the chunk manager
        console.log("Creating chunk manager with seed:", this.data.seed);
        this.chunkManager = new TerrainChunkManager({
            chunkSize: this.data.chunkSize,
            hexSize: this.data.hexSize,
            seed: this.data.seed
        });
        
        console.log("Chunk manager created successfully");
        
        // Get initial position
        const initialX = this.subjectObj.position.x;
        const initialZ = this.subjectObj.position.z;
        this.lastX = initialX;
        this.lastZ = initialZ;
        
        // Calculate chunk position
        const hexWidth = this.data.hexSize * Math.sqrt(3);
        const hexHeight = this.data.hexSize * 1.5;
        const chunkWorldSizeX = this.data.chunkSize * hexWidth;
        const chunkWorldSizeZ = this.data.chunkSize * hexHeight;
        
        // Store initial chunk coordinates - critical for correct positioning
        // Use Math.floor to ensure consistent chunk boundaries
        this.lastChunkX = Math.floor(initialX / chunkWorldSizeX);
        this.lastChunkZ = Math.floor(initialZ / chunkWorldSizeZ);
        
        console.log("Initial position:", initialX, initialZ);
        console.log("Initial chunk:", this.lastChunkX, this.lastChunkZ);
        
        // Initial terrain update - IMPORTANT: load chunks from origin position immediately
        console.log("Performing initial terrain update...");
        this.updateTerrain(initialX, initialZ);
        
        // Create debug markers
        console.log("Creating debug markers");
        this.createDebugMarkers();
        
        // Update the debug panel
        console.log("Setting up debug panel");
        this.setupDebugPanel();
        
        // Start update loop with throttling
        console.log("Setting up tick function");
        this.tick = AFRAME.utils.throttleTick(this.tick, 100, this);
        
        // Force a full terrain update after a short delay
        // This helps ensure all initial chunks are properly loaded
        setTimeout(() => {
            console.log("Performing delayed terrain update to ensure complete coverage");
            this.updateTerrain(this.subjectObj.position.x, this.subjectObj.position.z);
        }, 500);
        
        // Hide loading screen
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 1000);
        
        console.log("Terrain manager initialization complete");
    } catch (error) {
        console.error("Failed to initialize terrain:", error);
        console.error("Error stack:", error.stack);
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
            const hexWidth = this.data.hexSize * Math.sqrt(3);
            const hexHeight = this.data.hexSize * 1.5;
            const chunkWorldSizeX = this.data.chunkSize * hexWidth;
            const chunkWorldSizeZ = this.data.chunkSize * hexHeight;
            
            const currentChunkX = Math.floor(x / chunkWorldSizeX);
            const currentChunkZ = Math.floor(z / chunkWorldSizeZ);
            
            // Calculate position within current chunk
            const posWithinChunkX = (x / chunkWorldSizeX) - currentChunkX;
            const posWithinChunkZ = (z / chunkWorldSizeZ) - currentChunkZ;
            
            // Check if the player has moved to a new chunk or halfway across the current chunk
            const chunkChanged = currentChunkX !== this.lastChunkX || currentChunkZ !== this.lastChunkZ;
            
            // Make sure lastHalfX and lastHalfZ are initialized
            if (this.lastHalfX === undefined) this.lastHalfX = 0;
            if (this.lastHalfZ === undefined) this.lastHalfZ = 0;
            
            const halfwayAcrossChunk = 
                (posWithinChunkX > 0.5 && this.lastHalfX !== 1) || 
                (posWithinChunkX <= 0.5 && this.lastHalfX !== 0) ||
                (posWithinChunkZ > 0.5 && this.lastHalfZ !== 1) || 
                (posWithinChunkZ <= 0.5 && this.lastHalfZ !== 0);
            
            // Remember which half of the chunk we're in
            this.lastHalfX = posWithinChunkX > 0.5 ? 1 : 0;
            this.lastHalfZ = posWithinChunkZ > 0.5 ? 1 : 0;
            
            // Update terrain if we've moved to a new chunk or halfway across
            if (chunkChanged || halfwayAcrossChunk) {
                // Update terrain
                this.updateTerrain(x, z);
                
                // Update last chunk position
                this.lastChunkX = currentChunkX;
                this.lastChunkZ = currentChunkZ;
            }
            
            // Update last known position
            this.lastX = x;
            this.lastZ = z;
            
            // Handle terrain following - safely check if the function exists
            if (this.data.followTerrain && typeof window.TerrainUtils !== 'undefined') {
                try {
                    // Calculate terrain height at current position
                    const terrainHeight = window.TerrainUtils.getTerrainHeight(x, z);
                    
                    // Add offset to keep above terrain
                    const targetHeight = terrainHeight + this.data.heightOffset;
                    
                    // Set the new height with smooth transition
                    if (this.subjectObj.position.y !== targetHeight) {
                        this.subjectObj.position.y += (targetHeight - this.subjectObj.position.y) * 0.1;
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
    
    // Updated createDebugMarkers method to fix A-Frame material warnings

createDebugMarkers: function() {
    try {
        console.log("Creating debug markers");
        
        // Create marker at origin
        const marker = document.createElement('a-entity');
        marker.id = 'origin-marker';
        
        // Add sphere - FIXED: use proper A-Frame material properties
        const sphere = document.createElement('a-sphere');
        sphere.setAttribute('radius', '1');
        sphere.setAttribute('color', 'red');
        // Use proper A-Frame material properties instead of emissive/emissiveIntensity
        sphere.setAttribute('material', 'shader: standard; color: red; emissiveColor: red; emissiveIntensity: 0.5');
        marker.appendChild(sphere);
        
        // Add pole
        const pole = document.createElement('a-cylinder');
        pole.setAttribute('radius', '0.2');
        pole.setAttribute('height', '20');
        pole.setAttribute('color', 'red');
        pole.setAttribute('position', '0 -10 0');
        marker.appendChild(pole);
        
        // Position marker at origin
        marker.setAttribute('position', `0 0 0`);
        
        // Add to scene
        document.querySelector('a-scene').appendChild(marker);
        console.log("Origin marker created");
        
        // Update marker height based on terrain
        const updateMarker = () => {
            if (typeof window.TerrainUtils !== 'undefined') {
                try {
                    const height = window.TerrainUtils.getTerrainHeight(0, 0);
                    const position = marker.getAttribute('position');
                    position.y = height + 1; // Slightly above terrain
                    marker.setAttribute('position', position);
                    console.log(`Updated marker height to ${height + 1}`);
                } catch (error) {
                    console.warn("Error updating marker height:", error);
                }
            }
            
            // Update periodically
            setTimeout(updateMarker, 1000);
        };
        
        // Start updating marker height after a delay to ensure utilities are loaded
        console.log("Setting up marker height update timer");
        setTimeout(updateMarker, 2000);
        
    } catch (error) {
        console.error("Error creating debug markers:", error);
        console.error("Error stack:", error.stack);
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
            title.textContent = `Enhanced Hexagon Terrain (Seed: ${this.data.seed})`;
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
                { name: 'Valley', x: -200, z: 50 },
                { name: 'Far Out', x: 500, z: 500 }
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
                const hexWidth = this.data.hexSize * Math.sqrt(3);
                const hexHeight = this.data.hexSize * 1.5;
                const chunkWorldSizeX = this.data.chunkSize * hexWidth;
                const chunkWorldSizeZ = this.data.chunkSize * hexHeight;
                
                const chunkX = Math.floor(pos.x / chunkWorldSizeX);
                const chunkZ = Math.floor(pos.z / chunkWorldSizeZ);
                
                chunkDisplay.textContent = `Current Chunk: (${chunkX}, ${chunkZ})`;
            }
            
            // Update height display
            const heightDisplay = document.getElementById('height-display');
            if (heightDisplay && typeof window.TerrainUtils !== 'undefined') {
                try {
                    const height = window.TerrainUtils.getTerrainHeight(pos.x, pos.z);
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

// Initialize the component after a short delay
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const scene = document.querySelector('a-scene');
        if (scene) {
            // Create a consistent seed
            const seed = Math.floor(Math.random() * 1000000);
            console.log(`Using seed: ${seed}`);
            
            // Set terrain manager
            scene.setAttribute('terrain-manager', {
                seed: seed
            });
        }
    }, 500);
});


class TerrainChunkManager {
    // Update the TerrainChunkManager constructor in terrain-manager.js 

    constructor(options = {}) {
        try {
            console.log("TerrainChunkManager constructor started");
            
            // Configuration
            this.chunkSize = options.chunkSize || 16; // Size of each chunk in hex units
            this.hexSize = options.hexSize || 1.0; // Size of each hexagon
            this.workerCount = options.workerCount || 1;
            this.maxConcurrentLoads = options.maxConcurrentLoads || 4;
            this.seed = options.seed || Math.floor(Math.random() * 65536);
            
            console.log("TerrainChunkManager options:", {
                chunkSize: this.chunkSize,
                hexSize: this.hexSize,
                seed: this.seed
            });
            
            // Maps to track chunks
            this.loadedChunks = new Map();
            this.pendingChunks = new Map();
            this.chunkRequestId = 0;
            
            // Container for all terrain chunks
            console.log("Looking for terrain-container element");
            this.terrainContainer = document.getElementById('terrain-container');
            if (!this.terrainContainer) {
                console.log('Element with id "terrain-container" not found! Creating one...');
                this.terrainContainer = document.createElement('a-entity');
                this.terrainContainer.id = 'terrain-container';
                document.querySelector('a-scene').appendChild(this.terrainContainer);
                console.log("Created new terrain-container element");
            } else {
                console.log("Found existing terrain-container element");
            }
            
            // Create hexagon geometry
            console.log("Creating hexagon geometry");
            if (typeof THREE.HexagonBufferGeometry === 'undefined') {
                console.error("THREE.HexagonBufferGeometry is not defined!");
                throw new Error("THREE.HexagonBufferGeometry is not defined!");
            }
            
            this.hexGeometry = new THREE.HexagonBufferGeometry(this.hexSize, 1.0, false);
            console.log("Hexagon geometry created");
            
            // Create shader material - FIXED: removed flatShading property
            console.log("Creating shader material");
            if (typeof hexVertexShader === 'undefined' || typeof hexFragmentShader === 'undefined') {
                console.error("Shader variables not defined!");
                throw new Error("Shader variables not defined!");
            }
            
            this.hexMaterial = new THREE.ShaderMaterial({
                vertexShader: hexVertexShader,
                fragmentShader: hexFragmentShader,
                vertexColors: true,
                lights: true,
                uniforms: THREE.UniformsUtils.merge([
                    THREE.UniformsLib.lights,
                    THREE.UniformsLib.common
                ])
            });
            console.log("Shader material created");
            
            // Explicitly enable lights for shader material
            this.hexMaterial.lights = true;
            
            // Create the terrain generator
            console.log("Creating terrain generator");
            if (typeof EnhancedTerrainGenerator === 'undefined') {
                console.error("EnhancedTerrainGenerator is not defined!");
                throw new Error("EnhancedTerrainGenerator is not defined!");
            }
            
            this.terrainGenerator = new EnhancedTerrainGenerator({
                hexSize: this.hexSize,
                heightScale: 12.0,
                noiseScale: 0.1,
                baseHeight: 0.2,
                seed: this.seed
            });
            console.log("Terrain generator created");
            
            console.log('Terrain Chunk Manager initialized with seed:', this.seed);
        } catch (error) {
            console.error("Error in TerrainChunkManager constructor:", error);
            console.error("Error stack:", error.stack);
            throw error;
        }
    }
    
    // Get chunk key from world coordinates
    // Fix for the TerrainChunkManager class in terrain-manager.js

// 3. Fix the updateChunksFromPosition method in TerrainChunkManager
updateChunksFromPosition(viewX, viewZ, loadDistance, unloadDistance) {
    // Get hexagon dimensions
    const hexWidth = this.hexSize * Math.sqrt(3);
    const hexHeight = this.hexSize * 1.5;
    
    // Calculate the size of a chunk in world units
    // For a chunk of size N, there are N hexagons in each direction
    const chunkWorldSizeX = hexWidth * this.chunkSize;
    const chunkWorldSizeZ = hexHeight * this.chunkSize;
    
    // Calculate the nearest chunk grid position to the viewer
    // We want to keep chunks aligned with the hexagon grid
    const baseQ = Math.floor(viewX * Math.sqrt(3)/3 / this.hexSize);
    const baseR = Math.floor(viewZ * 2/3 / this.hexSize);
    
    // Convert this back to world coordinates to get a chunk position
    // that's aligned with the hexagon grid
    const baseWorldX = hexWidth * (baseQ + baseR/2);
    const baseWorldZ = hexHeight * baseR;
    
    // Calculate how many chunks to load in each direction
    const chunkRadius = Math.ceil(loadDistance / Math.min(chunkWorldSizeX, chunkWorldSizeZ)) + 1;
    
    // Keep track of chunks to keep
    const chunksToKeep = new Set();
    
    // Load chunks in a circular pattern around the viewer
    for (let dq = -chunkRadius; dq <= chunkRadius; dq++) {
        for (let dr = -chunkRadius; dr <= chunkRadius; dr++) {
            // Calculate chunk grid position
            const q = baseQ + dq * this.chunkSize;
            const r = baseR + dr * this.chunkSize;
            
            // Convert to world coordinates for this chunk's position
            const chunkX = hexWidth * (q + r/2);
            const chunkZ = hexHeight * r;
            
            // Calculate center of chunk for distance check
            const centerX = chunkX + chunkWorldSizeX / 2;
            const centerZ = chunkZ + chunkWorldSizeZ / 2;
            
            // Calculate distance from viewer to chunk center
            const distX = centerX - viewX;
            const distZ = centerZ - viewZ;
            const distance = Math.sqrt(distX * distX + distZ * distZ);
            
            // If within load distance, add to chunksToKeep and load if needed
            if (distance <= loadDistance) {
                // Use precise string formatting for consistent keys
                const key = `${chunkX.toFixed(3)},${chunkZ.toFixed(3)}`;
                chunksToKeep.add(key);
                
                // Load if not already loaded
                if (!this.loadedChunks.has(key)) {
                    this.loadChunkAt(chunkX, chunkZ);
                }
            }
        }
    }
    
    // Unload chunks that are too far away (same as before)
    for (const [key, chunkInfo] of this.loadedChunks.entries()) {
        if (!chunksToKeep.has(key)) {
            // Extract coordinates from key
            const [chunkX, chunkZ] = key.split(',').map(Number);
            
            // Calculate center of chunk for distance check
            const centerX = chunkX + chunkWorldSizeX / 2;
            const centerZ = chunkZ + chunkWorldSizeZ / 2;
            
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

// 4. Fix the getChunkKeyFromPosition method in TerrainChunkManager
getChunkKeyFromPosition(x, z) {
    // This method should return the chunk key for a given world position
    // We need to find the chunk that contains the hexagon at this position
    
    // First, find the q,r coordinates of the hexagon at this position
    const hexWidth = this.hexSize * Math.sqrt(3);
    const hexHeight = this.hexSize * 1.5;
    
    // Convert world coordinates to axial coordinates
    const q = Math.floor(x * Math.sqrt(3)/3 / this.hexSize);
    const r = Math.floor(z * 2/3 / this.hexSize);
    
    // Calculate the chunk q,r coordinates
    const chunkQ = Math.floor(q / this.chunkSize) * this.chunkSize;
    const chunkR = Math.floor(r / this.chunkSize) * this.chunkSize;
    
    // Convert chunk coordinates back to world position
    const chunkX = hexWidth * (chunkQ + chunkR/2);
    const chunkZ = hexHeight * chunkR;
    
    // Create a consistent key
    const key = `${chunkX.toFixed(3)},${chunkZ.toFixed(3)}`;
    return key;
}
    
    // Generate chunk centered at the given coordinates
    loadChunkAt(chunkX, chunkZ) {
        // Generate a precise key 
        const key = `${chunkX.toFixed(3)},${chunkZ.toFixed(3)}`;
        
        console.log(`Loading chunk at position (${chunkX.toFixed(2)}, ${chunkZ.toFixed(2)}), key: ${key}`);
        
        // Check if already loaded
        if (this.loadedChunks.has(key)) {
            console.log(`Chunk ${key} already loaded, skipping`);
            return;
        }
        
        // Create entity for this chunk with explicit positioning
        const entity = document.createElement('a-entity');
        
        // Position the entity at the chunk's world position
        // This is critical to ensure chunks appear at the correct location
        entity.setAttribute('position', `${chunkX} 0 ${chunkZ}`);
        console.log(`Positioning chunk entity at (${chunkX}, 0, ${chunkZ})`);
        
        this.terrainContainer.appendChild(entity);
        
        // Generate the chunk data
        console.log(`Generating chunk data for (${chunkX}, ${chunkZ})`);
        const chunkData = this.terrainGenerator.generateChunk(chunkX, chunkZ, this.chunkSize);
        console.log(`Chunk generated with ${chunkData.hexagons.length} hexagons`);
        
        // Create the chunk mesh
        const chunk = this.createChunkMesh(chunkData);
        
        // Add to loaded chunks map
        this.loadedChunks.set(key, {
            mesh: chunk,
            entity: entity,
            lastUsed: Date.now()
        });
        
        // Add to scene
        entity.setObject3D('mesh', chunk);
        console.log(`Chunk ${key} loaded and added to scene`);
    }
    
    // Create a mesh for a chunk using instancing
    // Improved createChunkMesh method for better hexagon rendering

createChunkMesh(chunkData) {
    const hexagons = chunkData.hexagons;
    
    if (hexagons.length === 0) {
        console.log("No hexagons in chunk data, returning empty group");
        return new THREE.Group();
    }
    
    console.log(`Creating instanced mesh with ${hexagons.length} hexagons`);
    
    try {
        // Make sure geometry is fresh by creating a new instance
        // This prevents attribute sharing issues
        const geometry = new THREE.HexagonBufferGeometry(this.hexSize, 1.0, false);
        
        // Create the instanced mesh
        const instancedMesh = new THREE.InstancedMesh(
            geometry,
            this.hexMaterial,
            hexagons.length
        );
        
        // Disable frustum culling to prevent chunks from disappearing
        instancedMesh.frustumCulled = false;
        
        // Create buffer attributes for instance data
        const instancePositions = new Float32Array(hexagons.length * 3);
        const instanceHeights = new Float32Array(hexagons.length);
        const instanceColors = new Float32Array(hexagons.length * 3);
        
        // Debug some sample hexagons
        if (hexagons.length > 0) {
            console.log("First hexagon position:", hexagons[0].position);
            console.log("First hexagon height:", hexagons[0].height);
            console.log("First hexagon color:", hexagons[0].color);
            
            // Ensure height values are reasonable
            const heights = hexagons.map(h => h.height);
            const minHeight = Math.min(...heights);
            const maxHeight = Math.max(...heights);
            console.log(`Hexagon heights range: ${minHeight.toFixed(2)} to ${maxHeight.toFixed(2)}`);
        }
        
        // Fill the instance buffers
        for (let i = 0; i < hexagons.length; i++) {
            const hexagon = hexagons[i];
            
            // Position (x, y, z)
            instancePositions[i * 3] = hexagon.position[0];
            instancePositions[i * 3 + 1] = hexagon.position[1];
            instancePositions[i * 3 + 2] = hexagon.position[2];
            
            // Height - ensure minimum height for visibility
            instanceHeights[i] = Math.max(0.5, hexagon.height);
            
            // Color (r, g, b) - ensure valid color values
            instanceColors[i * 3] = Math.min(1.0, Math.max(0.0, hexagon.color[0]));
            instanceColors[i * 3 + 1] = Math.min(1.0, Math.max(0.0, hexagon.color[1]));
            instanceColors[i * 3 + 2] = Math.min(1.0, Math.max(0.0, hexagon.color[2]));
        }
        
        // Add the attributes to the geometry
        geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
        geometry.setAttribute('instanceHeight', new THREE.InstancedBufferAttribute(instanceHeights, 1));
        geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 3));
        
        console.log("Instanced mesh created successfully");
        return instancedMesh;
        
    } catch (error) {
        console.error("Error creating instanced mesh:", error);
        console.error("Error stack:", error.stack);
        return new THREE.Group(); // Return empty group on error
    }
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