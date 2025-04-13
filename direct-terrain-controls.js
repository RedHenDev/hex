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
    
    // Get current terrain configuration
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
    
    // Create a simple form with key controls
    const form = document.createElement('div');
    form.style.display = 'grid';
    form.style.gridTemplateColumns = '1fr';
    form.style.gap = '8px';
    form.style.marginBottom = '10px';
    
    // Add some key terrain controls
    
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
        margin-top: 10px;
    `;
    
    generateButton.addEventListener('click', function() {
        // Show loading screen
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            loadingScreen.style.opacity = '1';
        }
        
        // Apply configuration changes
        window.TerrainConfig = config;
        
        // Simply reload the page to apply changes
        setTimeout(() => {
            window.location.reload();
        }, 500);
    });
    
    content.appendChild(generateButton);
    
    // Add everything to the terrain section
    terrainSection.appendChild(content);
    
    // Add to debug panel
    panel.appendChild(terrainSection);
    console.log("Terrain controls added successfully");
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
