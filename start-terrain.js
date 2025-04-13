// Wait for scene to be loaded and then modify the TerrainManager prototype
document.addEventListener('DOMContentLoaded', function() {
    // Wait for A-Frame to load
    if (AFRAME.components['terrain-manager']) {
        // Store the original setupDebugPanel function
        const originalSetupDebugPanel = AFRAME.components['terrain-manager'].prototype.setupDebugPanel;
    
        // Replace it with our enhanced version
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
                
                // Add our texture controls
                addTextureControls(panel, this);
                
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