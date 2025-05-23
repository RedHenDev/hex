// geometry.js - Cube geometry implementation using the same approach as hex-geometry.js

console.log("Initializing cube geometry using extrusion approach...");

// Global configuration
window.HexConfig = {
    useTextures: true,
    texturePath: 'assets/grass_12.png',
    textureScale: 1.0
};

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

// Define a custom CubeGeometry class for THREE.js that uses the same extrusion approach
THREE.CubeGeometry = class CubeGeometry extends THREE.BufferGeometry {
    constructor(size = 2.2, height = 1) {
        super();
        
        this.type = 'CubeGeometry';
        this.parameters = {
            size: size,
            height: height
        };
        
        // Create a square shape instead of a hexagon
        const shape = new THREE.Shape();
        
        // Define the four corners of the square
        shape.moveTo(-size, -size);
        shape.lineTo(size, -size);
        shape.lineTo(size, size);
        shape.lineTo(-size, size);
        shape.closePath();
        
        // Extrude the shape to create a 3D cube
        const extrudeSettings = {
            depth: height,
            bevelEnabled: false
        };
        
        // Use THREE.js built-in extrusion to create the geometry
        const geometryData = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // Adjust the position so the cube is positioned properly
        geometryData.rotateX(-Math.PI / 2);
        
        // Copy all attributes from the generated geometry
        this.copy(geometryData);
        
        // Compute vertex normals
        this.computeVertexNormals();
    }
};

// Also define a buffer geometry version for compatibility
THREE.CubeBufferGeometry = THREE.CubeGeometry;

// Use the same vertex and fragment shaders as hex-geometry.js
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
    
    // Varyings passed to fragment shader
    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    void main() {
        // Pass variables to fragment shader
        vColor = instanceColor;
        vHeight = instanceHeight;
        vUv = uv;
        
        // Apply height scaling - only to the top part
        vec3 transformed = position;
        if (position.y > 0.1) {
            transformed.y = (position.y * instanceHeight);
        }
        
        // Apply instance position and calculate final position
        vec3 worldPos = transformed + instancePosition;
        
        // Calculate the normal in view space for lighting
        vNormal = normalMatrix * normal;
        
        // Final position calculation
        gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
    }
`;

// SIMPLIFIED Fragment Shader
window.cubeFragmentShader = `
    // A-Frame specific uniforms for modern physically-based lighting
    uniform vec3 ambientLightColor;
    uniform vec3 directionalLightColor[5];
    uniform vec3 directionalLightDirection[5];
    
    // Texture related uniforms
    uniform sampler2D diffuseMap;
    uniform float useTexture;
    
    // Varyings from vertex shader
    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vNormal;
    varying vec2 vUv;
    
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
        
        // Apply texture if enabled
        if (useTexture > 0.5) {
            vec4 texColor = texture2D(diffuseMap, vUv);
            finalColor *= texColor.rgb;
        }
        
        // Apply height-based coloring for snow on peaks
        if (vHeight > 130.0 && normal.y > 0.03) {
            float snowAmount = smoothstep(30.0, 40.0, vHeight);
            finalColor = mix(finalColor, vec3(0.9, 0.9, 1.0), snowAmount * normal.y);
        }
        
        // New: gamma correction for physically correct lighting
        finalColor = pow(finalColor, vec3(1.0/2.2));
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// Keep the same function structure for compatibility
window.CubeTerrainBuilder = {
    // Create a mesh for a terrain chunk using instancing
    createChunkMesh: function(chunkData, material) {
        // Adapt to work with cubes
        const cubes = chunkData.cubes || [];
        
        if (cubes.length === 0) {
            console.log("No terrain elements in chunk data, returning empty group");
            return new THREE.Group();
        }
        
        try {
            // Create a cube geometry using our extrusion-based approach
            const geometry = new THREE.CubeGeometry(this.size, 1.0);
            
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
            
            return instancedMesh;
            
        } catch (error) {
            console.error("Error creating instanced cube mesh:", error);
            console.error("Error stack:", error.stack);
            return new THREE.Group(); // Return empty group on error
        }
    },
    
    // Create shader material for the cubes - identical to hex-geometry.js
    createCubeMaterial: function() {
        // Create a valid fallback texture (1x1 pixel)
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
            : false;
            
        // Get texture path from config or use default
        const texturePath = window.HexConfig && window.HexConfig.texturePath 
            ? window.HexConfig.texturePath 
            : './assets/grass_12.png';
            
        // Get texture scale from config or use default
        const textureScale = window.HexConfig && window.HexConfig.textureScale !== undefined 
            ? window.HexConfig.textureScale 
            : 1.0;
        
        // Create the material with the empty texture
        const material = new THREE.ShaderMaterial({
            vertexShader: window.cubeVertexShader,
            fragmentShader: window.cubeFragmentShader,
            vertexColors: true,
            lights: true,
            // Add these lines:
            toneMapped: true, // Enable tone mapping for physically correct output.
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.lights,
                THREE.UniformsLib.common,
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
        
        // Only load texture if enabled in config
        if (useTextures) {
            // Load the texture asynchronously
            const textureLoader = new THREE.TextureLoader();
            
            textureLoader.load(
                texturePath, 
                // Success callback
                function(loadedTexture) {
                    // Set texture properties
                    loadedTexture.wrapS = THREE.RepeatWrapping;
                    loadedTexture.wrapT = THREE.RepeatWrapping;
                    
                    // Apply texture scale from config
                    loadedTexture.repeat.set(textureScale, textureScale);
                    
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
                            loadedTexture.wrapS = THREE.RepeatWrapping;
                            loadedTexture.wrapT = THREE.RepeatWrapping;
                            loadedTexture.repeat.set(textureScale, textureScale);
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

// Don't override BoxGeometry with CubeGeometry - the original code relies on BoxGeometry
// If you want to use the custom CubeGeometry, use it explicitly

console.log("Cube geometry initialized using extrusion approach");