// bioluminescent-pulse.js - Adds a breathing, pulsing effect to the terrain

// Global configuration for the pulse effect
window.BioluminescentPulseConfig = {
    enabled: true,
    pulseSpeed: 0.5,          // Speed of the pulse wave (cycles per second)
    pulseIntensity: 0.2,      // Intensity of the pulse (0-1)
    pulseColor: [0.0, 0.2, 1.0], // RGB color of the bioluminescent pulse
    waveScale: 0.6,         // Scale of the wave pattern (lower = larger waves)
    waveSpread: 32.0           // How spread out the waves are
};

// Initialize the effect
(function() {
    // Make sure THREE is available from A-Frame
    if (typeof THREE === 'undefined' && typeof AFRAME !== 'undefined') {
        console.log("Getting THREE from AFRAME for bioluminescent effect");
        THREE = AFRAME.THREE;
    }
    
    console.log("Initializing bioluminescent pulse effect...");
    
    // Keep track of terrain materials to update
    let terrainMaterials = [];
    
    // Store the original fragment shader
    const originalFragmentShader = window.cubeFragmentShader;
    
    // Enhanced fragment shader with pulse effect
    window.cubeFragmentShader = `
        // A-Frame specific uniforms for modern physically-based lighting
        uniform vec3 ambientLightColor;
        uniform vec3 directionalLightColor[5];
        uniform vec3 directionalLightDirection[5];
        
        // Texture related uniforms
        uniform sampler2D diffuseMap;
        uniform float useTexture;
        
        // Bioluminescent pulse uniforms
        uniform float pulseTime;
        uniform float pulseIntensity;
        uniform vec3 pulseColor;
        uniform float waveScale;
        uniform float waveSpread;
        
        // Fog uniforms
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        varying float vFogDepth;
        
        // Varyings from vertex shader
        varying vec3 vColor;
        varying float vHeight;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        
        void main() {
            // Ensure normal is normalized
            vec3 normal = normalize(vNormal);
            
            // Basic lighting calculation using modern PBR approach
            // Start with ambient contribution
            vec3 lighting = ambientLightColor;
            
            // Add directional light contribution - updated for physically based model
            for (int i = 0; i < 5; i++) {
                if (length(directionalLightColor[i]) > 0.0) {
                    vec3 directionalVector = normalize(directionalLightDirection[i]);
                    float directional = max(dot(normal, directionalVector), 0.0);
                    lighting += directionalLightColor[i] * directional;
                }
            }
            
            // Start with base color * lighting
            vec3 finalColor = vColor * max(lighting, vec3(0.3));
            
            // Apply texture if enabled - using consistent world-space mapping
            if (useTexture > 0.5) {
                // Use world-space XZ coordinates for all faces, regardless of orientation
                // This ensures the texture looks the same from all viewing angles
                vec2 texUV = vec2(
                    fract(vWorldPosition.x / 3.0),
                    fract(vWorldPosition.z / 3.0)
                );
                
                vec4 texColor = texture2D(diffuseMap, texUV);
                finalColor *= texColor.rgb;
            }
            
            // Apply height-based coloring for snow on peaks
            if (vHeight > 130.0 && normal.y > 0.03) {
                float snowAmount = smoothstep(30.0, 40.0, vHeight);
                finalColor = mix(finalColor, vec3(0.9, 0.9, 1.0), snowAmount * normal.y);
            }
            
            // Apply bioluminescent pulse wave effect
            float distFromCenter = length(vWorldPosition.xz) * waveScale;
            float wave = sin(distFromCenter - pulseTime) * 0.5 + 0.5;
            wave = pow(wave, waveSpread); // Add more contrast to the wave pattern
            
            // Mix in the pulse color based on wave intensity
            float pulseAmount = wave * pulseIntensity;
            finalColor = mix(finalColor, pulseColor, pulseAmount);
            
            // Add shimmer effect - small random flickering
            float shimmer = fract(sin(dot(vWorldPosition.xz, vec2(12.9898, 78.233)) + pulseTime * 10.0) * 43758.5453);
            finalColor += shimmer * pulseAmount * 0.2; // Subtle shimmer
            
            // New: gamma correction for physically correct lighting
            finalColor = pow(finalColor, vec3(1.0/2.2));
            
            // Create the base color
            vec4 color = vec4(finalColor, 1.0);
            
            // Apply fog
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
            color.rgb = mix(color.rgb, fogColor, fogFactor);
            
            gl_FragColor = color;
        }
    `;
    
    // Override material creation to add our uniforms
    const originalCreateCubeMaterial = window.CubeTerrainBuilder.createCubeMaterial;
    
    window.CubeTerrainBuilder.createCubeMaterial = function() {
        const material = originalCreateCubeMaterial.call(this);
        
        try {
            // Add our pulse uniforms
            if (!material.uniforms) {
                material.uniforms = {};
            }
            
            material.uniforms.pulseTime = { value: 0.0 };
            material.uniforms.pulseIntensity = { value: window.BioluminescentPulseConfig.pulseIntensity || 0.3 };
            material.uniforms.pulseColor = { value: new THREE.Vector3(
                window.BioluminescentPulseConfig.pulseColor ? window.BioluminescentPulseConfig.pulseColor[0] : 0.2,
                window.BioluminescentPulseConfig.pulseColor ? window.BioluminescentPulseConfig.pulseColor[1] : 0.8,
                window.BioluminescentPulseConfig.pulseColor ? window.BioluminescentPulseConfig.pulseColor[2] : 1.0
            )};
            material.uniforms.waveScale = { value: window.BioluminescentPulseConfig.waveScale || 0.003 };
            material.uniforms.waveSpread = { value: window.BioluminescentPulseConfig.waveSpread || 5.0 };
            
            // Track this material for updates
            terrainMaterials.push(material);
            console.log("Added bioluminescent uniforms to terrain material");
        } catch (error) {
            console.warn("Error adding bioluminescent uniforms:", error);
        }
        
        return material;
    };
    
    // Register component to update the pulse uniforms
    AFRAME.registerComponent('bioluminescent-pulse', {
        schema: {
            enabled: {type: 'boolean', default: true},
            pulseSpeed: {type: 'number', default: 0.5},
            pulseIntensity: {type: 'number', default: 0.3},
            pulseColorR: {type: 'number', default: 0.2},
            pulseColorG: {type: 'number', default: 0.8},
            pulseColorB: {type: 'number', default: 1.0},
            waveScale: {type: 'number', default: 0.003},
            waveSpread: {type: 'number', default: 5.0}
        },
        
        init: function() {
            console.log("Bioluminescent pulse component initializing");
            
            // Apply initial config
            const config = window.BioluminescentPulseConfig || {};
            this.data.enabled = config.enabled !== undefined ? config.enabled : this.data.enabled;
            this.data.pulseSpeed = config.pulseSpeed || this.data.pulseSpeed;
            this.data.pulseIntensity = config.pulseIntensity || this.data.pulseIntensity;
            
            if (config.pulseColor) {
                this.data.pulseColorR = config.pulseColor[0];
                this.data.pulseColorG = config.pulseColor[1];
                this.data.pulseColorB = config.pulseColor[2];
            }
            
            this.data.waveScale = config.waveScale || this.data.waveScale;
            this.data.waveSpread = config.waveSpread || this.data.waveSpread;
            
            // Initialize time
            this.pulseTime = 0;
            
            // Update the debug panel to include our effects
            this.setupDebugPanel();

            // Make shader uniforms accessible to existing terrain
            this.inspectExistingTerrain();
            
            // Listen for terrain ready to inspect terrain again
            document.addEventListener('terrainReady', () => {
                this.inspectExistingTerrain();
            });
            
            console.log("Bioluminescent pulse component initialized");
        },

        inspectExistingTerrain: function() {
            try {
                // Get terrain container
                const terrainContainer = document.getElementById('terrain-container');
                if (!terrainContainer) {
                    console.warn("No terrain container found");
                    return;
                }
                
                console.log("Scanning existing terrain for materials...");
                
                // Look through all chunks for their materials
                const chunkEntities = terrainContainer.children;
                for (let i = 0; i < chunkEntities.length; i++) {
                    if (!chunkEntities[i] || !chunkEntities[i].object3D) continue;
                    
                    // Try to get the mesh from children
                    const chunkObj = chunkEntities[i].object3D;
                    
                    // Process all children recursively to find materials
                    chunkObj.traverse((child) => {
                        if (child.isMesh && child.material) {
                            const material = child.material;
                            
                            // If material doesn't have pulse uniforms, add them
                            if (!material.uniforms || !material.uniforms.pulseTime) {
                                if (!material.uniforms) {
                                    material.uniforms = {};
                                }
                                
                                material.uniforms.pulseTime = { value: 0.0 };
                                material.uniforms.pulseIntensity = { value: this.data.pulseIntensity };
                                material.uniforms.pulseColor = { 
                                    value: new THREE.Vector3(
                                        this.data.pulseColorR, 
                                        this.data.pulseColorG, 
                                        this.data.pulseColorB
                                    ) 
                                };
                                material.uniforms.waveScale = { value: this.data.waveScale };
                                material.uniforms.waveSpread = { value: this.data.waveSpread };
                                
                                // Keep track of this material
                                if (!terrainMaterials.includes(material)) {
                                    terrainMaterials.push(material);
                                }
                                
                                console.log("Added pulse uniforms to existing terrain material");
                            }
                        }
                    });
                }
                
                // Force update the uniforms once
                this.updateShaderUniforms();
                
                console.log(`Found ${terrainMaterials.length} terrain materials to animate`);
            } catch (error) {
                console.error("Error inspecting existing terrain:", error);
            }
        },
        
        tick: function(time, deltaTime) {
            if (!this.data.enabled) return;
            
            // Update pulse time based on speed
            const deltaSeconds = deltaTime / 1000;
            this.pulseTime += deltaSeconds * this.data.pulseSpeed;
            
            // Update shader uniforms
            this.updateShaderUniforms();
        },
        
        updateShaderUniforms: function() {
            try {
                // Update all tracked terrain materials
                for (let i = 0; i < terrainMaterials.length; i++) {
                    const material = terrainMaterials[i];
                    
                    // Make sure material and uniforms exist before updating
                    if (material && material.uniforms) {
                        if (material.uniforms.pulseTime) {
                            material.uniforms.pulseTime.value = this.pulseTime;
                        }
                        
                        if (material.uniforms.pulseIntensity) {
                            material.uniforms.pulseIntensity.value = this.data.pulseIntensity;
                        }
                        
                        if (material.uniforms.pulseColor) {
                            material.uniforms.pulseColor.value.set(
                                this.data.pulseColorR,
                                this.data.pulseColorG,
                                this.data.pulseColorB
                            );
                        }
                        
                        if (material.uniforms.waveScale) {
                            material.uniforms.waveScale.value = this.data.waveScale;
                        }
                        
                        if (material.uniforms.waveSpread) {
                            material.uniforms.waveSpread.value = this.data.waveSpread;
                        }
                    }
                }
            } catch (error) {
                console.error("Error updating shader uniforms:", error);
            }
        },
        
        setupDebugPanel: function() {
            if (!window.DebugPanel) return;
            
            window.DebugPanel.registerSection('bioluminescence', 'Bioluminescent Effect', (container) => {
                // Create controls container
                const controlsContainer = document.createElement('div');
                controlsContainer.style.display = 'grid';
                controlsContainer.style.gridTemplateColumns = '1fr';
                controlsContainer.style.gap = '8px';
                controlsContainer.style.marginBottom = '10px';
                
                // Enable toggle
                const enableContainer = document.createElement('div');
                const enableCheck = document.createElement('input');
                enableCheck.type = 'checkbox';
                enableCheck.id = 'bio-enabled';
                enableCheck.checked = this.data.enabled;
                enableCheck.addEventListener('change', () => {
                    this.data.enabled = enableCheck.checked;
                });
                
                const enableLabel = document.createElement('label');
                enableLabel.htmlFor = 'bio-enabled';
                enableLabel.textContent = 'Enable Effect';
                enableLabel.style.marginLeft = '5px';
                
                enableContainer.appendChild(enableCheck);
                enableContainer.appendChild(enableLabel);
                controlsContainer.appendChild(enableContainer);
                
                // Pulse Speed
                this.createSlider(
                    controlsContainer,
                    'Pulse Speed',
                    'bio-speed',
                    this.data.pulseSpeed,
                    0.1,
                    2.0,
                    0.1,
                    (value) => { this.data.pulseSpeed = value; }
                );
                
                // Pulse Intensity
                this.createSlider(
                    controlsContainer,
                    'Pulse Intensity',
                    'bio-intensity',
                    this.data.pulseIntensity,
                    0.0,
                    1.0,
                    0.05,
                    (value) => { this.data.pulseIntensity = value; }
                );
                
                // Color controls - R, G, B
                this.createSlider(
                    controlsContainer,
                    'Color Red',
                    'bio-color-r',
                    this.data.pulseColorR,
                    0.0,
                    1.0,
                    0.05,
                    (value) => { this.data.pulseColorR = value; }
                );
                
                this.createSlider(
                    controlsContainer,
                    'Color Green',
                    'bio-color-g',
                    this.data.pulseColorG,
                    0.0,
                    1.0,
                    0.05,
                    (value) => { this.data.pulseColorG = value; }
                );
                
                this.createSlider(
                    controlsContainer,
                    'Color Blue',
                    'bio-color-b',
                    this.data.pulseColorB,
                    0.0,
                    1.0,
                    0.05,
                    (value) => { this.data.pulseColorB = value; }
                );
                
                // Wave Scale
                this.createSlider(
                    controlsContainer,
                    'Wave Scale',
                    'bio-wave-scale',
                    this.data.waveScale,
                    0.0001,
                    0.01,
                    0.0001,
                    (value) => { this.data.waveScale = value; }
                );
                
                // Wave Spread
                this.createSlider(
                    controlsContainer,
                    'Wave Spread',
                    'bio-wave-spread',
                    this.data.waveSpread,
                    1.0,
                    10.0,
                    0.5,
                    (value) => { this.data.waveSpread = value; }
                );
                
                // Add controls to container
                container.appendChild(controlsContainer);
                
                // Add preset buttons
                const presetContainer = document.createElement('div');
                presetContainer.style.display = 'grid';
                presetContainer.style.gridTemplateColumns = '1fr 1fr';
                presetContainer.style.gap = '5px';
                presetContainer.style.marginTop = '10px';
                
                // Preset: Blue Pulse
                this.createPresetButton(
                    presetContainer,
                    'Blue Pulse',
                    {
                        pulseSpeed: 0.5,
                        pulseIntensity: 0.3,
                        pulseColorR: 0.2,
                        pulseColorG: 0.8,
                        pulseColorB: 1.0,
                        waveScale: 0.003,
                        waveSpread: 5.0
                    }
                );
                
                // Preset: Green Glow
                this.createPresetButton(
                    presetContainer,
                    'Green Glow',
                    {
                        pulseSpeed: 0.3,
                        pulseIntensity: 0.4,
                        pulseColorR: 0.2,
                        pulseColorG: 1.0,
                        pulseColorB: 0.5,
                        waveScale: 0.002,
                        waveSpread: 3.0
                    }
                );
                
                // Preset: Purple Magic
                this.createPresetButton(
                    presetContainer,
                    'Purple Magic',
                    {
                        pulseSpeed: 0.7,
                        pulseIntensity: 0.35,
                        pulseColorR: 0.7,
                        pulseColorG: 0.2,
                        pulseColorB: 1.0,
                        waveScale: 0.004,
                        waveSpread: 4.0
                    }
                );
                
                // Preset: Golden Breath
                this.createPresetButton(
                    presetContainer,
                    'Golden Breath',
                    {
                        pulseSpeed: 0.2,
                        pulseIntensity: 0.25,
                        pulseColorR: 1.0,
                        pulseColorG: 0.8,
                        pulseColorB: 0.2,
                        waveScale: 0.001,
                        waveSpread: 2.0
                    }
                );
                
                container.appendChild(presetContainer);
            });
        },
        
        createSlider: function(container, label, id, value, min, max, step, onChange) {
            const sliderContainer = document.createElement('div');
            
            const sliderLabel = document.createElement('label');
            sliderLabel.textContent = `${label}: `;
            sliderLabel.htmlFor = id;
            sliderLabel.style.display = 'block';
            sliderLabel.style.fontSize = '12px';
            
            const valueDisplay = document.createElement('span');
            valueDisplay.id = `${id}-value`;
            valueDisplay.textContent = value.toFixed(4);
            valueDisplay.style.marginLeft = '5px';
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = id;
            slider.min = min;
            slider.max = max;
            slider.step = step;
            slider.value = value;
            slider.style.width = '100%';
            
            slider.addEventListener('input', function() {
                const newValue = parseFloat(slider.value);
                valueDisplay.textContent = newValue.toFixed(4);
                if (onChange) onChange(newValue);
            });
            
            sliderLabel.appendChild(valueDisplay);
            sliderContainer.appendChild(sliderLabel);
            sliderContainer.appendChild(slider);
            container.appendChild(sliderContainer);
        },
        
        createPresetButton: function(container, name, preset) {
            const button = document.createElement('button');
            button.textContent = name;
            button.style.padding = '5px';
            button.style.cursor = 'pointer';
            button.style.backgroundColor = '#333';
            button.style.color = 'white';
            button.style.border = '1px solid #555';
            button.style.borderRadius = '3px';
            
            button.addEventListener('click', () => {
                // Apply preset values
                Object.assign(this.data, preset);
                
                // Update UI
                for (const key in preset) {
                    const slider = document.getElementById(`bio-${key.replace('pulse', '').replace('Color', 'color-').toLowerCase()}`);
                    const valueDisplay = document.getElementById(`bio-${key.replace('pulse', '').replace('Color', 'color-').toLowerCase()}-value`);
                    
                    if (slider) {
                        slider.value = preset[key];
                        if (valueDisplay) {
                            valueDisplay.textContent = preset[key].toFixed(4);
                        }
                    }
                }
            });
            
            container.appendChild(button);
        }
    });
    
    // Auto-add component to scene
    document.addEventListener('DOMContentLoaded', () => {
        const scene = document.querySelector('a-scene');
        if (scene) {
            scene.addEventListener('loaded', () => {
                // Create entity with bioluminescent-pulse component
                const pulseEntity = document.createElement('a-entity');
                pulseEntity.setAttribute('bioluminescent-pulse', '');
                scene.appendChild(pulseEntity);
                console.log('Bioluminescent pulse entity added to scene');
            });
        }
    });
    
    // Also add component when terrain is ready
    document.addEventListener('terrainReady', () => {
        if (!document.querySelector('[bioluminescent-pulse]')) {
            const scene = document.querySelector('a-scene');
            if (scene) {
                const pulseEntity = document.createElement('a-entity');
                pulseEntity.setAttribute('bioluminescent-pulse', '');
                scene.appendChild(pulseEntity);
                console.log('Bioluminescent pulse entity added to scene after terrain ready');
            }
        }
    });
    
    console.log("Bioluminescent pulse effect initialization complete");
})();