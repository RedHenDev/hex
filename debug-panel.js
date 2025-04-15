// debug-panel.js - Unified debug panel system for terrain visualization
console.log("Initializing unified debug panel system...");

// Main debug panel class - singleton pattern
class DebugPanel {
    constructor() {
        // Check if instance already exists
        if (DebugPanel.instance) {
            return DebugPanel.instance;
        }
        
        // Create singleton instance
        DebugPanel.instance = this;
        
        // Panel sections and state
        this.sections = new Map();
        this.panel = null;
        this.terrainManager = null;
        this.initialized = false;
        this.visible = false; // Initialize panel as hidden
        
        // Initialize when the DOM is ready
        if (document.readyState === 'complete') {
            this.init();
        } else {
            document.addEventListener('DOMContentLoaded', () => this.init());
        }
        
        // Also initialize when terrain is ready
        document.addEventListener('terrainReady', () => {
            if (!this.initialized) {
                this.init();
            }
            this.updateAllSections();
        });
    }
    
    // Initialize the debug panel
    init() {
        try {
            console.log("Initializing debug panel...");
            
            // Create panel if it doesn't exist
            this.panel = document.getElementById('debug-panel');
            if (!this.panel) {
                this.panel = document.createElement('div');
                this.panel.id = 'debug-panel';
                
                // Position panel to leave space for toggle button
                this.panel.style.right = '60px'; // Leave space on the right
                this.panel.style.top = '10px';   // Align top with toggle button
                
                document.body.appendChild(this.panel);
                
                // Set to hidden by default
                this.panel.style.display = 'none';
            }
            
            // Create toggle button
            this.createToggleButton();
            
            // Get terrain manager component
            const terrainManagerElement = document.querySelector('[terrain-manager]');
            if (terrainManagerElement && terrainManagerElement.components) {
                this.terrainManager = terrainManagerElement.components['terrain-manager'];
            }
            
            // Initialize the panel with the main title
            this.resetPanel();
            
            // Register standard sections
            this.registerInfoSection();
            this.registerTeleportSection();
            this.registerConfigSection();
            
            // Set initialized flag
            this.initialized = true;
            console.log("Debug panel initialized successfully (hidden by default)");
        } catch (error) {
            console.error("Error initializing debug panel:", error);
        }
    }
    
    // Create toggle button for debug panel
    createToggleButton() {
        const toggleButton = document.getElementById('debug-panel-toggle');
        if (!toggleButton) {
            const button = document.createElement('button');
            button.id = 'debug-panel-toggle';
            button.innerHTML = '🥚'; // Gear icon
            button.title = 'Toggle Terrain Controls';
            
            // Style the button
            Object.assign(button.style, {
                position: 'fixed',
                top: '10px',
                right: '10px',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                border: '2px solid rgba(255, 255, 255, 0.5)',
                fontSize: '20px',
                cursor: 'pointer',
                zIndex: '999',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.3s, transform 0.2s'
            });
            
            // Add hover effect
            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = 'rgba(60, 60, 60, 0.8)';
                button.style.transform = 'scale(1.05)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                button.style.transform = 'scale(1)';
            });
            
            // Add click handler to toggle panel visibility
            button.addEventListener('click', () => this.toggleVisibility());
            
