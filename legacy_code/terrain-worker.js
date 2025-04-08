// Enhanced Terrain Worker - Handles terrain generation in a separate thread

// Import the required scripts
importScripts('improved-noise.js');
importScripts('hexagon-geometry.js');
importScripts('enhanced-terrain.js');

// Queue of pending chunk generation tasks
let chunkQueue = [];
let isProcessing = false;
let generator = null;

// Initialize the generator with options
function initGenerator(options) {
    console.log("[Worker] Initializing enhanced terrain generator with seed:", options.seed);
    
    // Always enable enhanced terrain with improved noise
    options.useEnhancedTerrain = true;
    options.useBiomeColors = true;
    
    // Set enhanced terrain parameters for more dramatic terrain
    options.heightScale = options.heightScale || 12.0; // Increased for more dramatic terrain
    options.ridgeIntensity = options.ridgeIntensity || 0.8;
    options.erosionStrength = options.erosionStrength || 0.5;
    options.detailLevel = options.detailLevel || 0.9;
    options.warpStrength = options.warpStrength || 4.0;
    options.useWarp = options.useWarp !== undefined ? options.useWarp : true;
    options.useRidges = options.useRidges !== undefined ? options.useRidges : true;
    options.directionalRidges = options.directionalRidges !== undefined ? options.directionalRidges : true;
    options.octaves = options.octaves || 6;
    options.ridgeOctaves = options.ridgeOctaves || 4;
    
    // Enable more terrain features
    options.useMountains = options.useMountains !== undefined ? options.useMountains : true;
    options.usePlateaus = options.usePlateaus !== undefined ? options.usePlateaus : true;
    options.useValleys = options.useValleys !== undefined ? options.useValleys : true;
    
    // Create the enhanced terrain generator
    generator = new EnhancedTerrainGenerator(options);
    
    self.postMessage({
        type: 'initialized',
        seed: options.seed || generator.seed
    });
}

// Process the next chunk in the queue
function processNextChunk() {
    if (chunkQueue.length === 0 || isProcessing || !generator) {
        return;
    }
    
    isProcessing = true;
    
    // Get the next task
    const task = chunkQueue.shift();
    
    try {
        // Generate the chunk with our enhanced generator
        const chunkData = generator.generateChunk(task.x, task.z, task.size);
        
        // Send the result back to the main thread
        self.postMessage({
            type: 'chunkGenerated',
            requestId: task.requestId,
            priority: task.priority,
            data: chunkData
        });
    } catch (error) {
        // Send error back to main thread
        console.error("[Worker] Error generating chunk:", error);
        self.postMessage({
            type: 'error',
            requestId: task.requestId,
            message: error.message,
            stack: error.stack
        });
    } finally {
        // Mark as no longer processing
        isProcessing = false;
        
        // Process next chunk if available
        if (chunkQueue.length > 0) {
            setTimeout(processNextChunk, 0);
        }
    }
}

// Handle messages from the main thread
self.onmessage = function(e) {
    const message = e.data;
    
    switch (message.type) {
        case 'init':
            // Initialize the generator
            initGenerator(message.options || {});
            break;
            
        case 'generateChunk':
            // Add to queue with priority
            chunkQueue.push({
                x: message.x,
                z: message.z,
                size: message.size,
                requestId: message.requestId,
                priority: message.priority
            });
            
            // Sort queue by priority (higher priority first)
            chunkQueue.sort((a, b) => b.priority - a.priority);
            
            // Start processing if not already
            if (!isProcessing) {
                processNextChunk();
            }
            break;
            
        case 'cancelChunk':
            // Remove from queue if it exists
            chunkQueue = chunkQueue.filter(task => task.requestId !== message.requestId);
            break;
            
        case 'clearQueue':
            // Clear all pending tasks
            chunkQueue = [];
            break;
            
        case 'updatePriority':
            // Find the chunk in the queue and update its priority
            for (let i = 0; i < chunkQueue.length; i++) {
                if (chunkQueue[i].requestId === message.requestId) {
                    chunkQueue[i].priority = message.priority;
                    break;
                }
            }
            
            // Re-sort queue by priority
            chunkQueue.sort((a, b) => b.priority - a.priority);
            break;
    }
};