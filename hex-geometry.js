// Modified hex-geometry.js with fixes for the hollow/inside-out appearance

// Global configuration
window.HexConfig = {
    // Set to true to enable texture mapping, false to use only color
    useTextures: false,
    // Path to the texture file
    texturePath: 'assets/moon_tex.png',
    // Default texture scale factor
    textureScale: 1.0
};

console.log("Initializing fixed hexagon geometry as cube replacement...");

// Make sure THREE is available from A-Frame
if (typeof THREE === 'undefined' && typeof AFRAME !== 'undefined') {
    console.log("Getting THREE from AFRAME");
    THREE = AFRAME.THREE;
}

// Define a custom HexagonGeometry class for THREE.js
// This will be used instead of BoxGeometry
THREE.HexagonGeometry = class HexagonGeometry extends THREE.BufferGeometry {
    constructor(size = 1, height = 1, flatTop = false) {
        super();
        
        // Store construction parameters
        this.type = 'HexagonGeometry';
        this.parameters = {
            size: size,
            height: height,
            flatTop: flatTop
        };
        
        // Generate vertices for a hexagon
        const vertices = [];
        const indices = [];
        const uvs = [];
        const normals = [];
        
        // Center vertex for top and bottom face
        const centerTop = new THREE.Vector3(0, height, 0);
        const centerBottom = new THREE.Vector3(0, 0, 0);
        
        // Hexagon corner points
        const topPoints = [];
        const bottomPoints = [];
        
        // Determine the angle based on orientation (flat-top or pointy-top)
        const startAngle = flatTop ? 0 : Math.PI / 6;
        
        // Create the 6 corner vertices
        for (let i = 0; i < 6; i++) {
            const angle = startAngle + (i * Math.PI / 3);
            const x = size * Math.cos(angle);
            const z = size * Math.sin(angle);
            
            topPoints.push(new THREE.Vector3(x, height, z));
            bottomPoints.push(new THREE.Vector3(x, 0, z));
        }
        
        // Add vertices to array
        // First add center vertices
        vertices.push(centerTop.x, centerTop.y, centerTop.z); // 0: top center
        vertices.push(centerBottom.x, centerBottom.y, centerBottom.z); // 1: bottom center
        
        // Then add corner vertices (top, then bottom)
        for (let i = 0; i < 6; i++) {
            vertices.push(topPoints[i].x, topPoints[i].y, topPoints[i].z); // 2-7: top corners
        }
        for (let i = 0; i < 6; i++) {
            vertices.push(bottomPoints[i].x, bottomPoints[i].y, bottomPoints[i].z); // 8-13: bottom corners
        }
        
        // Create top face (6 triangles from center)
        for (let i = 0; i < 6; i++) {
            const nextI = (i + 1) % 6;
            indices.push(0, i + 2, nextI + 2);
        }
        
        // Create bottom face (6 triangles from center)
        for (let i = 0; i < 6; i++) {
            const nextI = (i + 1) % 6;
            indices.push(1, nextI + 8, i + 8); // Reversed winding order for bottom face
        }
        
        // Create side faces (2 triangles per side) - FIXED WINDING ORDER
        for (let i = 0; i < 6; i++) {
            const nextI = (i + 1) % 6;
            // Fix the winding order of the side faces
            indices.push(i + 2, nextI + 8, i + 8); // First triangle
            indices.push(i + 2, nextI + 2, nextI + 8); // Second triangle - FIXED ORDER
        }
        
        // Generate UV coordinates
        const uvCenter = new THREE.Vector2(0.5, 0.5);
        
        // UV for center points
        uvs.push(uvCenter.x, uvCenter.y); // top center
        uvs.push(uvCenter.x, uvCenter.y); // bottom center
        
        // UVs for corner points (top face)
        for (let i = 0; i < 6; i++) {
            const angle = startAngle + (i * Math.PI / 3);
            const u = 0.5 + (Math.cos(angle) * 0.5);
            const v = 0.5 + (Math.sin(angle) * 0.5);
            uvs.push(u, v);
        }
        
        // UVs for corner points (bottom face)
        for (let i = 0; i < 6; i++) {
            const angle = startAngle + (i * Math.PI / 3);
            const u = 0.5 + (Math.cos(angle) * 0.5);
            const v = 0.5 + (Math.sin(angle) * 0.5);
            uvs.push(u, v);
        }
        
        // Set attributes
        this.setIndex(indices);
        this.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        
        // Compute correct normals for all faces
        this.computeVertexNormals();
    }
};

