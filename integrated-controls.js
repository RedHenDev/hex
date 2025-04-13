// integrated-controls.js - Combines start-terrain.js and terrain-controls.js functionalities

document.addEventListener('DOMContentLoaded', function() {
    // Wait for A-Frame to load
    if (AFRAME.components['terrain-manager']) {
        // Store the original setupDebugPanel function
        const originalSetupDebugPanel = AFRAME.components['terrain-manager'].prototype.setupDebugPanel;
    
        // Replace it with our enhanced version that adds both existing and new controls
        AFRAME.components['terrain-manager'].prototype.setupDebugPanel = function() {
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
                title.textContent = `Hexagon Terrain (Seed: ${this.data.seed})`;
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
                
                // Add original texture controls
                addTextureControls(panel, this);
                
                // Add our new terrain configuration controls
                addTerrainConfigControls(panel, this);
                
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
        };
    } else {
        console.warn('terrain-manager component not found, waiting for it to be registered...');
        // Try again after components are registered
        document.addEventListener('loaded', function() {
            if (AFRAME.components['terrain-manager']) {
                const originalSetupDebugPanel = AFRAME.components['terrain-manager'].prototype.setupDebugPanel;
                // ... (same code as above)
            }
        });
    }
});

// Hide loading screen when terrain is ready
document.addEventListener('terrainReady', function() {
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }, 1000);
});

