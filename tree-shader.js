// tree-shader.js - Instanced tree rendering with hexagonal aesthetic and pulsing effect

console.log("Initializing tree shaders with hexagonal aesthetic...");

// Ensure THREE is available from A-Frame
if (typeof THREE === 'undefined' && typeof AFRAME !== 'undefined') {
    console.log("Getting THREE from AFRAME");
    THREE = AFRAME.THREE;
}

// Tree geometry: hexagonal trunk and foliage as a single geometry
THREE.TreeGeometry = class TreeGeometry extends THREE.BufferGeometry {
    constructor(trunkSize = 0.8, trunkHeight = 6, foliageSize = 8) {
        super();
        this.type = 'TreeGeometry';

        const positions = [];
        const uvs = [];
        const indices = [];

        // Trunk bottom vertices (indices 0-5)
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            const x = trunkSize * Math.cos(angle);
            const z = trunkSize * Math.sin(angle);
            positions.push(x, 0, z);
            uvs.push(i / 6, 0);
        }

        // Trunk top vertices (indices 6-11)
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            const x = trunkSize * Math.cos(angle);
            const z = trunkSize * Math.sin(angle);
            positions.push(x, trunkHeight, z);
            uvs.push(i / 6, 1);
        }

        // Foliage center vertex (index 12)
        positions.push(0, trunkHeight, 0);
        uvs.push(0.5, 0.5);

        // Foliage surrounding vertices (indices 13-18)
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            const x = foliageSize * Math.cos(angle);
            const z = foliageSize * Math.sin(angle);
            positions.push(x, trunkHeight, z);
            uvs.push(i / 6, 0.5);
        }

        // Trunk indices (6 sides, each with 2 triangles)
        for (let i = 0; i < 6; i++) {
            const bottomI = i;
            const bottomNext = (i + 1) % 6;
            const topI = i + 6;
            const topNext = (i + 1) % 6 + 6;
            indices.push(bottomI, bottomNext, topI);    // Triangle 1
            indices.push(topI, topNext, bottomNext);    // Triangle 2
        }

        // Foliage indices (6 triangles forming a hexagon)
        for (let i = 0; i < 6; i++) {
            const center = 12;
            const a = 13 + i;
            const b = 13 + (i + 1) % 6;
            indices.push(center, a, b);
        }

        // Set geometry attributes
        this.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        this.setIndex(new THREE.Uint32BufferAttribute(indices, 1));

        // Compute vertex normals for proper lighting
        this.computeVertexNormals();
    }
};

// Vertex Shader
window.treeVertexShader = `
    attribute vec3 instancePosition;
    attribute float instanceScale;
    attribute vec3 instanceColor;
    attribute float instanceRotation;

    varying vec3 vColor;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    void main() {
        vColor = instanceColor;
        vUv = uv;

        vec3 transformed = position;
        transformed *= instanceScale;
        
        // Apply rotation around Y-axis
        float cosA = cos(instanceRotation);
        float sinA = sin(instanceRotation);
        vec3 rotated = vec3(
            transformed.x * cosA - transformed.z * sinA,
            transformed.y,
            transformed.x * sinA + transformed.z * cosA
        );

        vec3 worldPos = rotated + instancePosition;
        vWorldPosition = worldPos;

        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// Fragment Shader with pulsing effect and alpha transparency
window.treeFragmentShader = `
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform float time;
    uniform float pulseSpeed;
    uniform float pulseIntensity;
    uniform float pulseEnabled;
    uniform float pulseSpacing;

    varying vec3 vColor;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    // Simple 2D noise for alpha variation
    float random(vec2 st) {
        return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
        vec3 finalColor = vColor;

        // Apply alpha transparency for foliage (y > 6 is foliage)
        float alpha = 1.0;
        if (vWorldPosition.y > 6.0) {
            float noise = random(vUv + time * 0.1);
            alpha = smoothstep(0.3, 0.7, noise);
            if (alpha < 0.4) discard; // Create gaps
        }

        // Pulse effect
        if (pulseEnabled > 0.5) {
            float pulse = sin((time * pulseSpeed + vWorldPosition.y) / pulseSpacing) * 0.5 + 0.5;
            finalColor += pulse * pulseIntensity;
        }

        // Gamma correction
        finalColor = pow(finalColor, vec3(1.0 / 2.2));
        vec4 color = vec4(finalColor, alpha);

        // Apply fog
        float fogFactor = smoothstep(fogNear, fogFar, length(vWorldPosition));
        color.rgb = mix(color.rgb, fogColor, fogFactor);

        gl_FragColor = color;
    }
