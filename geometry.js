// geometry.js - Defines our cube geometry and shaders for instanced rendering

console.log("Initializing cube geometry and shaders...");

// Make sure THREE is available from A-Frame
if (typeof THREE === 'undefined' && typeof AFRAME !== 'undefined') {
    console.log("Getting THREE from AFRAME");
    THREE = AFRAME.THREE;
}

// Define the shader for our instanced cubes
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
        
        // Scale cube vertically by instanceHeight
        if (position.y > 0.0) {
            transformed.y *= instanceHeight;
        }
        
        // Calculate world position
        vec3 worldPos = transformed + instancePosition;
        
        // Compute normal for lighting
        vNormal = normalMatrix * normal;
        
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
    
    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    
    // Define edge detection properties
    const float edgeWidth = 0.05;
    
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
        
        // Apply basic lighting to base color
        vec3 finalColor = vColor * max(lighting, vec3(0.3));
        
        // Add edge detection for cube borders
        bool isEdge = false;
        
        // Check if we're near any edge of the UV coordinates
        if (vUv.x < edgeWidth || vUv.x > (1.0 - edgeWidth) || 
            vUv.y < edgeWidth || vUv.y > (1.0 - edgeWidth)) {
            isEdge = true;
        }
        
        // Apply edge (darker color)
        if (isEdge) {
            finalColor *= 0.6; // Darken edges
        }
        
        // Apply height-based shading
        float heightFactor = clamp(vHeight / 20.0, 0.0, 1.0);
        
        // Snow on high peaks
        if (vHeight > 15.0 && normal.y > 0.7) {
            float snowAmount = smoothstep(15.0, 20.0, vHeight);
            finalColor = mix(finalColor, vec3(0.9, 0.9, 1.0), snowAmount * normal.y);
        }
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// Create the cube geometry class for reuse
window.CubeTerrainBuilder = {
    // Create a mesh for a terrain chunk using instancing
    createChunkMesh: function(chunkData, material) {
        const cubes = chunkData.cubes;
        
        if (cubes.length === 0) {
            console.log("No cubes in chunk data, returning empty group");
            return new THREE.Group();
        }
        
        console.log(`Creating instanced mesh with ${cubes.length} cubes`);
        
        try {
            // Create a simple cube geometry
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            
            // Create the instanced mesh
            const instancedMesh = new THREE.InstancedMesh(
                geometry,
                material,
                cubes.length
            );
            
            // Disable frustum culling to prevent chunks from disappearing at edges
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
                instancePositions[i * 3 + 1] = 0; // Bottom of cube starts at 0
                instancePositions[i * 3 + 2] = cube.position[2];
                
                // Height - ensure minimum height for visibility
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
            
            console.log("Instanced mesh created successfully");
            return instancedMesh;
            
        } catch (error) {
            console.error("Error creating instanced mesh:", error);
            console.error("Error stack:", error.stack);
            return new THREE.Group(); // Return empty group on error
        }
    },
    
    // Create shader material for the cubes
    createCubeMaterial: function() {
        const material = new THREE.ShaderMaterial({
            vertexShader: window.cubeVertexShader,
            fragmentShader: window.cubeFragmentShader,
            vertexColors: true,
            lights: true,
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.lights,
                THREE.UniformsLib.common
            ])
        });
        
        // Explicitly enable lights
        material.lights = true;
        
        return material;
    }
};

console.log("Cube geometry and shaders initialized");