// Main function to add terrain configuration controls
function addTerrainConfigControls(panel, terrainManager) {
    // Create a collapsible section for terrain controls
    const terrainControlsSection = document.createElement('div');
    terrainControlsSection.className = 'control-section';
    terrainControlsSection.style.marginTop = '15px';
    
    // Add header with toggle functionality
    const header = document.createElement('h4');
    header.textContent = 'Terrain Configuration';
    header.style.margin = '10px 0 5px 0';
    header.style.cursor = 'pointer';
    header.style.userSelect = 'none';
    header.innerHTML += ' <span style="font-size: 10px">▼</span>';
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'section-content';
    content.style.display = 'none'; // Start collapsed
    
    // Toggle visibility when header is clicked
    header.addEventListener('click', function() {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            header.innerHTML = 'Terrain Configuration <span style="font-size: 10px">▲</span>';
        } else {
            content.style.display = 'none';
            header.innerHTML = 'Terrain Configuration <span style="font-size: 10px">▼</span>';
        }
    });
    
    terrainControlsSection.appendChild(header);
    terrainControlsSection.appendChild(content);
    
    // Get current config from window.TerrainConfig or create default
    const config = window.TerrainConfig || {
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
    
    // Create a form to hold all controls
    const form = document.createElement('form');
    form.onsubmit = function(e) { e.preventDefault(); }; // Prevent form submission
    form.style.display = 'grid';
    form.style.gridTemplateColumns = '1fr 1fr';
    form.style.gap = '8px';
    form.style.marginBottom = '10px';
    
    // ===== Add controls for terrain parameters =====
    
    // --- General terrain settings ---
    addSectionHeader(form, 'General Settings', 2);
    
    // Seed
    addNumberControl(form, 'seed', 'Seed', config.seed, 0, 999999, 1, (value) => {
        config.seed = parseInt(value);
    });
    
    // Height Scale
    addNumberControl(form, 'heightScale', 'Height Scale', config.heightScale, 1, 500, 1, (value) => {
        config.heightScale = parseFloat(value);
    });
    
    // Noise Scale (smaller steps because it's a small number)
    addNumberControl(form, 'noiseScale', 'Noise Scale', config.noiseScale, 0.001, 0.1, 0.001, (value) => {
        config.noiseScale = parseFloat(value);
    });
    
    // Base Height
    addNumberControl(form, 'baseHeight', 'Base Height', config.baseHeight, 0, 1, 0.05, (value) => {
        config.baseHeight = parseFloat(value);
    });
    
    // --- Terrain feature settings ---
    addSectionHeader(form, 'Feature Settings', 2);
    
    // Use Ridges
    addCheckboxControl(form, 'useRidges', 'Use Ridges', config.useRidges, (checked) => {
        config.useRidges = checked;
    });
    
    // Ridge Factor
    addNumberControl(form, 'ridgeFactor', 'Ridge Factor', config.ridgeFactor, 0, 1, 0.05, (value) => {
        config.ridgeFactor = parseFloat(value);
    });
    
    // Color Variation
    addNumberControl(form, 'colorVariation', 'Color Variation', config.colorVariation, 0, 1, 0.05, (value) => {
        config.colorVariation = parseFloat(value);
    });
    
    // --- Noise algorithm settings ---
    addSectionHeader(form, 'Noise Settings', 2);
    
    // Octaves
    addNumberControl(form, 'octaves', 'Octaves', config.octaves, 1, 16, 1, (value) => {
        config.octaves = parseInt(value);
    });
    
    // Ridge Octaves
    addNumberControl(form, 'ridgeOctaves', 'Ridge Octaves', config.ridgeOctaves, 1, 16, 1, (value) => {
        config.ridgeOctaves = parseInt(value);
    });
    
    // Lacunarity
    addNumberControl(form, 'lacunarity', 'Lacunarity', config.lacunarity, 1, 4, 0.1, (value) => {
        config.lacunarity = parseFloat(value);
    });
    
    // Gain
    addNumberControl(form, 'gain', 'Gain', config.gain, 0, 1, 0.05, (value) => {
        config.gain = parseFloat(value);
    });
    
    // --- Geometry settings ---
    addSectionHeader(form, 'Geometry Settings', 2);
    
    // Use Hexagons
    addCheckboxControl(form, 'useHexagons', 'Use Hexagons', config.useHexagons, (checked) => {
        config.useHexagons = checked;
    });
    
    // Geometry Size
    addNumberControl(form, 'geometrySize', 'Geometry Size', config.geometrySize, 0.1, 2, 0.025, (value) => {
        config.geometrySize = parseFloat(value);
    });
    
    // --- Chunk system settings ---
    addSectionHeader(form, 'Chunk Settings', 2);
    
    // Chunk Size
    addNumberControl(form, 'chunkSize', 'Chunk Size', config.chunkSize, 4, 32, 1, (value) => {
        config.chunkSize = parseInt(value);
    });
    
    // Load Distance
    addNumberControl(form, 'loadDistance', 'Load Distance', config.loadDistance, 50, 300, 10, (value) => {
        config.loadDistance = parseFloat(value);
    });
    
    // Unload Distance
    addNumberControl(form, 'unloadDistance', 'Unload Distance', config.unloadDistance, 50, 400, 10, (value) => {
        config.unloadDistance = parseFloat(value);
    });
    
    // Add the form to the content
    content.appendChild(form);
    
    // Add buttons for applying changes and resetting to defaults
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.margin = '10px 0';
    
    // Generate new terrain button
    const generateButton = document.createElement('button');
    generateButton.textContent = 'Generate New Terrain';
    generateButton.style.cssText = `
        background: #335533;
        color: white;
        border: 1px solid #555;
        padding: 8px;
        cursor: pointer;
        border-radius: 3px;
        flex: 1;
    `;
    generateButton.addEventListener('click', function() {
        applyTerrainConfig(config, terrainManager);
    });
    
    // Reset to defaults
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset to Defaults';
    resetButton.style.cssText = `
        background: #553333;
        color: white;
        border: 1px solid #555;
        padding: 8px;
        cursor: pointer;
        border-radius: 3px;
        flex: 1;
    `;
    resetButton.addEventListener('click', function() {
        resetToDefaults(form, config);
    });
    
    buttonContainer.appendChild(generateButton);
    buttonContainer.appendChild(resetButton);
    content.appendChild(buttonContainer);
    
    // Add export/import buttons
    const exportImportContainer = document.createElement('div');
    exportImportContainer.style.display = 'flex';
    exportImportContainer.style.gap = '8px';
    exportImportContainer.style.margin = '10px 0';
    
    // Export config
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export Config';
    exportButton.style.cssText = `
        background: #333355;
        color: white;
        border: 1px solid #555;
        padding: 8px;
        cursor: pointer;
        border-radius: 3px;
        flex: 1;
    `;
    exportButton.addEventListener('click', function() {
        exportConfig(config);
    });
    
    // Import config
    const importButton = document.createElement('button');
    importButton.textContent = 'Import Config';
    importButton.style.cssText = `
        background: #333355;
        color: white;
        border: 1px solid #555;
        padding: 8px;
        cursor: pointer;
        border-radius: 3px;
        flex: 1;
    `;
    importButton.addEventListener('click', function() {
        importConfig(form, config);
    });
    
    exportImportContainer.appendChild(exportButton);
    exportImportContainer.appendChild(importButton);
    content.appendChild(exportImportContainer);
    
    // Add to debug panel
    panel.appendChild(terrainControlsSection);
}

