// Simplified hexagon shader approach
// Keep the surrounding structure but completely replace the shader code

// Global configuration
window.HexConfig = {
    useTextures: false,
    texturePath: './assets/grass_13.png',
    textureScale: 1.0
};

console.log("Initializing simplified hexagon shaders...");

// ==== STEP 1: First, add this code at the start of both files ====
// This will disable the warning by setting the property correctly

// Add this near the top of hex-geometry.js and geometry.js (right after the console.log lines)
if (typeof THREE !== 'undefined') {
    // Suppress the legacy lights warning by explicitly enabling physically correct lights
    THREE.ColorManagement.enabled = true;
    
    // Check if we're using A-Frame's THREE instance
    if (typeof AFRAME !== 'undefined' && AFRAME.THREE) {
        AFRAME.THREE.ColorManagement.enabled = true;
    }
    
    console.log("Updated lighting configuration for modern THREE.js");
}

// Make sure THREE is available from A-Frame
if (typeof THREE === 'undefined' && typeof AFRAME !== 'undefined') {
    console.log("Getting THREE from AFRAME");
    THREE = AFRAME.THREE;
}

// Define a custom HexagonGeometry class for THREE.js
THREE.HexagonGeometry = class HexagonGeometry extends THREE.BufferGeometry {
    constructor(size = 2.54, height = 1, flatTop = false) {
        super();
        // size relates to terrain-system geometrySize.
        // Size default is 0.5. GeometrySize default with this
        // is 0.86.
        this.type = 'HexagonGeometry';
        this.parameters = {
            size: size,
            height: height,
            flatTop: flatTop
        };
        
        // Determine the angle based on orientation (flat-top or pointy-top)
        const startAngle = flatTop ? 0 : Math.PI / 6;
        
        // Create the hexagon shape
        const shape = new THREE.Shape();
        
        // Store vertices for later UV calculation
        const vertices = [];
        
        // Create the hexagon vertices
        for (let i = 0; i < 6; i++) {
            const angle = startAngle + (i * Math.PI / 3);
            const x = size * Math.cos(angle);
            const z = size * Math.sin(angle);
            
            vertices.push(new THREE.Vector2(x, z));
            
            if (i === 0) {
                shape.moveTo(x, z);
            } else {
                shape.lineTo(x, z);
            }
        }
        shape.closePath();
        
        // Extrude the shape to create a 3D hexagonal prism
        const extrudeSettings = {
            depth: height,
            bevelEnabled: false,
            // Use simplified UVGenerator to avoid buffer attribute issues
            UVGenerator: {
                generateTopUV: function(geometry, vertices, indexA, indexB, indexC) {
                    // Use default UVs for the top face - will be adjusted in shader
                    return [
                        new THREE.Vector2(0, 0),
                        new THREE.Vector2(1, 0),
                        new THREE.Vector2(0.5, 1)
                    ];
                },
                generateSideWallUV: function(geometry, vertices, indexA, indexB, indexC, indexD) {
                    // Use default UVs for side walls
                    return [
                        new THREE.Vector2(0, 0),
                        new THREE.Vector2(1, 0),
                        new THREE.Vector2(0, 1),
                        new THREE.Vector2(1, 1)
                    ];
                }
            }
        };
        
        // Use THREE.js built-in extrusion to create the geometry
        const geometryData = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // Adjust the position so the hexagon is positioned properly
        geometryData.rotateX(-Math.PI / 2);
        
        // Copy all attributes from the generated geometry
        this.copy(geometryData);
        
        // Compute vertex normals
        this.computeVertexNormals();
    }
};

// Also define a buffer geometry version for compatibility
THREE.HexagonBufferGeometry = THREE.HexagonGeometry;

// SIMPLIFIED Vertex Shader
window.cubeVertexShader = `
    // Instance attributes
    attribute vec3 instancePosition;
    attribute float instanceHeight;
    attribute vec3 instanceColor;
    
    // A-Frame specific uniforms
    uniform vec3 ambientLightColor;
    uniform vec3 directionalLightColor[5];
    uniform vec3 directionalLightDirection[5];
    
    // Fog calculation
    varying float vFogDepth;
    
    // Varyings passed to fragment shader
    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    
    void main() {
        // Pass variables to fragment shader
        vColor = instanceColor;
        vHeight = instanceHeight;
        vUv = uv;
        vPosition = position;
        
        // Apply height scaling - only to the top part
        vec3 transformed = position;
        if (position.y > 0.1) {
            transformed.y = (position.y * instanceHeight);
        }
        
        // Apply instance position and calculate final position
        vec3 worldPos = transformed + instancePosition;
        vWorldPosition = worldPos;
        
        // Calculate the normal in view space for lighting
        vNormal = normalMatrix * normal;
        
        // Final position calculation
        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        // Calculate fog depth (distance to camera)
        vFogDepth = -mvPosition.z;
    }
`;

