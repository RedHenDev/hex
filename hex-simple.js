// hex-simple.js - Simplified hexagon geometry with basic glowing pulse effect

// Global configuration
window.HexConfigSimple = {
    enablePulse: false,       // Toggle pulse effect
    pulseSpeed: 4.0,          // Speed of the pulse
    pulseIntensity: 0.3,      // Intensity of the pulse
    pulseSpacing: 3.0,        // Spacing between waves of pulses
    enableOutline: false,      // NEW: Toggle cartoon outlines
    applyToGenerator: function(generator) {
        if (generator) {
            // ...existing assignments...
        }
    }
};

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

// Vertex Shader – fixed and cleaned up:
window.simpleVertexShader = `
    attribute vec3 instancePosition;
    attribute float instanceHeight;
    attribute vec3 instanceColor;
    
    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vWorldPosition;
    varying vec2 vLocal; // local hexagon coordinate

    void main() {
        vColor = instanceColor;
        vHeight = instanceHeight;
        vec3 transformed = position;
        if (position.y > 0.1) {
            transformed.y = position.y * instanceHeight;
        }
        vec3 worldPos = transformed + instancePosition;
        vWorldPosition = worldPos;
        vLocal = transformed.xz; // pass local coordinates for outline
        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// Updated Fragment Shader with thicker outlines:
window.simpleFragmentShader = `
    uniform vec3 ambientLightColor;
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform float time;
    uniform float pulseSpeed;
    uniform float pulseIntensity;
    uniform float pulseEnabled;
    uniform float pulseSpacing;
    uniform float hexSize;
    uniform float enableOutline; // NEW

    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vWorldPosition;
    varying vec2 vLocal;

    float sdHexagon(vec2 p, float r) {
        vec2 k = vec2(-0.8660254, 0.5);
        p = abs(p);
        return max(dot(k, p), p.x) - r;
    }

    void main() {
        vec3 finalColor = vColor;
        if (pulseEnabled > 0.5) {
            float pulse = sin((time * pulseSpeed + vWorldPosition.y) / pulseSpacing) * 0.5 + 0.5;
            finalColor += pulse * pulseIntensity;
        }
        finalColor = pow(finalColor, vec3(1.0 / 2.2));
        
        // Apply cartoon outline only when enabled.
        if (enableOutline > 0.5) {
            float d = sdHexagon(vLocal, hexSize);
            float thickness = 0.33; // increased thickness for more distinct outlines
            float edgeFactor = smoothstep(0.0, fwidth(d), abs(d) - thickness);
            finalColor = mix(vec3(0.0), finalColor, edgeFactor);
        }

        vec4 color = vec4(finalColor, 1.0);
        float fogFactor = smoothstep(fogNear, fogFar, -gl_FragCoord.z);
        color.rgb = mix(color.rgb, fogColor, fogFactor);
        gl_FragColor = color;
    }
`;

// Store created materials for runtime updates
window._hexSimpleMaterials = [];

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
                    time: { value: 0.0 },
                    pulseSpeed: { value: window.HexConfigSimple.pulseSpeed || 2.0 },
                    pulseIntensity: { value: window.HexConfigSimple.pulseIntensity || 0.5 },
                    pulseSpacing: { value: window.HexConfigSimple.pulseSpacing || 1.0 },
                    pulseEnabled: { value: window.HexConfigSimple.enablePulse ? 1.0 : 0.0 },
                    hexSize: { value: 2.54 }, // use same value as the geometry size
                    enableOutline: { value: window.HexConfigSimple.enableOutline ? 1.0 : 0.0 } // NEW
                }
            ])
        });
        material.extensions = {
            derivatives: true,
            fragDepth: false,
            drawBuffers: false,
            shaderTextureLOD: false
        };
        window._hexSimpleMaterials.push(material);
        return material;
    }
};

// Add a function to toggle pulse at runtime and update all materials
window.toggleHexPulse = function(enable) {
    window.HexConfigSimple.enablePulse = !!enable;
    const value = window.HexConfigSimple.enablePulse ? 1.0 : 0.0;
    (window._hexSimpleMaterials || []).forEach(mat => {
        if (mat.uniforms && mat.uniforms.pulseEnabled) {
            mat.uniforms.pulseEnabled.value = value;
            mat.needsUpdate = true;
        }
    });
    console.log("Pulse effect is now", window.HexConfigSimple.enablePulse ? "ENABLED" : "DISABLED");
};

console.log("Simplified hexagon shaders with basic pulse initialized");
