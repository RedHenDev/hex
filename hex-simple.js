// hex-simple.js - Simplified hexagon geometry with basic glowing pulse effect

// Global configuration
window.HexConfigSimple = {
    enablePulse: true, // Toggle pulse effect
    pulseSpeed: 1.0,   // Speed of the pulse
    pulseIntensity: 0.5, // Intensity of the pulse
    pulseSpacing: 1.0  // Spacing between waves of pulses
};

console.log("Initializing simplified hexagon shaders with basic pulse...");

// Ensure THREE is available from A-Frame
if (typeof THREE === 'undefined' && typeof AFRAME !== 'undefined') {
    console.log("Getting THREE from AFRAME");
    THREE = AFRAME.THREE;
}

// Suppress legacy lights warning by enabling physically correct lights
if (typeof THREE !== 'undefined') {
    THREE.ColorManagement.enabled = true;
    if (typeof AFRAME !== 'undefined' && AFRAME.THREE) {
        AFRAME.THREE.ColorManagement.enabled = true;
    }
    console.log("Updated lighting configuration for modern THREE.js");
}

// Define a custom HexagonGeometry class for THREE.js
THREE.HexagonGeometry = class HexagonGeometry extends THREE.BufferGeometry {
    constructor(size = 2.54, height = 1, flatTop = false) {
        super();
        this.type = 'HexagonGeometry';
        this.parameters = {
            size: size,
            height: height,
            flatTop: flatTop
        };
        
        const startAngle = flatTop ? 0 : Math.PI / 6;
        const shape = new THREE.Shape();
        const vertices = [];
        
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
        
        const extrudeSettings = {
            depth: height,
            bevelEnabled: false
        };
        
        const geometryData = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometryData.rotateX(-Math.PI / 2);
        this.copy(geometryData);
        this.computeVertexNormals();
    }
};

THREE.HexagonBufferGeometry = THREE.HexagonGeometry;

// Vertex Shader
window.simpleVertexShader = `
    attribute vec3 instancePosition;
    attribute float instanceHeight;
    attribute vec3 instanceColor;
    
    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vWorldPosition;

    void main() {
        vColor = instanceColor;
        vHeight = instanceHeight;

        vec3 transformed = position;
        if (position.y > 0.1) {
            transformed.y = (position.y * instanceHeight);
        }
        
        vec3 worldPos = transformed + instancePosition;
        vWorldPosition = worldPos;

        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// Fragment Shader with simple glowing pulse effect
window.simpleFragmentShader = `
uniform vec3 ambientLightColor;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float time; // Time uniform for pulse effect
uniform float pulseSpeed; // Speed of the pulse
uniform float pulseIntensity; // Intensity of the pulse
uniform float pulseEnabled; // Toggle pulse effect
uniform float pulseSpacing; // Spacing between waves of pulses

varying vec3 vColor;
varying float vHeight;
varying vec3 vWorldPosition;

void main() {
    vec3 finalColor = vColor;

    // Simple pulse effect
    if (pulseEnabled > 0.5) {
        float pulse = sin((time * pulseSpeed + vWorldPosition.y) / pulseSpacing) * 0.5 + 0.5;
        finalColor += pulse * pulseIntensity;
    }

    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0 / 2.2));
    vec4 color = vec4(finalColor, 1.0);

    // Apply fog
    float fogFactor = smoothstep(fogNear, fogFar, -gl_FragCoord.z);
    color.rgb = mix(color.rgb, fogColor, fogFactor);

    gl_FragColor = color;
}
`;

// CubeTerrainBuilder with simplified material creation
window.CubeTerrainBuilder = {
    createChunkMesh: function(chunkData, material) {
        const cubes = chunkData.cubes || chunkData.hexagons || [];
        if (cubes.length === 0) {
            console.log("No terrain elements in chunk data, returning empty group");
            return new THREE.Group();
        }
        try {
            const geometry = new THREE.HexagonGeometry(2.54, 1.0, false);
            const instancedMesh = new THREE.InstancedMesh(geometry, material, cubes.length);
            instancedMesh.frustumCulled = false;
            
            const instancePositions = new Float32Array(cubes.length * 3);
            const instanceHeights = new Float32Array(cubes.length);
            const instanceColors = new Float32Array(cubes.length * 3);
            
            for (let i = 0; i < cubes.length; i++) {
                const cube = cubes[i];
                instancePositions[i * 3] = cube.position[0];
                instancePositions[i * 3 + 1] = cube.position[1] || 0;
                instancePositions[i * 3 + 2] = cube.position[2];
                instanceHeights[i] = Math.max(0.1, cube.height);
                instanceColors[i * 3] = cube.color[0];
                instanceColors[i * 3 + 1] = cube.color[1];
                instanceColors[i * 3 + 2] = cube.color[2];
            }
            
            geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
            geometry.setAttribute('instanceHeight', new THREE.InstancedBufferAttribute(instanceHeights, 1));
            geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 3));
            
            return instancedMesh;
        } catch (error) {
            console.error("Error creating instanced hex mesh:", error);
            return new THREE.Group();
        }
    },
    
    createCubeMaterial: function() {
        const material = new THREE.ShaderMaterial({
            vertexShader: window.simpleVertexShader,
            fragmentShader: window.simpleFragmentShader,
            vertexColors: true,
            lights: true,
            fog: true,
            toneMapped: true,
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.lights,
                THREE.UniformsLib.common,
                THREE.UniformsLib.fog,
                {
                    time: { value: 0.0 }, // Time uniform for pulse effect
                    pulseSpeed: { value: window.HexConfigSimple.pulseSpeed || 2.0 },
                    pulseIntensity: { value: window.HexConfigSimple.pulseIntensity || 0.5 },
                    pulseSpacing: { value: window.HexConfigSimple.pulseSpacing || 1.0 }, // Add pulseSpacing uniform
                    pulseEnabled: { value: window.HexConfigSimple.enablePulse ? 1.0 : 0.0 }
                }
            ])
        });
        
        material.extensions = {
            derivatives: true,
            fragDepth: false,
            drawBuffers: false,
            shaderTextureLOD: false
        };
        material.lights = true;
        
        return material;
    }
};

console.log("Simplified hexagon shaders with basic pulse initialized");
