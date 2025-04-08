// main.js - Integration script for the enhanced hexagon terrain system

// Initialize the terrain system when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing Enhanced Hexagon Terrain System");
    
    // Wait for A-Frame to initialize
    const checkScene = function() {
        const scene = document.querySelector('a-scene');
        if (scene) {
            // If scene exists, wait for it to be loaded
            if (scene.hasLoaded) {
                initializeTerrain(scene);
            } else {
                scene.addEventListener('loaded', function() {
                    initializeTerrain(scene);
                });
            }
        } else {
            // If scene doesn't exist yet, try again in a moment
            setTimeout(checkScene, 100);
        }
    };
    
    // Start checking for the scene
    checkScene();
});

// Initialize the terrain system
function initializeTerrain(scene) {
    // Check if required scripts are loaded
    if (typeof TerrainChunkManager === 'undefined') {
        console.error("ERROR: TerrainChunkManager class is not defined. Check if chunk-manager.js loaded correctly.");
        return;
    }
    
    if (typeof THREE.HexagonGeometry === 'undefined') {
        console.error("ERROR: HexagonGeometry class is not defined. Check if hexagon-geometry.js loaded correctly.");
        return;
    }
    
    console.log("All required scripts loaded, setting up terrain...");
    
    // Create a global seed for consistent terrain generation
    const seed = Math.floor(Math.random() * 1000000);
    console.log(`Using seed: ${seed} for terrain generation`);
    
    // Add the terrain-manager component to the scene
    scene.setAttribute('terrain-manager', {
        loadDistance: 150,
        unloadDistance: 200,
        heightOffset: 5.0, // Higher offset to see more terrain
        followTerrain: false, // Set to false for free camera movement
        chunkSize: 16,
        hexSize: 1.0,
        seed: seed
    });
    
    // Update the camera position and settings for better viewing
    const camera = document.querySelector('[camera]');
    if (camera) {
        camera.setAttribute('position', '0 30 50'); // Higher position to see more terrain
        camera.setAttribute('rotation', '-30 0 0'); // Looking down at the terrain
        camera.setAttribute('wasd-controls', 'acceleration: 100'); // Faster movement
    }
    
    // Update sky color for better contrast
    const sky = document.querySelector('a-sky');
    if (sky) {
        sky.setAttribute('color', '#1a2b42'); // Darker blue for better contrast
    }
    
    // Add stronger directional light for better shadows
    const light = document.querySelector('[light]');
    if (light && light.getAttribute('type') === 'directional') {
        light.setAttribute('intensity', '0.8'); // Stronger directional light
        light.setAttribute('position', '-1 2 1'); // Better angle for shadows
    }
    
    // Add debug controls and information panel
    addDebugControls(scene, seed);
    
    console.log("Terrain initialization complete!");
    
    // Hide loading screen if it exists
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

// Add debug controls and information panel
function addDebugControls(scene, seed) {
    console.log("Adding debug controls and information panel...");
    
    // Create debug panel
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 300px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        font-family: monospace;
        z-index: 1000;
        border-radius: 5px;
    `;
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = `Enhanced Hexagon Terrain (Seed: ${seed})`;
    title.style.margin = '0 0 10px 0';
    debugPanel.appendChild(title);
    
    // Add position display
    const positionDisplay = document.createElement('div');
    positionDisplay.id = 'position-display';
    positionDisplay.textContent = 'Position: (0, 0, 0)';
    debugPanel.appendChild(positionDisplay);
    
    // Add chunk info display
    const chunkDisplay = document.createElement('div');
    chunkDisplay.id = 'chunk-display';
    chunkDisplay.textContent = 'Current Chunk: (0, 0)';
    debugPanel.appendChild(chunkDisplay);
    
    // Add height display
    const heightDisplay = document.createElement('div');
    heightDisplay.id = 'height-display';
    heightDisplay.textContent = 'Terrain Height: 0.0';
    debugPanel.appendChild(heightDisplay);
    
    // Add loaded chunks counter
    const chunksDisplay = document.createElement('div');
    chunksDisplay.id = 'chunks-display';
    chunksDisplay.textContent = 'Loaded Chunks: 0';
    debugPanel.appendChild(chunksDisplay);
    
    // Add teleport buttons
    const teleportHeading = document.createElement('h4');
    teleportHeading.textContent = 'Teleport To:';
    teleportHeading.style.margin = '10px 0 5px 0';
    debugPanel.appendChild(teleportHeading);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexWrap = 'wrap';
    buttonContainer.style.gap = '5px';
    
    // Add teleport buttons for interesting locations
    const teleportLocations = [
        { name: 'Origin', x: 0, z: 0 },
        { name: 'Mountains', x: 100, z: 100 },
        { name: 'Valley', x: -200, z: 50 },
        { name: 'Plateau', x: 50, z: -300 },
        { name: 'Far Out', x: 500, z: 500 }
    ];
    
    teleportLocations.forEach(loc => {
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
            const camera = document.querySelector('[camera]');
            if (camera) {
                // Keep current Y height
                const currentY = camera.object3D.position.y;
                camera.object3D.position.set(loc.x, currentY, loc.z);
                
                // Update displays
                positionDisplay.textContent = `Position: (${loc.x.toFixed(1)}, ${currentY.toFixed(1)}, ${loc.z.toFixed(1)})`;
            }
        });
        buttonContainer.appendChild(button);
    });
    
    debugPanel.appendChild(buttonContainer);
    
    // Add toggle for terrain following
    const followContainer = document.createElement('div');
    followContainer.style.margin = '10px 0';
    
    const followCheck = document.createElement('input');
    followCheck.type = 'checkbox';
    followCheck.id = 'follow-terrain';
    
    const followLabel = document.createElement('label');
    followLabel.htmlFor = 'follow-terrain';
    followLabel.textContent = 'Follow Terrain';
    followLabel.style.marginLeft = '5px';
    
    followContainer.appendChild(followCheck);
    followContainer.appendChild(followLabel);
    debugPanel.appendChild(followContainer);
    
    followCheck.addEventListener('change', () => {
        const terrainManager = scene.components['terrain-manager'];
        if (terrainManager) {
            terrainManager.data.followTerrain = followCheck.checked;
        }
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
        // Reload the page to reset terrain with a new seed
        window.location.reload();
    });
    debugPanel.appendChild(resetButton);
    
    // Add to body
    document.body.appendChild(debugPanel);
    
    // Update displays periodically
    setInterval(() => {
        const camera = document.querySelector('[camera]');
        if (camera) {
            const pos = camera.object3D.position;
            positionDisplay.textContent = `Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;
            
            // Get current chunk
            const terrainManager = scene.components['terrain-manager'];
            if (terrainManager) {
                // Calculate chunk position
                const hexSize = terrainManager.data.hexSize;
                const chunkSize = terrainManager.data.chunkSize;
                
                const hexWidth = hexSize * Math.sqrt(3);
                const hexHeight = hexSize * 1.5;
                
                const chunkWorldSizeX = chunkSize * hexWidth;
                const chunkWorldSizeZ = chunkSize * hexHeight;
                
                const chunkX = Math.floor(pos.x / chunkWorldSizeX);
                const chunkZ = Math.floor(pos.z / chunkWorldSizeZ);
                
                chunkDisplay.textContent = `Current Chunk: (${chunkX}, ${chunkZ})`;
                
                // Count loaded chunks
                if (terrainManager.chunkManager) {
                    const loadedChunksCount = terrainManager.chunkManager.loadedChunks.size;
                    chunksDisplay.textContent = `Loaded Chunks: ${loadedChunksCount}`;
                }
                
                // Get terrain height at current position - safely check if function exists
                if (typeof window.generateTerrainHeight === 'function') {
                    try {
                        const height = window.generateTerrainHeight(pos.x, pos.z);
                        heightDisplay.textContent = `Terrain Height: ${height.toFixed(1)}`;
                    } catch (error) {
                        console.warn("Unable to get terrain height", error);
                        heightDisplay.textContent = `Terrain Height: N/A`;
                    }
                } else {
                    heightDisplay.textContent = `Terrain Height: Function Unavailable`;
                }
            }
        }
    }, 200);
}

// Create a helper function that makes terrain height accessible to other scripts
window.getTerrainHeight = function(x, z) {
    if (typeof window.generateTerrainHeight === 'function') {
        try {
            return window.generateTerrainHeight(x, z);
        } catch (error) {
            console.warn("Error getting terrain height:", error);
            return 0;
        }
    }
    return 0;
};