// Also define a buffer geometry version for compatibility
THREE.HexagonBufferGeometry = THREE.HexagonGeometry;

// Define the shader for our instanced hexagons
window.cubeVertexShader = `
    // Instance attributes
    attribute vec3 instancePosition;
    attribute float instanceHeight;
    attribute vec3 instanceColor;
    
    // A-Frame specific uniforms
    uniform vec3 ambientLightColor;
    uniform vec3 directionalLightColor[5];
    uniform vec3 directionalLightDirection[5];
    
    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    
    void main() {
        // Pass variables to fragment shader
        vColor = instanceColor;
        vHeight = instanceHeight;
        vUv = uv;
        
        // Apply instance position and scale height
        vec3 transformed = position;
        
        // Only scale the Y coordinate by the instanceHeight
        if (transformed.y > 0.0) {
            transformed.y *= instanceHeight;
        }
        
        // Save original normal for lighting calculations
        vNormal = normalMatrix * normal;
        
        // Calculate world position
        vec3 worldPos = transformed + instancePosition;
        
        // Final position calculation
        vec4 worldPosition = modelMatrix * vec4(worldPos, 1.0);
        vec4 viewPosition = viewMatrix * worldPosition;
        vViewPosition = viewPosition.xyz;
        
        gl_Position = projectionMatrix * viewPosition;
    }
`;

