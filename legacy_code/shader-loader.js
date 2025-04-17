// Global object to store loaded shaders
window.TerrainShaders = {
    vertexShader: null,
    fragmentShader: null,
    loaded: false,
    onLoadCallbacks: []
};

// Function to load shader files
function loadShaders() {
    let vertexLoaded = false;
    let fragmentLoaded = false;
    
    // Load vertex shader
    fetch('hexagon.vert')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load vertex shader: ${response.statusText}`);
            }
            return response.text();
        })
        .then(vertexCode => {
            window.TerrainShaders.vertexShader = vertexCode;
            vertexLoaded = true;
            checkIfBothLoaded();
        })
        .catch(error => {
            console.error('Error loading vertex shader:', error);
        });
    
    // Load fragment shader
    fetch('hexagon.frag')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load fragment shader: ${response.statusText}`);
            }
            return response.text();
        })
        .then(fragmentCode => {
            window.TerrainShaders.fragmentShader = fragmentCode;
            fragmentLoaded = true;
            checkIfBothLoaded();
        })
        .catch(error => {
            console.error('Error loading fragment shader:', error);
        });
    
    // Check if both shaders are loaded
    function checkIfBothLoaded() {
        if (vertexLoaded && fragmentLoaded) {
            window.TerrainShaders.loaded = true;
            // Call all registered callbacks
            window.TerrainShaders.onLoadCallbacks.forEach(callback => {
                try {
                    callback();
                } catch (e) {
                    console.error('Error in shader load callback:', e);
                }
            });
        }
    }
}

// Function to wait for shaders to load
window.waitForShaders = function(callback) {
    if (window.TerrainShaders.loaded) {
        callback();
    } else {
        window.TerrainShaders.onLoadCallbacks.push(callback);
    }
};

// Start loading shaders immediately
loadShaders();