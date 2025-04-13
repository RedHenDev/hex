// Enhanced texture controls with diagnostic information
function addTextureControls(panel, terrainManager) {
    // Create a texture control section
    const textureHeading = document.createElement('h4');
    textureHeading.textContent = 'Texture Controls:';
    textureHeading.style.margin = '10px 0 5px 0';
    panel.appendChild(textureHeading);
    
    // Add texture status indicator
    const textureStatus = document.createElement('div');
    textureStatus.id = 'texture-status';
    textureStatus.textContent = 'Texture Status: Loading...';
    textureStatus.style.marginBottom = '8px';
    textureStatus.style.color = '#ffcc00';
    panel.appendChild(textureStatus);
    
    // Create texture controls container
    const textureControls = document.createElement('div');
    textureControls.style.marginBottom = '10px';
    
    // Toggle texture on/off
    const textureToggleContainer = document.createElement('div');
    textureToggleContainer.style.marginBottom = '8px';
    
    const textureToggle = document.createElement('input');
    textureToggle.type = 'checkbox';
    textureToggle.id = 'texture-toggle';
    textureToggle.checked = true;
    textureToggle.disabled = true; // Disabled until texture is loaded
    
    const textureToggleLabel = document.createElement('label');
    textureToggleLabel.htmlFor = 'texture-toggle';
    textureToggleLabel.textContent = 'Enable Texture';
    textureToggleLabel.style.marginLeft = '5px';
    
    textureToggleContainer.appendChild(textureToggle);
    textureToggleContainer.appendChild(textureToggleLabel);
    textureControls.appendChild(textureToggleContainer);
    
    // Texture scale slider
    const textureScaleContainer = document.createElement('div');
    textureScaleContainer.style.marginBottom = '8px';
    
    const textureScaleLabel = document.createElement('label');
    textureScaleLabel.htmlFor = 'texture-scale';
    textureScaleLabel.textContent = 'Texture Scale: ';
    
    const textureScaleValue = document.createElement('span');
    textureScaleValue.textContent = '1.0';
    textureScaleValue.style.marginLeft = '5px';
    
    const textureScaleSlider = document.createElement('input');
    textureScaleSlider.type = 'range';
    textureScaleSlider.id = 'texture-scale';
    textureScaleSlider.min = '0.1';
    textureScaleSlider.max = '5.0';
    textureScaleSlider.step = '0.1';
    textureScaleSlider.value = '1.0';
    textureScaleSlider.style.width = '100%';
    textureScaleSlider.style.marginTop = '5px';
    textureScaleSlider.disabled = true; // Disabled until texture is loaded
    
    textureScaleContainer.appendChild(textureScaleLabel);
    textureScaleContainer.appendChild(textureScaleValue);
    textureScaleContainer.appendChild(document.createElement('br'));
    textureScaleContainer.appendChild(textureScaleSlider);
    textureControls.appendChild(textureScaleContainer);
    
    // Reload texture button
    const reloadTextureButton = document.createElement('button');
    reloadTextureButton.textContent = 'Reload Texture';
    reloadTextureButton.style.cssText = `
        background: #335555;
        color: white;
        border: 1px solid #555;
        padding: 5px 10px;
        cursor: pointer;
        border-radius: 3px;
        width: 100%;
        margin-top: 5px;
    `;
    reloadTextureButton.disabled = true; // Disabled until first texture load attempt completes
    textureControls.appendChild(reloadTextureButton);
    
    // Function to update all texture instances
    function updateTextureInAllMeshes(property, value) {
        const terrainContainer = document.getElementById('terrain-container');
        if (terrainContainer) {
            terrainContainer.object3D.traverse(function(child) {
                if (child.material && child.material.uniforms && child.material.uniforms.diffuseMap) {
                    if (property === 'useTexture') {
                        child.material.uniforms.useTexture.value = value ? 1.0 : 0.0;
                    } else if (property === 'scale' && child.material.uniforms.diffuseMap.value) {
                        const texture = child.material.uniforms.diffuseMap.value;
                        texture.repeat.set(value, value);
                        texture.needsUpdate = true;
                    }
                }
            });
        }
    }
    
    // Add event listeners
    textureToggle.addEventListener('change', function() {
        updateTextureInAllMeshes('useTexture', textureToggle.checked);
    });
    
    textureScaleSlider.addEventListener('input', function() {
        const value = parseFloat(textureScaleSlider.value);
        textureScaleValue.textContent = value.toFixed(1);
        updateTextureInAllMeshes('scale', value);
    });
    
    reloadTextureButton.addEventListener('click', function() {
        // Attempt to reload the texture
        textureStatus.textContent = 'Texture Status: Reloading...';
        textureStatus.style.color = '#ffcc00';
        
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            'assets/moon_tex.png?t=' + Date.now(), // Add timestamp to bust cache
            function(loadedTexture) {
                textureStatus.textContent = 'Texture Status: Loaded Successfully';
                textureStatus.style.color = '#00cc44';
                
                loadedTexture.wrapS = THREE.RepeatWrapping;
                loadedTexture.wrapT = THREE.RepeatWrapping;
                loadedTexture.repeat.set(parseFloat(textureScaleSlider.value), parseFloat(textureScaleSlider.value));
                
                // Update texture in all materials
                const terrainContainer = document.getElementById('terrain-container');
                if (terrainContainer) {
                    terrainContainer.object3D.traverse(function(child) {
                        if (child.material && child.material.uniforms && child.material.uniforms.diffuseMap) {
                            child.material.uniforms.diffuseMap.value = loadedTexture;
                            child.material.uniforms.useTexture.value = textureToggle.checked ? 1.0 : 0.0;
                        }
                    });
                }
                
                loadedTexture.needsUpdate = true;
            },
            undefined,
            function(error) {
                textureStatus.textContent = 'Texture Status: Failed to Load';
                textureStatus.style.color = '#ff4444';
                console.error("Error reloading texture:", error);
            }
        );
    });
    
    // Listen for texture loaded event
    // Listen for texture loaded event
    document.addEventListener('textureLoaded', function(event) {
        textureStatus.textContent = 'Texture Status: Loaded Successfully';
        textureStatus.style.color = '#00cc44';
        
        // Enable controls
        textureToggle.checked = true;
        textureToggle.disabled = false;
        textureScaleSlider.disabled = false;
        reloadTextureButton.disabled = false;
        
        // Set the scale on the loaded texture
        const texture = event.detail.texture;
        if (texture) {
            const scale = event.detail.scale || parseFloat(textureScaleSlider.value);
            textureScaleSlider.value = scale;
            textureScaleValue.textContent = scale.toFixed(1);
            texture.repeat.set(scale, scale);
            texture.needsUpdate = true;
        }
    });
    
    // Listen for texture disabled event
    document.addEventListener('textureDisabled', function() {
        textureStatus.textContent = 'Texture Status: Disabled in Config';
        textureStatus.style.color = '#ffcc00';
        
        textureToggle.checked = false;
        textureToggle.disabled = false;
        textureScaleSlider.disabled = true;
        reloadTextureButton.disabled = false;
    });
    
    // Listen for texture load failure
    document.addEventListener('textureLoadFailed', function() {
        textureStatus.textContent = 'Texture Status: Failed to Load';
        textureStatus.style.color = '#ff4444';
        reloadTextureButton.disabled = false;
    });
    
    panel.appendChild(textureControls);
    
    // If texture failed to load after 5 seconds, update the status
    setTimeout(function() {
        if (textureStatus.textContent.includes('Loading')) {
            textureStatus.textContent = 'Texture Status: Load Timed Out';
            textureStatus.style.color = '#ff4444';
            reloadTextureButton.disabled = false;
        }
    }, 5000);
}