            document.body.appendChild(button);
        }
    }
    
    // Toggle panel visibility
    toggleVisibility() {
        this.visible = !this.visible;
        
        if (this.panel) {
            this.panel.style.display = this.visible ? 'block' : 'none';
            
            // Update toggle button to indicate state
            const toggleButton = document.getElementById('debug-panel-toggle');
            if (toggleButton) {
                toggleButton.style.backgroundColor = this.visible ? 
                    'rgba(60, 100, 150, 0.8)' : 'rgba(0, 0, 0, 0.6)';
                toggleButton.style.border = this.visible ? 
                    '2px solid rgba(100, 180, 255, 0.8)' : '2px solid rgba(255, 255, 255, 0.5)';
            }
            
            // If becoming visible, update all sections
            if (this.visible) {
                this.updateAllSections();
            }
        }
    }
    
    // Reset panel to initial state
    resetPanel() {
        if (!this.panel) return;
        
        // Clear panel
        this.panel.innerHTML = '';
        
        // Add main title
        const seed = this.terrainManager ? this.terrainManager.data.seed : (window.TerrainConfig ? window.TerrainConfig.seed : 'Unknown');
        const title = document.createElement('h3');
        title.textContent = `Hexagon Terrain (Seed: ${seed})`;
        title.style.margin = '0 0 10px 0';
        this.panel.appendChild(title);
    }
    
    // Register a new section with the panel
    registerSection(id, title, createContentFn, initiallyExpanded = true) {
        if (this.sections.has(id)) {
            console.warn(`Section ${id} already exists in debug panel`);
            return;
        }
        
        this.sections.set(id, {
            id,
            title,
            createContent: createContentFn,
            expanded: initiallyExpanded
        });
        
        this.renderSection(id);
    }
    
    // Render a specific section
    renderSection(id) {
        if (!this.panel || !this.sections.has(id)) return;
        
        const section = this.sections.get(id);
        
        // Check if section already exists in DOM
        let sectionElement = document.getElementById(`debug-section-${id}`);
        
        // Create section if it doesn't exist
        if (!sectionElement) {
            sectionElement = document.createElement('div');
            sectionElement.id = `debug-section-${id}`;
            sectionElement.className = 'debug-section';
            sectionElement.style.marginTop = '15px';
            sectionElement.style.borderTop = '1px solid #555';
            sectionElement.style.paddingTop = '10px';
            
            this.panel.appendChild(sectionElement);
        } else {
            // Clear existing content
            sectionElement.innerHTML = '';
        }
        
        // Create header with toggle
        const header = document.createElement('h4');
        header.textContent = section.expanded ? `${section.title} ▲` : `${section.title} ▼`;
        header.style.margin = '0 0 10px 0';
        header.style.cursor = 'pointer';
        sectionElement.appendChild(header);
        
        // Create content container
        const content = document.createElement('div');
        content.className = 'section-content';
        content.style.display = section.expanded ? 'block' : 'none';
        sectionElement.appendChild(content);
        
        // Add toggle functionality
        header.addEventListener('click', () => {
            section.expanded = !section.expanded;
            header.textContent = section.expanded ? `${section.title} ▲` : `${section.title} ▼`;
            content.style.display = section.expanded ? 'block' : 'none';
        });
        
        // Populate content
        if (section.createContent) {
            section.createContent(content, this.terrainManager);
        }
    }
    
    // Update all sections
    updateAllSections() {
        if (!this.initialized) return;
        
        // Reset panel
        this.resetPanel();
        
        // Render all sections
        for (const id of this.sections.keys()) {
            this.renderSection(id);
        }
    }
    
    // Update a specific section
    updateSection(id) {
        if (!this.initialized || !this.sections.has(id)) return;
        this.renderSection(id);
    }
    
    // Register the terrain info section
    registerInfoSection() {
        this.registerSection('info', 'Terrain Information', (container, terrainManager) => {
            // Position display
            const positionDisplay = document.createElement('div');
            positionDisplay.id = 'position-display';
            positionDisplay.textContent = 'Position: (0, 0, 0)';
            container.appendChild(positionDisplay);
            
            // Chunk display
            const chunkDisplay = document.createElement('div');
            chunkDisplay.id = 'chunk-display';
            chunkDisplay.textContent = 'Current Chunk: (0, 0)';
            container.appendChild(chunkDisplay);
            
            // Height display
            const heightDisplay = document.createElement('div');
            heightDisplay.id = 'height-display';
            heightDisplay.textContent = 'Terrain Height: 0.0';
            container.appendChild(heightDisplay);
            
            // Chunks display
            const chunksDisplay = document.createElement('div');
            chunksDisplay.id = 'chunks-display';
            chunksDisplay.textContent = 'Loaded Chunks: 0';
            container.appendChild(chunksDisplay);
            
            // Follow terrain checkbox
            const followContainer = document.createElement('div');
            followContainer.style.margin = '10px 0';
            
            const followCheck = document.createElement('input');
            followCheck.type = 'checkbox';
            followCheck.id = 'follow-terrain';
            
            if (terrainManager) {
                followCheck.checked = terrainManager.data.followTerrain;
                
                followCheck.addEventListener('change', () => {
                    terrainManager.data.followTerrain = followCheck.checked;
                });
            }
            
            const followLabel = document.createElement('label');
            followLabel.htmlFor = 'follow-terrain';
            followLabel.textContent = 'Follow Terrain';
            followLabel.style.marginLeft = '5px';
            
            followContainer.appendChild(followCheck);
            followContainer.appendChild(followLabel);
            container.appendChild(followContainer);
        });
    }
    
    // Register teleport section
    registerTeleportSection() {
        this.registerSection('teleport', 'Teleport', (container, terrainManager) => {
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
                
                if (terrainManager && terrainManager.subjectObj) {
                    button.addEventListener('click', () => {
                        const currentY = terrainManager.subjectObj.position.y;
                        terrainManager.subjectObj.position.set(loc.x, currentY, loc.z);
                    });
                }
                
                buttonContainer.appendChild(button);
            });
            
            container.appendChild(buttonContainer);
            
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
            container.appendChild(resetButton);
        });
    }
    
    // Register terrain configuration section
    registerConfigSection() {
        this.registerSection('config', 'Terrain Configuration', (container, terrainManager) => {
            try {
                // Get current config
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
                
                // Create form grid
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
                const heightScaleContainer = this.createRangeControl(
                    'Height Scale', 'heightScale', config.heightScale, 
                    1, 500, 1, config, form
                );
                
                // --- Noise Scale ---
                const noiseScaleContainer = this.createRangeControl(
                    'Noise Scale', 'noiseScale', config.noiseScale, 
                    0.001, 0.1, 0.001, config, form
                );
                
                // --- Base Height ---
                const baseHeightContainer = this.createRangeControl(
                    'Base Height', 'baseHeight', config.baseHeight, 
                    -50, 50, 0.5, config, form
                );
                
                // --- Ridge Factor ---
                const ridgeFactorContainer = this.createRangeControl(
                    'Ridge Factor', 'ridgeFactor', config.ridgeFactor, 
                    0, 1, 0.05, config, form
                );
                
                // --- Use Ridges Checkbox ---
                this.createCheckboxControl(
                    'Use Ridges', 'useRidges', config.useRidges, config, form
                );
                
                // --- Use Hexagons Checkbox ---
                this.createCheckboxControl(
                    'Use Hexagons', 'useHexagons', config.useHexagons, config, form
                );
                
                // Add the form to the container
                container.appendChild(form);
                
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
                
                generateButton.addEventListener('click', () => {
                    this.generateNewTerrain(config);
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
                
                saveConfigButton.addEventListener('click', () => {
                    this.saveConfigToLocalStorage(config);
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
                
                loadConfigButton.addEventListener('click', () => {
                    if (this.loadConfigFromLocalStorage(config, form)) {
                        alert('Configuration loaded');
                    } else {
                        alert('No saved configuration found');
                    }
                });
                
                // Add buttons to container
                buttonsContainer.appendChild(generateButton);
                buttonsContainer.appendChild(saveConfigButton);
                buttonsContainer.appendChild(loadConfigButton);
                
                container.appendChild(buttonsContainer);
            } catch (error) {
                console.error("Error creating config section:", error);
                const errorDiv = document.createElement('div');
                errorDiv.textContent = `Error: ${error.message}`;
                errorDiv.style.color = 'red';
                container.appendChild(errorDiv);
            }
        });
    }
    
    // Helper to create range control
    createRangeControl(label, id, value, min, max, step, config, parent) {
        const container = document.createElement('div');
        
        const labelElement = document.createElement('label');
        labelElement.textContent = `${label}: `;
        labelElement.style.display = 'block';
        labelElement.style.fontSize = '12px';
        
        const valueDisplay = document.createElement('span');
        valueDisplay.id = `${id}-value`;
        valueDisplay.textContent = value;
        valueDisplay.style.marginLeft = '5px';
        
        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = value;
        input.style.width = '100%';
        
        input.addEventListener('input', function() {
            valueDisplay.textContent = input.value;
            config[id] = parseFloat(input.value);
        });
        
        labelElement.appendChild(valueDisplay);
        container.appendChild(labelElement);
        container.appendChild(input);
        parent.appendChild(container);
        
        return container;
    }
    
    // Helper to create checkbox control
    createCheckboxControl(label, id, checked, config, parent) {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        
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
            config[id] = input.checked;
        });
        
        container.appendChild(input);
        container.appendChild(labelElement);
        parent.appendChild(container);
        
        return container;
    }
    
    // Save configuration to localStorage
    saveConfigToLocalStorage(config) {
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
    
    // Load configuration from localStorage
    loadConfigFromLocalStorage(config, form) {
        try {
            const savedConfig = localStorage.getItem('terrainConfig');
            if (savedConfig) {
                const parsedConfig = JSON.parse(savedConfig);
                console.log("Loaded config from localStorage:", parsedConfig);
                
                // Apply saved values to config object
                Object.assign(config, parsedConfig);
                
                // Update form controls
                this.updateFormControls(form, config);
                
                return true;
            }
            return false;
        } catch (e) {
            console.error("Error loading config from localStorage:", e);
            return false;
        }
    }
    
    // Update form controls with config values
    updateFormControls(form, config) {
        // Update range inputs
        for (const key in config) {
            // Find value displays
            const valueDisplay = document.getElementById(`${key}-value`);
            if (valueDisplay) {
                valueDisplay.textContent = config[key];
            }
            
            // Find inputs
            const input = document.getElementById(key) || form.querySelector(`input[name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = config[key];
                } else {
                    input.value = config[key];
                }
            }
        }
    }
    
    // Generate new terrain based on configuration
    generateNewTerrain(config) {
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
            
            // Get the terrain manager
            if (this.terrainManager && this.terrainManager.chunkManager) {
                console.log("Found terrain manager, applying config in-place");
                
                // Get the terrain container
                const terrainContainer = document.getElementById('terrain-container');
                if (terrainContainer) {
                    // Clear existing terrain
                    while (terrainContainer.firstChild) {
                        terrainContainer.removeChild(terrainContainer.firstChild);
                    }
                    
                    // Clear existing chunks
                    this.terrainManager.chunkManager.loadedChunks.clear();
                    
                    // Create a new terrain generator with updated config
                    this.terrainManager.chunkManager.terrainGenerator = new TerrainGenerator({
                        cubeSize: config.geometrySize,
                        seed: config.seed,
                        hex: config.useHexagons
                    });
                    
                    // Apply all configuration settings to the generator
                    window.TerrainConfig.applyToGenerator(this.terrainManager.chunkManager.terrainGenerator);
                    
                    // Update terrain
                    this.terrainManager.updateTerrain(
                        this.terrainManager.subjectObj.position.x,
                        this.terrainManager.subjectObj.position.z
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
        this.saveConfigToLocalStorage(config); // Save config so it persists through reload
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }
    
    // Update the info section with current data
    updateInfoSection(x, y, z, chunkX, chunkZ, terrainHeight, loadedChunks) {
        const positionDisplay = document.getElementById('position-display');
        if (positionDisplay) {
            positionDisplay.textContent = `Position: (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;
        }
        
        const chunkDisplay = document.getElementById('chunk-display');
        if (chunkDisplay) {
            chunkDisplay.textContent = `Current Chunk: (${chunkX}, ${chunkZ})`;
        }
        
        const heightDisplay = document.getElementById('height-display');
        if (heightDisplay) {
            heightDisplay.textContent = `Terrain Height: ${terrainHeight.toFixed(1)}`;
        }
        
        const chunksDisplay = document.getElementById('chunks-display');
        if (chunksDisplay) {
            chunksDisplay.textContent = `Loaded Chunks: ${loadedChunks}`;
        }
    }
}

// Create the global debug panel instance
window.DebugPanel = new DebugPanel();

// Debug panel is globally available via window.DebugPanel
console.log("Debug panel initialized and available globally");