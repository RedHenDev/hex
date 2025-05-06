// hex-simple.js - Simplified hexagon geometry with basic glowing pulse effect

// Global configuration
window.HexConfigSimple = {
    size: 2.4,                 // 2.4 2.54
    enablePulse: false,       // Toggle pulse effect
    pulseSpeed: 4.0,          // 4.0 Speed of the pulse
    pulseIntensity: 0.3,      // 0.3 Intensity of the pulse
    pulseSpacing: 1.0,        // 3.0 Spacing between waves of pulses
    enableOutline: true,     // Toggle cartoon outlines for terrain
    enableFloatingOutline: true, // Toggle cartoon outlines for floating formations
    enableVerticalEdges: false, // Toggle vertical edge outlines
    outlineThickness: 3.2,    // 0.4 Thickness of the outline
    outlineColor: [0.0, 0.0, 0.0], // Default outline color as RGB array
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
    // This size (2.54) corresponds to terrain-system geo size :(
    constructor(size = window.HexConfigSimple.size, height = 1, flatTop = false) {
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

// Vertex Shader – includes UV coordinates
window.simpleVertexShader = `
    attribute vec3 instancePosition;
    attribute float instanceHeight;
    attribute vec3 instanceColor;
    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vWorldPosition;
    varying vec2 vLocal;
    varying vec3 vNormal;
    varying vec2 vUv;  // UV coordinates
    varying float vFaceType; // 0: side, 1: top, -1: bottom
    void main() {
        vColor = instanceColor;
        vHeight = instanceHeight;
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;  // Pass UV coordinates
        vec3 transformed = position;
        if (position.y > 0.1) {
            transformed.y = position.y * instanceHeight;
        }
        vec3 worldPos = transformed + instancePosition;
        vWorldPosition = worldPos;
        vLocal = transformed.xz; // Local coordinates for outline
        if (abs(normal.y) > 0.9) {
            vFaceType = normal.y > 0.0 ? 1.0 : -1.0;
        } else {
            vFaceType = 0.0;
        }
        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// Updated Fragment Shader with adjusted outline thickness and logic
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
    uniform float enableOutline;
    uniform float outlineThickness; // Added
    uniform vec3 outlineColor; // Added uniform for outline color
    uniform float opacity;  // Add opacity uniform
    uniform float isFloatingFormation;  // Add new flag
    uniform float enableVerticalEdges;

    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vWorldPosition;
    varying vec2 vLocal;
    varying vec3 vNormal;
    varying vec2 vUv;  // UV coordinates
    varying float vFaceType; // 0: side, 1: top, -1: bottom

    // Compute minimum distance to any of the 6 hexagon edges (for top/bottom)
    float hexEdgeDistance(vec2 p, float r) {
        float minDist = 1e6;
        float angleOffset = 3.1415926 / 6.0;
        for (int i = 0; i < 6; i++) {
            float angle1 = angleOffset + float(i) * 3.1415926 / 3.0;
            float angle2 = angleOffset + float(i + 1) * 3.1415926 / 3.0;
            vec2 v1 = vec2(r * cos(angle1), r * sin(angle1));
            vec2 v2 = vec2(r * cos(angle2), r * sin(angle2));
            vec2 e = v2 - v1;
            vec2 w = p - v1;
            float t = clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
            vec2 proj = v1 + t * e;
            float dist = length(p - proj);
            minDist = min(minDist, dist);
        }
        return minDist;
    }

    // Compute minimum distance to any of the 6 vertical hexagon edges (for side faces)
    float hexVerticalEdgeDistance(vec2 p, float r) {
        float minDist = 1e6;
        float angleOffset = 3.1415926 / 6.0;
        for (int i = 0; i < 6; i++) {
            float angle = angleOffset + float(i) * 3.1415926 / 3.0;
            vec2 v = vec2(r * cos(angle), r * sin(angle));
            float dist = length(p - v);
            minDist = min(minDist, dist);
        }
        return minDist;
    }

    void main() {
        vec3 finalColor = vColor;
        if (pulseEnabled > 0.5) {
            float pulse = sin((time * pulseSpeed + vWorldPosition.y) / pulseSpacing) * 0.5 + 0.5;
            finalColor += pulse * pulseIntensity;
        }
        finalColor = pow(finalColor, vec3(1.0 / 2.2));
        
        // Apply outlines with adjusted scaling for floating formations
        if (enableOutline > 0.5) {
            float edgeFactor = 1.0;
            float edgeScale = isFloatingFormation > 0.5 ? 2.0 : 1.0;
            
            if (abs(vFaceType) > 0.5) {
                // Top or bottom face: outline all 6 edges robustly
                float d = hexEdgeDistance(vLocal, hexSize - 0.025 * edgeScale);
                float thickness = max(outlineThickness * edgeScale, 1.5 * fwidth(d));
                edgeFactor = smoothstep(0.0, thickness * 0.1, d);
            } else if (enableVerticalEdges > 0.5) {
                // Side face: outline vertical edges
                float d = hexVerticalEdgeDistance(vLocal, hexSize - 0.025 * edgeScale);
                float thickness = max(outlineThickness * edgeScale, 1.5 * fwidth(d));
                edgeFactor = smoothstep(0.0, thickness * 0.1, d);  // Increased from 0.25 to 0.5
            }
            finalColor = mix(outlineColor, finalColor, edgeFactor);
        }

        float finalOpacity = isFloatingFormation > 0.5 ? opacity : 1.0;
        vec4 color = vec4(finalColor, finalOpacity);
        
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
            // Use the size from the hex data or fall back to default
            const hexSize = cubes[0].size || window.HexConfigSimple.size;
            const geometry = new THREE.HexagonGeometry(hexSize, 1.0, false);
            
            // Update material's hexSize uniform to match geometry
            if (material.uniforms && material.uniforms.hexSize) {
                material.uniforms.hexSize.value = hexSize;
                material.needsUpdate = true;
            }
            
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
    createCubeMaterial: function(options = {}) {
        const needsTransparency = options.isFloatingFormation && options.opacity < 1.0;
        // Scale up outline thickness for floating formations
        const outlineThickness = options.isFloatingFormation ? 
            window.HexConfigSimple.outlineThickness * 2.0 : 
            window.HexConfigSimple.outlineThickness;

        // Determine outline enable state based on formation type
        const outlineEnabled = options.isFloatingFormation ? 
            window.HexConfigSimple.enableFloatingOutline : 
            window.HexConfigSimple.enableOutline;
        
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
                    hexSize: { value: window.HexConfigSimple.size }, // Will be updated per chunk based on geometry
                    enableOutline: { value: outlineEnabled ? 1.0 : 0.0 },
                    outlineThickness: { value: outlineThickness },
                    outlineColor: { value: new THREE.Color(...window.HexConfigSimple.outlineColor) }, // Set outline color
                    opacity: { value: options.opacity !== undefined ? options.opacity : 1.0 },
                    isFloatingFormation: { value: options.isFloatingFormation ? 1.0 : 0.0 },
                    enableVerticalEdges: { value: options.isFloatingFormation ? 1.0 : window.HexConfigSimple.enableVerticalEdges }
                }
            ]),
            transparent: needsTransparency,
            depthWrite: !needsTransparency
        });
        // NOTE: polygonOffset does NOT affect fragment-shader outlines, only geometry-based outlines.
        // For fragment-shader outlines, adjust thickness and smoothstep in the shader above.
        material.extensions = {
            derivatives: true,
            fragDepth: false,
            drawBuffers: false,
            shaderTextureLOD: false
        };
        // You may remove or set these to zero if not using geometry-based outlines:
        material.polygonOffset = false;
        material.polygonOffsetFactor = 0.0;
        material.polygonOffsetUnits = 0.0;
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

// Add a function to toggle outlines at runtime and update all materials
window.toggleHexOutline = function(enable) {
    window.HexConfigSimple.enableOutline = !!enable;
    const value = window.HexConfigSimple.enableOutline ? 1.0 : 0.0;
    (window._hexSimpleMaterials || []).forEach(mat => {
        if (mat.uniforms && mat.uniforms.enableOutline) {
            mat.uniforms.enableOutline.value = value;
            mat.needsUpdate = true;
        }
    });
    console.log("Hex outline is now", window.HexConfigSimple.enableOutline ? "ENABLED" : "DISABLED");
};

console.log("Simplified hexagon shaders with basic pulse initialized");