// IMPROVED Fragment Shader with better texture mapping
window.cubeFragmentShader = `
    // A-Frame specific uniforms for modern physically-based lighting
    uniform vec3 ambientLightColor;
    uniform vec3 directionalLightColor[5];
    uniform vec3 directionalLightDirection[5];
    
    // Texture related uniforms
    uniform sampler2D diffuseMap;
    uniform float useTexture;
    
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
                fract(vWorldPosition.x / 3.0),  // Adjust the 15.0 value to control texture scaling
                fract(vWorldPosition.z / 3.0)   // Using fract() to repeat the texture
            );
            
            vec4 texColor = texture2D(diffuseMap, texUV);
            finalColor *= texColor.rgb;
        }
        
        // Apply height-based coloring for snow on peaks
        if (vHeight > 130.0 && normal.y > 0.03) {
            float snowAmount = smoothstep(30.0, 40.0, vHeight);
            finalColor = mix(finalColor, vec3(0.9, 0.9, 1.0), snowAmount * normal.y);
        }
        
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

// Keep the same function structure for compatibility
window.CubeTerrainBuilder = {
    // Create a mesh for a terrain chunk using instancing
    createChunkMesh: function(chunkData, material) {
        // Adapt to work with either cubes or hexagons
        const cubes = chunkData.cubes || chunkData.hexagons || [];
        
        if (cubes.length === 0) {
            console.log("No terrain elements in chunk data, returning empty group");
            return new THREE.Group();
        }
        
        //console.log(`Creating instanced hexagon mesh with ${cubes.length} hexagons`);
        
        try {
            // Create a hexagon geometry instead of a box
            // default values: 0.5, 1.0, false
            const geometry = new THREE.HexagonGeometry(2.54, 1.0, false);
            this.size = 2.54; // Store size for future reference
            
            // Create the instanced mesh
            const instancedMesh = new THREE.InstancedMesh(
                geometry,
                material,
                cubes.length
            );
            
            // Disable frustum culling to prevent chunks from disappearing
            instancedMesh.frustumCulled = false;
            
            // Create buffer attributes for instance data
            const instancePositions = new Float32Array(cubes.length * 3);
            const instanceHeights = new Float32Array(cubes.length);
            const instanceColors = new Float32Array(cubes.length * 3);
            
            // Fill the instance buffers
            for (let i = 0; i < cubes.length; i++) {
                const cube = cubes[i];
                
                // Position (x, y, z)
                instancePositions[i * 3] = cube.position[0];
                instancePositions[i * 3 + 1] = cube.position[1] || 0;
                instancePositions[i * 3 + 2] = cube.position[2];
                
                // Height
                instanceHeights[i] = Math.max(0.1, cube.height);
                
                // Color (r, g, b)
                instanceColors[i * 3] = cube.color[0];
                instanceColors[i * 3 + 1] = cube.color[1];
                instanceColors[i * 3 + 2] = cube.color[2];
            }
            
            // Add the attributes to the geometry
            geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
            geometry.setAttribute('instanceHeight', new THREE.InstancedBufferAttribute(instanceHeights, 1));
            geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 3));
            
            //console.log("Instanced hex mesh created successfully");
            return instancedMesh;
            
        } catch (error) {
            console.error("Error creating instanced hex mesh:", error);
            console.error("Error stack:", error.stack);
            return new THREE.Group(); // Return empty group on error
        }
    },
    
    // Create shader material for the cubes/hexagons
    createCubeMaterial: function() {
        // Create a default empty texture first
        //const emptyTexture = new THREE.Texture();
        
        // New: Create a valid fallback texture (1x1 pixel).
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1, 1);
        const fallbackTexture = new THREE.CanvasTexture(canvas);
        
        // Check if textures are enabled in config
        const useTextures = window.HexConfig && window.HexConfig.useTextures !== undefined 
            ? window.HexConfig.useTextures 
            : true;
            
        // Get texture path from config or use default
        const texturePath = window.HexConfig && window.HexConfig.texturePath 
            ? window.HexConfig.texturePath 
            : './assets/grass_13.png';
            
        // Get texture scale from config or use default
        const textureScale = window.HexConfig && window.HexConfig.textureScale !== undefined 
            ? window.HexConfig.textureScale 
            : 1.0;
        
        //console.log(`Texturing: ${useTextures ? 'Enabled' : 'Disabled'}`);
        
        // Create the material with the empty texture
        const material = new THREE.ShaderMaterial({
            vertexShader: window.cubeVertexShader,
            fragmentShader: window.cubeFragmentShader,
            vertexColors: true,
            lights: true,
            fog: true, // Enable fog
            // Add these lines:
            toneMapped: true, // Enable tone mapping for physically correct output.
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.lights,
                THREE.UniformsLib.common,
                THREE.UniformsLib.fog, // Add fog uniforms
                {
                    diffuseMap: { value: fallbackTexture },
                    useTexture: { value: 0.0 } // Start with texture disabled until it's loaded
                }
            ])
        });
        
        // Also add this line after creating the material:
        material.extensions = {
            derivatives: true,
            fragDepth: false,
            drawBuffers: false,
            shaderTextureLOD: false
        };

        // Explicitly enable lights
        material.lights = true;
        //material.fog = true;
        
        // Only load texture if enabled in config
        if (useTextures) {
            // Load the texture asynchronously
            const textureLoader = new THREE.TextureLoader();
            
            //console.log(`Loading texture from ${texturePath}...`);
            
            textureLoader.load(
                texturePath, 
                // Success callback
                function(loadedTexture) {
                    //console.log("Texture loaded successfully");
                    
                    // Set texture properties - MODIFIED to use RepeatWrapping
                    loadedTexture.wrapS = THREE.RepeatWrapping;
                    loadedTexture.wrapT = THREE.RepeatWrapping;
                    
                    // Apply texture scale from config (set to 1.0 for single non-repeating texture)
                    loadedTexture.repeat.set(1.0, 1.0);
                    
                    // Improved texture filtering
                    loadedTexture.magFilter = THREE.LinearFilter;
                    loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
                    
                    // Enable anisotropy for better texture quality at angles
                    if (typeof AFRAME !== 'undefined' && AFRAME.THREE && AFRAME.THREE.renderer) {
                        const maxAnisotropy = AFRAME.THREE.renderer.capabilities.getMaxAnisotropy();
                        loadedTexture.anisotropy = maxAnisotropy;
                    }
                    
                    // Update the material's texture
                    material.uniforms.diffuseMap.value = loadedTexture;
                    material.uniforms.useTexture.value = 1.0;
                    
                    // Make sure Three.js knows the texture has been updated
                    loadedTexture.needsUpdate = true;
                    
                    // Dispatch an event that the texture is loaded
                    const event = new CustomEvent('textureLoaded', { 
                        detail: { 
                            texture: loadedTexture,
                            scale: textureScale 
                        }
                    });
                    document.dispatchEvent(event);
                },
                // Progress callback
                function(xhr) {
                    //console.log(`Texture loading: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
                },
                // Error callback
                function(error) {
                    console.error(`Error loading texture from ${texturePath}:`, error);
                    // Try alternative path as fallback
                    const altPath = texturePath.startsWith('./') ? texturePath.substring(2) : './' + texturePath;
                    textureLoader.load(
                        altPath,
                        function(loadedTexture) {
                            //console.log("Texture loaded successfully from alternative path");
                            loadedTexture.wrapS = THREE.RepeatWrapping;
                            loadedTexture.wrapT = THREE.RepeatWrapping;
                            loadedTexture.repeat.set(1.0, 1.0);
                            
                            // Improved texture filtering
                            loadedTexture.magFilter = THREE.LinearFilter;
                            loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
                            
                            // Enable anisotropy
                            if (typeof AFRAME !== 'undefined' && AFRAME.THREE && AFRAME.THREE.renderer) {
                                const maxAnisotropy = AFRAME.THREE.renderer.capabilities.getMaxAnisotropy();
                                loadedTexture.anisotropy = maxAnisotropy;
                            }
                            
                            material.uniforms.diffuseMap.value = loadedTexture;
                            material.uniforms.useTexture.value = 1.0;
                            loadedTexture.needsUpdate = true;
                            
                            // Dispatch event
                            const event = new CustomEvent('textureLoaded', { 
                                detail: { 
                                    texture: loadedTexture,
                                    scale: textureScale 
                                }
                            });
                            document.dispatchEvent(event);
                        },
                        undefined,
                        function(secondError) {
                            console.error("Failed to load texture from both paths:", secondError);
                            // Explicitly disable texturing when loading fails
                            material.uniforms.useTexture.value = 0.0;
                            // Dispatch texture failure event
                            const event = new CustomEvent('textureLoadFailed');
                            document.dispatchEvent(event);
                        }
                    );
                }
            );
        } else {
            console.log("Texturing disabled in configuration");
            // Dispatch event for UI to update accordingly
            const event = new CustomEvent('textureDisabled');
            document.dispatchEvent(event);
        }
        
        return material;
    }
};

// Use the same approach for modifying BoxGeometry for better compatibility
// Make BoxGeometry actually create a hexagon
THREE.BoxGeometry = THREE.HexagonGeometry;

console.log("Simplified hexagon shaders initialized");