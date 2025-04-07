// Global object to store loaded shaders
window.TerrainShaders = {
    vertexShader: null,
    fragmentShader: null,
    loaded: false,
    onLoad: null,
    loadPromise: null
};

// Function to load shader files
function loadShaders() {
    // Create a promise to track when both shaders are loaded
    window.TerrainShaders.loadPromise = new Promise((resolve, reject) => {
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
                checkIfBothLoaded();
            })
            .catch(error => {
                console.error('Error loading vertex shader:', error);
                reject(error);
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
                checkIfBothLoaded();
            })
            .catch(error => {
                console.error('Error loading fragment shader:', error);
                reject(error);
            });
        
        // Check if both shaders are loaded
        function checkIfBothLoaded() {
            if (window.TerrainShaders.vertexShader && window.TerrainShaders.fragmentShader) {
                window.TerrainShaders.loaded = true;
                if (window.TerrainShaders.onLoad) {
                    window.TerrainShaders.onLoad();
                }
                resolve();
            }
        }
    });
    
    return window.TerrainShaders.loadPromise;
}

// Start loading shaders immediately
loadShaders();

// Function to wait for shaders to load
window.waitForShaders = function(callback) {
    if (window.TerrainShaders.loaded) {
        callback();
    } else {
        window.TerrainShaders.onLoad = callback;
    }
};

// Alternative function using Promise
window.getShaders = function() {
    return window.TerrainShaders.loadPromise.then(() => {
        return {
            vertexShader: window.TerrainShaders.vertexShader,
            fragmentShader: window.TerrainShaders.fragmentShader
        };
    });
};