// Chunk Manager - Handles loading and unloading of terrain chunks

class TerrainChunkManager {
    constructor(options = {}) {
        // Configuration
        this.chunkSize = options.chunkSize || 16; // Size of each chunk in hex units
        this.hexSize = options.hexSize || 1.0; // Size of each hexagon
        this.workerCount = options.workerCount || 4; // Number of web workers to use
        this.maxConcurrentLoads = options.maxConcurrentLoads || 8; // Max chunks to load at once
        this.seed = options.seed || Math.floor(Math.random() * 65536);
        
        // Maps to track chunks
        this.loadedChunks = new Map(); // Currently loaded chunks
        this.pendingChunks = new Map(); // Chunks being generated
        this.chunkRequestId = 0; // Unique ID for each chunk request
        
        // Container for all terrain chunks
        this.terrainContainer = document.getElementById('terrain-container');
        if (!this.terrainContainer) {
            console.error('Element with id "terrain-container" not found! Creating one...');
            // Create the container if it doesn't exist
            this.terrainContainer = document.createElement('a-entity');
            this.terrainContainer.id = 'terrain-container';
            
            // Try to add it to the scene
            const scene = document.querySelector('a-scene');
            if (scene) {
                scene.appendChild(this.terrainContainer);
            } else {
                // If scene doesn't exist, add it to body and wait for scene to exist
                document.body.appendChild(this.terrainContainer);
                
                // Move to scene when it becomes available
                const checkForScene = () => {
                    const scene = document.querySelector('a-scene');
                    if (scene) {
                        if (this.terrainContainer.parentNode !== scene) {
                            scene.appendChild(this.terrainContainer);
                        }
                    } else {
                        setTimeout(checkForScene, 100);
                    }
                };
                
                setTimeout(checkForScene, 100);
            }
        }
        
        // Initialize workers
        this.workers = [];
        this.nextWorker = 0;
        this.initWorkers();
        
        // Create a cylinder geometry for hexagons (shared by all chunks)
        this.hexGeometry = new THREE.CylinderGeometry(0.95, 0.95, 1.0, 6, 1, false);
        this.hexGeometry.translate(0, 0.5, 0); // Move origin to bottom of cylinder
        
        // Get the shader code directly from the script tags
        const vertexShaderElement = document.getElementById('vertexShader');
        const fragmentShaderElement = document.getElementById('fragmentShader');
        
        if (!vertexShaderElement || !fragmentShaderElement) {
            console.error('Shader script elements not found!');
            return;
        }
        
        // Create shader material
        this.hexMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShaderElement.textContent,
            fragmentShader: fragmentShaderElement.textContent,
            vertexColors: true,
            lights: true,
            flatShading: true,
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.lights,
                THREE.UniformsLib.common
            ])
        });
        
        // Explicitly enable lights for shader material
        this.hexMaterial.lights = true;
        
        console.log('Terrain Chunk Manager initialized with seed:', this.seed);
    }
    
    // Initialize web workers
    initWorkers() {
        for (let i = 0; i < this.workerCount; i++) {
            const worker = new Worker('terrain-worker.js');
            
            // Set up message handling
            worker.onmessage = (e) => this.handleWorkerMessage(e.data);
            
            // Initialize the worker with options
            worker.postMessage({
                type: 'init',
                options: {
                    hexSize: this.hexSize,
                    heightScale: 5.0,
                    noiseScale: 0.1,
                    baseHeight: 0.2,
                    maxSlopeDifference: 2.0,
                    seed: this.seed
                }
            });
            
            this.workers.push(worker);
        }
    }
    
    // Get the next worker in round-robin fashion
    getNextWorker() {
        const worker = this.workers[this.nextWorker];
        this.nextWorker = (this.nextWorker + 1) % this.workerCount;
        return worker;
    }
    
    // Handle messages from workers
    handleWorkerMessage(message) {
        switch (message.type) {
            case 'initialized':
                console.log('Worker initialized with seed:', message.seed);
                break;
                
            case 'chunkGenerated':
                this.onChunkGenerated(message.requestId, message.data);
                break;
                
            case 'error':
                console.error('Error in terrain worker:', message.message);
                console.error(message.stack);
                
                // Remove from pending chunks
                if (this.pendingChunks.has(message.requestId)) {
                    this.pendingChunks.delete(message.requestId);
                }
                
                // Check if we can load more chunks
                this.checkPendingLoads();
                break;
        }
    }
    
    // Process a generated chunk
    onChunkGenerated(requestId, chunkData) {
        // Check if this chunk is still needed
        if (!this.pendingChunks.has(requestId)) {
            console.log('Discarding unneeded chunk:', requestId);
            return;
        }
        
        const pendingInfo = this.pendingChunks.get(requestId);
        this.pendingChunks.delete(requestId);
        
        // Create the chunk mesh
        const chunk = this.createChunkMesh(chunkData);
        
        // Add to loaded chunks map
        this.loadedChunks.set(pendingInfo.key, {
            mesh: chunk,
            entity: pendingInfo.entity,
            lastUsed: Date.now()
        });
        
        // Add to scene using A-Frame's entity system
        pendingInfo.entity.setObject3D('mesh', chunk);
        
        console.log(`Chunk loaded at (${chunkData.chunkX}, ${chunkData.chunkZ}) with ${chunkData.hexagons.length} hexagons`);
        
        // Check if we can load more chunks
        this.checkPendingLoads();
    }
    
    // Create a mesh for a chunk using instancing
    createChunkMesh(chunkData) {
        const hexagons = chunkData.hexagons;
        
        if (hexagons.length === 0) {
            // Return an empty group if there are no hexagons
            return new THREE.Group();
        }
        
        // Create a new instance of geometry for this chunk to avoid sharing attributes
        const geometry = this.hexGeometry.clone();
        
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
        
        // Fill the instance buffers
        for (let i = 0; i < hexagons.length; i++) {
            const hexagon = hexagons[i];
            
            // Position (x, y, z)
            instancePositions[i * 3] = hexagon.position[0];
            instancePositions[i * 3 + 1] = hexagon.position[1];
            instancePositions[i * 3 + 2] = hexagon.position[2];
            
            // Height
            instanceHeights[i] = hexagon.height;
            
            // Color (r, g, b)
            instanceColors[i * 3] = hexagon.color[0];
            instanceColors[i * 3 + 1] = hexagon.color[1];
            instanceColors[i * 3 + 2] = hexagon.color[2];
        }
        
        // Add the attributes to the geometry
        geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
        geometry.setAttribute('instanceHeight', new THREE.InstancedBufferAttribute(instanceHeights, 1));
        geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 3));
        
        return instancedMesh;
    }
    
    // Get chunk key from world coordinates
    getChunkKeyFromPosition(x, z) {
        // Calculate chunk coordinates (centered chunks)
        const hexWidth = this.hexSize * Math.sqrt(3);
        const hexHeight = this.hexSize * 1.5;
        
        const chunkX = Math.floor(x / (this.chunkSize * hexWidth)) * this.chunkSize * hexWidth;
        const chunkZ = Math.floor(z / (this.chunkSize * hexHeight)) * this.chunkSize * hexHeight;
        
        return `${chunkX},${chunkZ}`;
    }
    
    // Generate chunk centered at the given coordinates
    loadChunkAt(chunkX, chunkZ, priority = 0) {
        const key = `${chunkX},${chunkZ}`;
        
        // Check if already loaded or pending
        if (this.loadedChunks.has(key)) {
            // Update last used time to prevent unloading
            const chunkInfo = this.loadedChunks.get(key);
            chunkInfo.lastUsed = Date.now();
            this.loadedChunks.set(key, chunkInfo);
            return;
        }
        
        if (this.isChunkPending(key)) {
            this.updateChunkPriority(key, priority);
            return;
        }
        
        // Create entity for this chunk
        const entity = document.createElement('a-entity');
        entity.setAttribute('position', `0 0 0`);
        this.terrainContainer.appendChild(entity);
        
        // Generate a unique request ID
        const requestId = this.chunkRequestId++;
        
        // Add to pending chunks
        this.pendingChunks.set(requestId, {
            key: key,
            priority: priority,
            entity: entity,
            timeRequested: Date.now()
        });
        
        // Check if we can generate this chunk immediately
        if (this.canLoadMoreChunks()) {
            this.startChunkGeneration(requestId, chunkX, chunkZ);
        }
    }
    
    // Check if we can load more chunks concurrently
    canLoadMoreChunks() {
        // Count truly pending chunks (ones with active worker requests)
        let activeCount = 0;
        for (const [_, info] of this.pendingChunks.entries()) {
            if (info.worker) activeCount++;
        }
        
        return activeCount < this.maxConcurrentLoads;
    }
    
    // Start generation of a pending chunk
    startChunkGeneration(requestId, chunkX, chunkZ) {
        if (!this.pendingChunks.has(requestId)) return;
        
        const pendingInfo = this.pendingChunks.get(requestId);
        const worker = this.getNextWorker();
        
        // Update pending info
        pendingInfo.worker = worker;
        this.pendingChunks.set(requestId, pendingInfo);
        
        // Send request to worker
        worker.postMessage({
            type: 'generateChunk',
            x: chunkX,
            z: chunkZ,
            size: this.chunkSize,
            requestId: requestId,
            priority: pendingInfo.priority
        });
    }
    
    // Check if a chunk is in the pending queue
    isChunkPending(key) {
        for (const [_, info] of this.pendingChunks.entries()) {
            if (info.key === key) return true;
        }
        return false;
    }
    
    // Update priority of a pending chunk
    updateChunkPriority(key, newPriority) {
        for (const [requestId, info] of this.pendingChunks.entries()) {
            if (info.key === key) {
                // Update priority
                info.priority = Math.max(info.priority, newPriority);
                this.pendingChunks.set(requestId, info);
                
                // If it has a worker, tell it to reprioritize
                if (info.worker) {
                    info.worker.postMessage({
                        type: 'updatePriority',
                        requestId: requestId,
                        priority: info.priority
                    });
                }
                
                return;
            }
        }
    }
    
    // Check if there are any chunks waiting to be loaded
    checkPendingLoads() {
        // If we can't load more, do nothing
        if (!this.canLoadMoreChunks()) return;
        
        // Find pending chunks that aren't being worked on
        const waitingChunks = [];
        for (const [requestId, info] of this.pendingChunks.entries()) {
            if (!info.worker) {
                waitingChunks.push({
                    requestId: requestId,
                    key: info.key,
                    priority: info.priority,
                    timeRequested: info.timeRequested
                });
            }
        }
        
        // Sort by priority (higher first) then by time (older first)
        waitingChunks.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return a.timeRequested - b.timeRequested;
        });
        
        // Start generation for as many as we can
        for (const chunk of waitingChunks) {
            if (!this.canLoadMoreChunks()) break;
            
            // Extract coordinates from key
            const [chunkX, chunkZ] = chunk.key.split(',').map(Number);
            
            // Start generation
            this.startChunkGeneration(chunk.requestId, chunkX, chunkZ);
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
        
        console.log('Unloaded chunk:', key);
    }
    
    // Cancel a pending chunk
    cancelPendingChunk(key) {
        for (const [requestId, info] of this.pendingChunks.entries()) {
            if (info.key === key) {
                // If it's being worked on, cancel the worker task
                if (info.worker) {
                    info.worker.postMessage({
                        type: 'cancelChunk',
                        requestId: requestId
                    });
                }
                
                // Remove from pending
                this.pendingChunks.delete(requestId);
                
                // Remove entity from DOM
                if (info.entity.parentNode) {
                    info.entity.parentNode.removeChild(info.entity);
                }
                
                console.log('Cancelled pending chunk:', key);
                return;
            }
        }
    }
    
    // Update chunks based on viewer position
    updateChunksFromPosition(viewX, viewZ, loadDistance, unloadDistance) {
        // Calculate which chunks should be visible
        const hexWidth = this.hexSize * Math.sqrt(3);
        const hexHeight = this.hexSize * 1.5;
        
        const chunkWorldSizeX = this.chunkSize * hexWidth;
        const chunkWorldSizeZ = this.chunkSize * hexHeight;
        
        // Calculate the radius in chunks (how many chunks to load in each direction)
        const chunkRadiusX = Math.ceil(loadDistance / chunkWorldSizeX);
        const chunkRadiusZ = Math.ceil(loadDistance / chunkWorldSizeZ);
        
        // Get the base chunk coordinates
        const baseChunkX = Math.floor(viewX / chunkWorldSizeX);
        const baseChunkZ = Math.floor(viewZ / chunkWorldSizeZ);
        
        // Keep track of chunks to keep
        const chunksToKeep = new Set();
        
        // Determine chunks to load
        for (let dx = -chunkRadiusX; dx <= chunkRadiusX; dx++) {
            for (let dz = -chunkRadiusZ; dz <= chunkRadiusZ; dz++) {
                const chunkX = (baseChunkX + dx) * chunkWorldSizeX;
                const chunkZ = (baseChunkZ + dz) * chunkWorldSizeZ;
                
                // Calculate center of chunk
                const centerX = chunkX + chunkWorldSizeX / 2;
                const centerZ = chunkZ + chunkWorldSizeZ / 2;
                
                // Calculate distance from viewer to chunk center
                const distX = centerX - viewX;
                const distZ = centerZ - viewZ;
                const distance = Math.sqrt(distX * distX + distZ * distZ);
                
                // If within load distance, add to chunksToKeep and load if needed
                if (distance <= loadDistance) {
                    const key = `${chunkX},${chunkZ}`;
                    chunksToKeep.add(key);
                    
                    // Calculate priority based on distance (closer = higher priority)
                    const priority = 1 - (distance / loadDistance);
                    
                    // Load if not already loaded or pending
                    this.loadChunkAt(chunkX, chunkZ, priority);
                }
            }
        }
        
        // Unload chunks that are too far away
        for (const [key, chunkInfo] of this.loadedChunks.entries()) {
            if (!chunksToKeep.has(key)) {
                // Extract coordinates from key
                const [chunkX, chunkZ] = key.split(',').map(Number);
                
                // Calculate center of chunk
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
        
        // Cancel pending chunks that are too far away
        for (const [requestId, info] of this.pendingChunks.entries()) {
            if (!chunksToKeep.has(info.key)) {
                // Extract coordinates from key
                const [chunkX, chunkZ] = info.key.split(',').map(Number);
                
                // Calculate center of chunk
                const centerX = chunkX + chunkWorldSizeX / 2;
                const centerZ = chunkZ + chunkWorldSizeZ / 2;
                
                // Calculate distance from viewer to chunk center
                const distX = centerX - viewX;
                const distZ = centerZ - viewZ;
                const distance = Math.sqrt(distX * distX + distZ * distZ);
                
                // If beyond unload distance, cancel it
                if (distance > unloadDistance) {
                    this.cancelPendingChunk(info.key);
                }
            }
        }
        
        // Check if we need to start generation for any pending chunks
        this.checkPendingLoads();
    }
}