`;

// Store materials for runtime updates
window._treeMaterials = [];

// TreeBuilder for instanced rendering
window.TreeBuilder = {
    createTreeMesh: function(treeData, maxCount) {
        try {
            const geometry = new THREE.TreeGeometry();
            console.log("Tree geometry created:", geometry);
            console.log("Attributes:", geometry.attributes);
            console.log("Index:", geometry.index);

            const material = this.createTreeMaterial();
            const instancedMesh = new THREE.InstancedMesh(geometry, material, maxCount);
            instancedMesh.frustumCulled = false;

            // Set up instanced attributes
            const instancePositions = new Float32Array(maxCount * 3);
            const instanceScales = new Float32Array(maxCount);
            const instanceColors = new Float32Array(maxCount * 3);
            const instanceRotations = new Float32Array(maxCount);

            for (let i = 0; i < maxCount; i++) {
                instancePositions[i * 3] = 0;
                instancePositions[i * 3 + 1] = -999;
                instancePositions[i * 3 + 2] = 0;
                instanceScales[i] = 1.0;
                instanceColors[i * 3] = 0.55; // Brown for trunk
                instanceColors[i * 3 + 1] = 0.27;
                instanceColors[i * 3 + 2] = 0.07;
                instanceRotations[i] = 0;
            }

            geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
            geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 1));
            geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 3));
            geometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(instanceRotations, 1));

            return instancedMesh;
        } catch (error) {
            console.error("Error creating instanced tree mesh:", error);
            return new THREE.Group();
        }
    },

    createTreeMaterial: function() {
        const material = new THREE.ShaderMaterial({
            vertexShader: window.treeVertexShader,
            fragmentShader: window.treeFragmentShader,
            vertexColors: true,
            transparent: true,
            fog: true,
            uniforms: {
                time: { value: 0.0 },
                pulseSpeed: { value: window.HexConfigSimple.pulseSpeed || 4.0 },
                pulseIntensity: { value: window.HexConfigSimple.pulseIntensity || 0.3 },
                pulseSpacing: { value: window.HexConfigSimple.pulseSpacing || 3.0 },
                pulseEnabled: { value: window.HexConfigSimple.enablePulse ? 1.0 : 0.0 },
                fogColor: { value: new THREE.Color(0x00BAFF) },
                fogNear: { value: 0 },
                fogFar: { value: 760 }
            }
        });

        material.extensions = {
            derivatives: true
        };

        window._treeMaterials.push(material);
        return material;
    },

    updateTrees: function(mesh, trees, activeCount) {
        const positions = mesh.geometry.attributes.instancePosition.array;
        const scales = mesh.geometry.attributes.instanceScale.array;
        const colors = mesh.geometry.attributes.instanceColor.array;
        const rotations = mesh.geometry.attributes.instanceRotation.array;

        for (let i = 0; i < mesh.count; i++) {
            if (i < activeCount) {
                const tree = trees[i];
                positions[i * 3] = tree.position.x;
                positions[i * 3 + 1] = tree.position.y;
                positions[i * 3 + 2] = tree.position.z;
                scales[i] = tree.scale;
                colors[i * 3] = tree.color[0];
                colors[i * 3 + 1] = tree.color[1];
                colors[i * 3 + 2] = tree.color[2];
                rotations[i] = tree.rotation;
            } else {
                positions[i * 3 + 1] = -999; // Hide inactive trees
            }
        }

        mesh.geometry.attributes.instancePosition.needsUpdate = true;
        mesh.geometry.attributes.instanceScale.needsUpdate = true;
        mesh.geometry.attributes.instanceColor.needsUpdate = true;
        mesh.geometry.attributes.instanceRotation.needsUpdate = true;
    }
};

// Update material uniforms in sync with terrain pulse
window.updateTreeMaterials = function() {
    (window._treeMaterials || []).forEach(mat => {
        if (mat.uniforms) {
            mat.uniforms.time.value = performance.now() / 1000.0;
            mat.uniforms.pulseEnabled.value = window.HexConfigSimple.enablePulse ? 1.0 : 0.0;
        }
    });
};

console.log("Tree shaders initialized with hexagonal aesthetic");