// Helper function to add a section header to the form
function addSectionHeader(form, title, colspan) {
    const header = document.createElement('div');
    header.textContent = title;
    header.style.fontWeight = 'bold';
    header.style.borderBottom = '1px solid #555';
    header.style.marginTop = '10px';
    header.style.gridColumn = `span ${colspan}`;
    form.appendChild(header);
}

// Helper function to add a number input control
function addNumberControl(form, id, label, value, min, max, step, onChange) {
    const controlContainer = document.createElement('div');
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    labelElement.style.display = 'block';
    labelElement.style.marginBottom = '3px';
    labelElement.style.fontSize = '12px';
    
    const valueDisplay = document.createElement('span');
    valueDisplay.id = `${id}-value`;
    valueDisplay.textContent = value;
    valueDisplay.style.fontSize = '12px';
    valueDisplay.style.marginLeft = '5px';
    
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    input.style.width = '100%';
    
    input.addEventListener('input', function() {
        valueDisplay.textContent = input.value;
        onChange(input.value);
    });
    
    labelElement.appendChild(valueDisplay);
    controlContainer.appendChild(labelElement);
    controlContainer.appendChild(input);
    form.appendChild(controlContainer);
    
    return input;
}

// Helper function to add a checkbox control
function addCheckboxControl(form, id, label, checked, onChange) {
    const controlContainer = document.createElement('div');
    controlContainer.style.display = 'flex';
    controlContainer.style.alignItems = 'center';
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = checked;
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    labelElement.style.marginLeft = '5px';
    labelElement.style.fontSize = '12px';
    
    input.addEventListener('change', function() {
        onChange(input.checked);
    });
    
    controlContainer.appendChild(input);
    controlContainer.appendChild(labelElement);
    form.appendChild(controlContainer);
    
    return input;
}

