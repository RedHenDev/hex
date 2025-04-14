// direct-terrain-controls.js - Directly adds terrain controls to the debug panel

console.log("Loading direct terrain controls...");

// Function to add terrain configuration controls to existing debug panel
function addTerrainConfigToPanel() {
    console.log("Attempting to add terrain config controls to debug panel...");
    
    // Find the debug panel
    const panel = document.getElementById('debug-panel');
    if (!panel) {
        console.error("Debug panel not found, will retry in 1 second");
        setTimeout(addTerrainConfigToPanel, 1000);
        return;
    }
    
    console.log("Debug panel found, adding terrain controls");
    
    // Check if we've already added terrain controls
    if (panel.querySelector('.terrain-config-section')) {
        console.log("Terrain controls already exist, skipping");
        return;
    }
    
    // Create a section for terrain controls
    const terrainSection = document.createElement('div');
    terrainSection.className = 'terrain-config-section';
    terrainSection.style.marginTop = '15px';
    terrainSection.style.borderTop = '1px solid #555';
    terrainSection.style.paddingTop = '10px';
    
    // Add title
    const title = document.createElement('h4');
    title.textContent = 'Terrain Configuration';
    title.style.margin = '0 0 10px 0';
    title.style.cursor = 'pointer';
    terrainSection.appendChild(title);
    
    // Content container (initially visible)
    const content = document.createElement('div');
    content.className = 'config-content';
    
    // Toggle visibility when title is clicked
    title.addEventListener('click', function() {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            title.innerHTML = 'Terrain Configuration ▲';
        } else {
            content.style.display = 'none';
            title.innerHTML = 'Terrain Configuration ▼';
        }
    });
    
    // Get current terrain configuration from TerrainConfig rather than localStorage
    // Always prioritize the default config from terrain-system.js
    const config = { ...window.TerrainConfig } || {
        seed: 99,
        heightScale: 128.0,
        noiseScale: 0.008,
        baseHeight: 0.2,
        useRidges: true,
        ridgeFactor: 0.3,
        octaves: 8,
        ridgeOctaves: 4,
        lacunarity: 2.0,
        gain: 0.5,
        useHexagons: true,
        geometrySize: 0.975,
        chunkSize: 8,
        loadDistance: 100,
        unloadDistance: 150,
        colorVariation: 0.8
    };
    
    // Create a simple form with key controls
    const form = document.createElement('div');
    form.style.display = 'grid';
    form.style.gridTemplateColumns = '1fr';
    form.style.gap = '8px';
    form.style.marginBottom = '10px';
    
    // --- Seed ---
    const seedContainer = document.createElement('div');
    
    const seedLabel = document.createElement('label');
    seedLabel.textContent = 'Seed: ';
    seedLabel.style.display = 'block';
    seedLabel.style.fontSize = '12px';
    
    const seedInput = document.createElement('input');
    seedInput.type = 'number';
    seedInput.min = '0';
    seedInput.max = '999999';
    seedInput.step = '1';
    seedInput.value = config.seed;
    seedInput.style.width = '100%';
    
    seedInput.addEventListener('input', function() {
        config.seed = parseInt(seedInput.value);
    });
    
    seedContainer.appendChild(seedLabel);
    seedContainer.appendChild(seedInput);
    form.appendChild(seedContainer);
    
    // --- Height Scale ---
    const heightScaleContainer = document.createElement('div');
    
    const heightScaleLabel = document.createElement('label');
    heightScaleLabel.textContent = 'Height Scale: ';
    heightScaleLabel.style.display = 'block';
    heightScaleLabel.style.fontSize = '12px';
    
    const heightScaleValue = document.createElement('span');
    heightScaleValue.id = 'heightScale-value';
    heightScaleValue.textContent = config.heightScale;
    heightScaleValue.style.marginLeft = '5px';
    
    const heightScaleInput = document.createElement('input');
    heightScaleInput.type = 'range';
    heightScaleInput.min = '1';
    heightScaleInput.max = '500';
    heightScaleInput.step = '1';
    heightScaleInput.value = config.heightScale;
    heightScaleInput.style.width = '100%';
    
    heightScaleInput.addEventListener('input', function() {
        heightScaleValue.textContent = heightScaleInput.value;
        config.heightScale = parseFloat(heightScaleInput.value);
    });
    
    heightScaleLabel.appendChild(heightScaleValue);
    heightScaleContainer.appendChild(heightScaleLabel);
    heightScaleContainer.appendChild(heightScaleInput);
    form.appendChild(heightScaleContainer);
    
    // --- Noise Scale ---
    const noiseScaleContainer = document.createElement('div');
    
    const noiseScaleLabel = document.createElement('label');
    noiseScaleLabel.textContent = 'Noise Scale: ';
    noiseScaleLabel.style.display = 'block';
    noiseScaleLabel.style.fontSize = '12px';
    
    const noiseScaleValue = document.createElement('span');
    noiseScaleValue.id = 'noiseScale-value';
    noiseScaleValue.textContent = config.noiseScale;
    noiseScaleValue.style.marginLeft = '5px';
    
    const noiseScaleInput = document.createElement('input');
    noiseScaleInput.type = 'range';
    noiseScaleInput.min = '0.001';
    noiseScaleInput.max = '0.1';
    noiseScaleInput.step = '0.001';
    noiseScaleInput.value = config.noiseScale;
    noiseScaleInput.style.width = '100%';
    
    noiseScaleInput.addEventListener('input', function() {
        noiseScaleValue.textContent = noiseScaleInput.value;
        config.noiseScale = parseFloat(noiseScaleInput.value);
    });
    
    noiseScaleLabel.appendChild(noiseScaleValue);
    noiseScaleContainer.appendChild(noiseScaleLabel);
    noiseScaleContainer.appendChild(noiseScaleInput);
    form.appendChild(noiseScaleContainer);
    
    // --- Base Height ---
    const baseHeightContainer = document.createElement('div');
    
    const baseHeightLabel = document.createElement('label');
    baseHeightLabel.textContent = 'Base Height: ';
    baseHeightLabel.style.display = 'block';
    baseHeightLabel.style.fontSize = '12px';
    
    const baseHeightValue = document.createElement('span');
    baseHeightValue.id = 'baseHeight-value';
    baseHeightValue.textContent = config.baseHeight;
    baseHeightValue.style.marginLeft = '5px';
    
    const baseHeightInput = document.createElement('input');
    baseHeightInput.type = 'range';
    baseHeightInput.min = '0';
    baseHeightInput.max = '1';
    baseHeightInput.step = '0.05';
    baseHeightInput.value = config.baseHeight;
    baseHeightInput.style.width = '100%';
    
    baseHeightInput.addEventListener('input', function() {
        baseHeightValue.textContent = baseHeightInput.value;
        config.baseHeight = parseFloat(baseHeightInput.value);
    });
    
    baseHeightLabel.appendChild(baseHeightValue);
    baseHeightContainer.appendChild(baseHeightLabel);
    baseHeightContainer.appendChild(baseHeightInput);
    form.appendChild(baseHeightContainer);
    
    // --- Ridge Factor ---
    const ridgeFactorContainer = document.createElement('div');
    
    const ridgeFactorLabel = document.createElement('label');
    ridgeFactorLabel.textContent = 'Ridge Factor: ';
    ridgeFactorLabel.style.display = 'block';
    ridgeFactorLabel.style.fontSize = '12px';
    
    const ridgeFactorValue = document.createElement('span');
    ridgeFactorValue.id = 'ridgeFactor-value';
    ridgeFactorValue.textContent = config.ridgeFactor;
    ridgeFactorValue.style.marginLeft = '5px';
    
    const ridgeFactorInput = document.createElement('input');
    ridgeFactorInput.type = 'range';
    ridgeFactorInput.min = '0';
    ridgeFactorInput.max = '1';
    ridgeFactorInput.step = '0.05';
    ridgeFactorInput.value = config.ridgeFactor;
    ridgeFactorInput.style.width = '100%';
    
    ridgeFactorInput.addEventListener('input', function() {
        ridgeFactorValue.textContent = ridgeFactorInput.value;
        config.ridgeFactor = parseFloat(ridgeFactorInput.value);
    });
    
    ridgeFactorLabel.appendChild(ridgeFactorValue);
    ridgeFactorContainer.appendChild(ridgeFactorLabel);
    ridgeFactorContainer.appendChild(ridgeFactorInput);
    form.appendChild(ridgeFactorContainer);
    
    // --- Use Ridges Checkbox ---
    const ridgesContainer = document.createElement('div');
    ridgesContainer.style.display = 'flex';
    ridgesContainer.style.alignItems = 'center';
    
    const ridgesInput = document.createElement('input');
    ridgesInput.type = 'checkbox';
    ridgesInput.id = 'useRidges';
    ridgesInput.checked = config.useRidges;
    
    const ridgesLabel = document.createElement('label');
    ridgesLabel.htmlFor = 'useRidges';
    ridgesLabel.textContent = 'Use Ridges';
    ridgesLabel.style.marginLeft = '5px';
    ridgesLabel.style.fontSize = '12px';
    
    ridgesInput.addEventListener('change', function() {
        config.useRidges = ridgesInput.checked;
    });
    
    ridgesContainer.appendChild(ridgesInput);
    ridgesContainer.appendChild(ridgesLabel);
    form.appendChild(ridgesContainer);
    
    // --- Use Hexagons Checkbox ---
    const hexContainer = document.createElement('div');
    hexContainer.style.display = 'flex';
    hexContainer.style.alignItems = 'center';
    
    const hexInput = document.createElement('input');
    hexInput.type = 'checkbox';
    hexInput.id = 'useHexagons';
    hexInput.checked = config.useHexagons;
    
    const hexLabel = document.createElement('label');
    hexLabel.htmlFor = 'useHexagons';
    hexLabel.textContent = 'Use Hexagons';
    hexLabel.style.marginLeft = '5px';
    hexLabel.style.fontSize = '12px';
    
    hexInput.addEventListener('change', function() {
        config.useHexagons = hexInput.checked;
    });
    
    hexContainer.appendChild(hexInput);
    hexContainer.appendChild(hexLabel);
    form.appendChild(hexContainer);
    
    // Add the form to the content container
    content.appendChild(form);
    
    // Add buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'grid';
    buttonsContainer.style.gridTemplateColumns = '1fr 1fr';
    buttonsContainer.style.gap = '8px';
    buttonsContainer.style.marginTop = '10px';
    
    // Add generate terrain button
    const generateButton = document.createElement('button');
    generateButton.textContent = 'Generate New Terrain';
    generateButton.style.cssText = `
        background: #335533;
        color: white;
        border: 1px solid #555;
        padding: 8px;
        cursor: pointer;
        border-radius: 3px;
        width: 100%;
    `;
    
    generateButton.addEventListener('click', function() {
        generateNewTerrain(config);
    });
    
    // Add save/load configuration buttons
    const saveConfigButton = document.createElement('button');
    saveConfigButton.textContent = 'Save Config';
    saveConfigButton.style.cssText = `
        background: #333355;
        color: white;
        border: 1px solid #555;
        padding: 8px;
        cursor: pointer;
        border-radius: 3px;
        width: 100%;
    `;
    
    saveConfigButton.addEventListener('click', function() {
        saveConfigToLocalStorage(config);
        alert('Configuration saved');
    });
    
    const loadConfigButton = document.createElement('button');
    loadConfigButton.textContent = 'Load Saved Config';
    loadConfigButton.style.cssText = `
        background: #553333;
        color: white;
        border: 1px solid #555;
        padding: 8px;
        cursor: pointer;
        border-radius: 3px;
        width: 100%;
    `;
    
    loadConfigButton.addEventListener('click', function() {
        if (loadConfigFromLocalStorage(config, form)) {
            alert('Configuration loaded');
        } else {
            alert('No saved configuration found');
        }
    });
    
    // Add buttons to container
    buttonsContainer.appendChild(generateButton);
    buttonsContainer.appendChild(saveConfigButton);
    buttonsContainer.appendChild(loadConfigButton);
    
    content.appendChild(buttonsContainer);
    
    // Add everything to the terrain section
    terrainSection.appendChild(content);
    
    // Add to debug panel
    panel.appendChild(terrainSection);
    console.log("Terrain controls added successfully");
}