window.cubeFragmentShader = `
    // A-Frame specific uniforms
    uniform vec3 ambientLightColor;
    uniform vec3 directionalLightColor[5];
    uniform vec3 directionalLightDirection[5];
    
    // Texture map
    uniform sampler2D diffuseMap;
    uniform float useTexture;
    
    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    
    // Define border properties - REDUCED border width and adjusted threshold
    const float borderWidth = 0.02;
    const float edgeThreshold = 0.95;
    
    void main() {
        // Ensure normal is normalized
        vec3 normal = normalize(vNormal);
        
        // Calculate lighting
        vec3 lighting = ambientLightColor;
        
        // Add directional light contribution
        for (int i = 0; i < 5; i++) {
            if (length(directionalLightColor[i]) > 0.0) {
                vec3 directionalVector = normalize(directionalLightDirection[i]);
                float directional = max(dot(normal, directionalVector), 0.0);
                lighting += directionalLightColor[i] * directional;
            }
        }
        
        // Start with the base color * lighting (with minimum brightness)
        vec3 finalColor = vColor * max(lighting, vec3(0.4));
        
        // Sample texture if enabled
        if (useTexture > 0.5) {
            vec4 texColor = texture2D(diffuseMap, vUv);
            finalColor *= texColor.rgb;
        }
        
        // Hexagon border detection for top/bottom faces - MODIFIED to be less aggressive
        bool isBorder = false;
        
        // For top and bottom faces (horizontal surfaces)
        if (abs(normal.y) > 0.9) {
            // Distance from center in UV space
            vec2 centeredUv = 2.0 * vUv - vec2(1.0, 1.0);
            float distFromCenter = length(centeredUv);
            
            // Border at the edge of the hexagon - using higher threshold
            if (distFromCenter > edgeThreshold) {
                isBorder = true;
            }
        }
        // For side faces (vertical surfaces)
        else {
            // Check UV coordinates for vertical borders - thinner borders
            if (vUv.y < borderWidth || vUv.y > (1.0 - borderWidth)) {
                isBorder = true;
            }
        }
        
        // Apply border effects - only darken, don't make completely black
        if (isBorder) {
            finalColor *= 0.6; // Darken borders instead of making them black
        }
        
        // Apply height-based effects
        float heightFactor = clamp(vHeight / 20.0, 0.0, 1.0);
        
        // Snow on high peaks
        if (vHeight > 15.0 && normal.y > 0.7) {
            float snowAmount = smoothstep(15.0, 20.0, vHeight);
            finalColor = mix(finalColor, vec3(0.9, 0.9, 1.0), snowAmount * normal.y);
        }
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// Keep the same name as the original for drop-in compatibility
window.CubeTerrainBuilder = {
    // Create a mesh for a terrain chunk using instancing
    createChunkMesh: function(chunkData, material) {
        // Adapt to work with either cubes or hexagons
        const cubes = chunkData.cubes || chunkData.hexagons || [];
        
        if (cubes.length === 0) {
            console.log("No terrain elements in chunk data, returning empty group");
            return new THREE.Group();
        }
        
        console.log(`Creating instanced hexagon mesh with ${cubes.length} hexagons`);
        
        try {
            // Create a hexagon geometry instead of a box
            // Size 0.5 gives a similar footprint to a 1x1 cube
            const geometry = new THREE.HexagonGeometry(0.5, 1.0, false);
            
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
            
            console.log("Instanced hex mesh created successfully");
            return instancedMesh;
            
        } catch (error) {
            console.error("Error creating instanced hex mesh:", error);
            console.error("Error stack:", error.stack);
            return new THREE.Group(); // Return empty group on error
        }
    },
    
    // Keep the original function name for compatibility
    createCubeMaterial: function() {
        // Create a default empty texture first
        const emptyTexture = new THREE.Texture();
        
        // Check if textures are enabled in config
        const useTextures = window.HexConfig && window.HexConfig.useTextures !== undefined 
            ? window.HexConfig.useTextures 
            : true;
            
        // Get texture path from config or use default
        const texturePath = window.HexConfig && window.HexConfig.texturePath 
            ? window.HexConfig.texturePath 
            : 'assets/moon_tex.png';
            
        // Get texture scale from config or use default
        const textureScale = window.HexConfig && window.HexConfig.textureScale !== undefined 
            ? window.HexConfig.textureScale 
            : 1.0;
        
        console.log(`Texturing: ${useTextures ? 'Enabled' : 'Disabled'}`);
        
        // Create the material with the empty texture
        const material = new THREE.ShaderMaterial({
            vertexShader: window.cubeVertexShader,
            fragmentShader: window.cubeFragmentShader,
            vertexColors: true,
            lights: true,
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.lights,
                THREE.UniformsLib.common,
                {
                    diffuseMap: { value: emptyTexture },
                    useTexture: { value: 0.0 } // Start with texture disabled until it's loaded
                }
            ])
        });
        
        // Explicitly enable lights
        material.lights = true;
        
        // Only load texture if enabled in config
        if (useTextures) {
            // Load the texture asynchronously
            const textureLoader = new THREE.TextureLoader();
            
            console.log(`Loading texture from ${texturePath}...`);
            
            textureLoader.load(
                texturePath, 
                // Success callback
                function(loadedTexture) {
                    console.log("Texture loaded successfully");
                    
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
                    console.log(`Texture loading: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
                },
                // Error callback
                function(error) {
                    console.error(`Error loading texture from ${texturePath}:`, error);
                    // Try alternative path as fallback
                    const altPath = texturePath.startsWith('./') ? texturePath.substring(2) : './' + texturePath;
                    textureLoader.load(
                        altPath,
                        function(loadedTexture) {
                            console.log("Texture loaded successfully from alternative path");
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
    },
    
    // Helper utility functions for hexagon coordinates
    _axialToPixel: function(q, r, hexSize) {
        const x = hexSize * Math.sqrt(3) * (q + r/2);
        const z = hexSize * 3/2 * r;
        return {x, z};
    },
    
    _pixelToAxial: function(x, z, hexSize) {
        const q = (x * Math.sqrt(3)/3 - z/3) / hexSize;
        const r = z * 2/3 / hexSize;
        
        // We need to round to the nearest hexagon
        // Using cube coordinates for rounding then converting back
        let cubeX = q;
        let cubeZ = r;
        let cubeY = -cubeX - cubeZ;
        
        // Round cube coordinates
        let rx = Math.round(cubeX);
        let ry = Math.round(cubeY);
        let rz = Math.round(cubeZ);
        
        // Calculate differences
        const dx = Math.abs(rx - cubeX);
        const dy = Math.abs(ry - cubeY);
        const dz = Math.abs(rz - cubeZ);
        
        // Adjust based on largest difference
        if (dx > dy && dx > dz) {
            rx = -ry - rz;
        } else if (dy > dz) {
            ry = -rx - rz;
        } else {
            rz = -rx - ry;
        }
        
        // Convert back to axial
        return {q: rx, r: rz};
    }
};

// Use the same approach for modifying BoxGeometry for better compatibility
// Make BoxGeometry actually create a hexagon
THREE.BoxGeometry = THREE.HexagonGeometry;

console.log("Fixed hexagon geometry initialized as a drop-in replacement for cube geometry");