// Function to apply terrain configuration and regenerate terrain
function applyTerrainConfig(config, terrainManager) {
    // Update the global TerrainConfig
    window.TerrainConfig = config;
    
    // Show loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';
    }
    
    // Re-initialize the terrain system
    setTimeout(() => {
        try {
            // Get the terrain container
            const terrainContainer = document.getElementById('terrain-container');
            if (terrainContainer) {
                // Clear existing terrain
                while (terrainContainer.firstChild) {
                    terrainContainer.removeChild(terrainContainer.firstChild);
                }
                
                // Reinitialize the terrain manager
                if (terrainManager.chunkManager) {
                    // Clear existing chunks
                    terrainManager.chunkManager.loadedChunks.clear();
                    
                    // Create a new terrain generator with updated config
                    terrainManager.chunkManager.terrainGenerator = new TerrainGenerator({
                        cubeSize: config.geometrySize,
                        seed: config.seed,
                        hex: config.useHexagons
                    });
                    
                    // Apply all configuration settings to the generator
                    if (config.applyToGenerator) {
                        config.applyToGenerator(terrainManager.chunkManager.terrainGenerator);
                    } else {
                        // Apply settings manually
                        const generator = terrainManager.chunkManager.terrainGenerator;
                        generator.heightScale = config.heightScale;
                        generator.noiseScale = config.noiseScale;
                        generator.baseHeight = config.baseHeight;
                        generator.octaves = config.octaves;
                        generator.ridgeOctaves = config.ridgeOctaves;
                        generator.useRidges = config.useRidges;
                        generator.ridgeFactor = config.ridgeFactor;
                        generator.seed = config.seed;
                        generator.hex = config.useHexagons;
                        generator.cubeSize = config.geometrySize;
                        generator.colorVariation = config.colorVariation;
                    }
                    
                    // Update terrain
                    terrainManager.updateTerrain(
                        terrainManager.subjectObj.position.x,
                        terrainManager.subjectObj.position.z
                    );
                }
            }
            
            // Hide loading screen after a short delay
            setTimeout(() => {
                if (loadingScreen) {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                    }, 500);
                }
                
                // Update the debug panel
                terrainManager.setupDebugPanel();
                
                // Dispatch terrain ready event
                const event = new CustomEvent('terrainReady');
                document.dispatchEvent(event);
            }, 1000);
            
        } catch (error) {
            console.error('Error applying terrain config:', error);
            
            // Hide loading screen in case of error
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }
    }, 100);
}

// Function to reset configuration to defaults
function resetToDefaults(form, config) {
    // Reset to default values
    const defaults = {
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
    
    // Update all form controls
    for (const key in defaults) {
        const input = form.querySelector(`#${key}`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = defaults[key];
                config[key] = defaults[key];
            } else if (input.type === 'range') {
                input.value = defaults[key];
                const valueDisplay = document.getElementById(`${key}-value`);
                if (valueDisplay) {
                    valueDisplay.textContent = defaults[key];
                }
                config[key] = defaults[key];
            }
        }
    }
    
    // Copy defaults to config object
    Object.assign(config, defaults);
}

// Function to export configuration to JSON
function exportConfig(config) {
    try {
        // Create a copy of the config without the function
        const exportConfig = { ...config };
        delete exportConfig.applyToGenerator;
        
        // Convert to JSON
        const jsonConfig = JSON.stringify(exportConfig, null, 2);
        
        // Create a blob and download link
        const blob = new Blob([jsonConfig], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'terrain-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('Config exported successfully');
    } catch (error) {
        console.error('Error exporting config:', error);
        alert('Error exporting configuration');
    }
}

// Function to import configuration from JSON
function importConfig(form, config) {
    try {
        // Create file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json';
        
        fileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedConfig = JSON.parse(e.target.result);
                    
                    // Update config object and form controls
                    for (const key in importedConfig) {
                        if (config.hasOwnProperty(key)) {
                            config[key] = importedConfig[key];
                            
                            // Update form control
                            const input = form.querySelector(`#${key}`);
                            if (input) {
                                if (input.type === 'checkbox') {
                                    input.checked = importedConfig[key];
                                } else if (input.type === 'range') {
                                    input.value = importedConfig[key];
                                    const valueDisplay = document.getElementById(`${key}-value`);
                                    if (valueDisplay) {
                                        valueDisplay.textContent = importedConfig[key];
                                    }
                                }
                            }
                        }
                    }
                    
                    console.log('Config imported successfully');
                } catch (error) {
                    console.error('Error parsing imported config:', error);
                    alert('Error importing configuration: Invalid JSON format');
                }
            };
            reader.readAsText(file);
        });
        
        fileInput.click();
    } catch (error) {
        console.error('Error importing config:', error);
        alert('Error importing configuration');
    }
}