// Function to save configuration to localStorage
function saveConfigToLocalStorage(config) {
    try {
        // Make a copy without any functions
        const configForStorage = { ...config };
        delete configForStorage.applyToGenerator;
        
        localStorage.setItem('terrainConfig', JSON.stringify(configForStorage));
        console.log("Config saved to localStorage:", configForStorage);
        return true;
    } catch (e) {
        console.error("Error saving config to localStorage:", e);
        return false;
    }
}

// Function to load configuration from localStorage
function loadConfigFromLocalStorage(config, form) {
    try {
        const savedConfig = localStorage.getItem('terrainConfig');
        if (savedConfig) {
            const parsedConfig = JSON.parse(savedConfig);
            console.log("Loaded config from localStorage:", parsedConfig);
            
            // Apply saved values to config object
            Object.assign(config, parsedConfig);
            
            // Update form controls with loaded values
            updateFormControls(form, config);
            
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error loading config from localStorage:", e);
        return false;
    }
}

// Function to update form controls with config values
function updateFormControls(form, config) {
    // Update range inputs
    ['seed', 'heightScale', 'noiseScale', 'baseHeight', 'ridgeFactor'].forEach(key => {
        const input = form.querySelector(`#${key}`) || form.querySelector(`input[type="number"][value="${config[key]}"]`);
        if (input) {
            input.value = config[key];
            
            // Update value display for sliders
            const valueDisplay = document.getElementById(`${key}-value`);
            if (valueDisplay) {
                valueDisplay.textContent = config[key];
            }
        }
    });
    
    // Update checkboxes
    ['useRidges', 'useHexagons'].forEach(key => {
        const checkbox = document.getElementById(key);
        if (checkbox) {
            checkbox.checked = config[key];
        }
    });
}

// Function to generate new terrain based on configuration
function generateNewTerrain(config) {
    console.log("Generating new terrain with config:", config);
    
    // Show loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';
    }
    
    // Try to apply config in-place
    try {
        // Apply config to global TerrainConfig
        Object.assign(window.TerrainConfig, config);
        
        // Get the terrain manager component
        const terrainManager = document.querySelector('[terrain-manager]').components['terrain-manager'];
        if (terrainManager && terrainManager.chunkManager) {
            console.log("Found terrain manager, applying config in-place");
            
            // Get the terrain container
            const terrainContainer = document.getElementById('terrain-container');
            if (terrainContainer) {
                // Clear existing terrain
                while (terrainContainer.firstChild) {
                    terrainContainer.removeChild(terrainContainer.firstChild);
                }
                
                // Clear existing chunks
                terrainManager.chunkManager.loadedChunks.clear();
                
                // Create a new terrain generator with updated config
                terrainManager.chunkManager.terrainGenerator = new TerrainGenerator({
                    cubeSize: config.geometrySize,
                    seed: config.seed,
                    hex: config.useHexagons
                });
                
                // Apply all configuration settings to the generator
                window.TerrainConfig.applyToGenerator(terrainManager.chunkManager.terrainGenerator);
                
                // Update terrain
                terrainManager.updateTerrain(
                    terrainManager.subjectObj.position.x,
                    terrainManager.subjectObj.position.z
                );
                
                // Hide loading screen after a short delay
                setTimeout(() => {
                    if (loadingScreen) {
                        loadingScreen.style.opacity = '0';
                        setTimeout(() => {
                            loadingScreen.style.display = 'none';
                        }, 500);
                    }
                    
                    // Dispatch terrain ready event
                    const event = new CustomEvent('terrainReady');
                    document.dispatchEvent(event);
                }, 1000);
                
                return; // Successfully applied in-place
            }
        }
    } catch (e) {
        console.error("Error applying config in-place:", e);
    }
    
    // If in-place application failed, reload the page
    console.log("Falling back to page reload to apply config");
    saveConfigToLocalStorage(config); // Save config so it persists through reload
    setTimeout(() => {
        window.location.reload();
    }, 500);
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM content loaded, waiting for debug panel...");
    
    // Wait a bit to ensure debug panel is created by original code
    setTimeout(addTerrainConfigToPanel, 2000);
});

// Also listen for terrain ready event to add controls
document.addEventListener('terrainReady', function() {
    console.log("Terrain ready event received, adding controls...");
    setTimeout(addTerrainConfigToPanel, 500);
});