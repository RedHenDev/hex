// hex-geometry.js - Defines hexagon geometry and shader materials for terrain rendering

// Global configuration
window.HexConfig = {
    useTextures: false,
    texturePath: './assets/grass_13.png',
    textureScale: 1.0,
    enablePulse: true // <--- Add this parameter to toggle pulse effect
};

console.log("Initializing hexagon shaders with bioluminescent pulse...");

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
            bevelEnabled: false,
            UVGenerator: {
                generateTopUV: function(geometry, vertices, indexA, indexB, indexC) {
                    return [
                        new THREE.Vector2(0, 0),
                        new THREE.Vector2(1, 0),
                        new THREE.Vector2(0.5, 1)
                    ];
                },
                generateSideWallUV: function(geometry, vertices, indexA, indexB, indexC, indexD) {
                    return [
                        new THREE.Vector2(0, 0),
                        new THREE.Vector2(1, 0),
                        new THREE.Vector2(0, 1),
                        new THREE.Vector2(1, 1)
                    ];
                }
            }
        };
        
        const geometryData = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometryData.rotateX(-Math.PI / 2);
        this.copy(geometryData);
        this.computeVertexNormals();
    }
};

THREE.HexagonBufferGeometry = THREE.HexagonGeometry;

// Vertex Shader with added vTerrainHeight for height-based control
window.cubeVertexShader = `
    attribute vec3 instancePosition;
    attribute float instanceHeight;
    attribute vec3 instanceColor;
    
    uniform vec3 ambientLightColor;
    uniform vec3 directionalLightColor[5];
    uniform vec3 directionalLightDirection[5];
    
    varying float vFogDepth;
    varying vec3 vColor;
    varying float vHeight;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    varying float vTerrainHeight; // Added to pass terrain height to fragment shader
    
    void main() {
        vColor = instanceColor;
        vHeight = instanceHeight;
        vUv = uv;
        vPosition = position;
        
        vec3 transformed = position;
        if (position.y > 0.1) {
            transformed.y = (position.y * instanceHeight);
        }
        
        vec3 worldPos = transformed + instancePosition;
        vWorldPosition = worldPos;
        
        vNormal = normalMatrix * normal;
        
        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        vFogDepth = -mvPosition.z;
        vTerrainHeight = instancePosition.y; // Pass the terrain height
    }
`;

// Updated Fragment Shader with dendritic pulse effect and height-based control
window.cubeFragmentShader = `
// Simple hash function for noise
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// 2D noise function
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// FBM function for fractal noise
float fbm(vec2 p, int octaves) {
    float total = 0.0;
    float amplitude = 1.0;
    for (int i = 0; i < octaves; i++) {
        total += noise(p) * amplitude;
        p *= 2.0;
        amplitude *= 0.5;
    }
    return total;
}

uniform vec3 ambientLightColor;
uniform vec3 directionalLightColor[5];
uniform vec3 directionalLightDirection[5];
uniform sampler2D diffuseMap;
uniform float useTexture;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float time; // Time uniform for pulse effect
uniform float pulseThreshold; // Uniform to control height threshold for pulse
uniform float pulseEnabled; // <--- Add this uniform

varying float vFogDepth;
varying vec3 vColor;
varying float vHeight;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying float vTerrainHeight; // Received from vertex shader

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lighting = ambientLightColor;

    for (int i = 0; i < 5; i++) {
        if (length(directionalLightColor[i]) > 0.0) {
            vec3 directionalVector = normalize(directionalLightDirection[i]);
            float directional = max(dot(normal, directionalVector), 0.0);
            lighting += directionalLightColor[i] * directional;
        }
    }

    vec3 finalColor = vColor * max(lighting, vec3(0.3));

    if (useTexture > 0.5) {
        vec2 texUV = vec2(
            fract(vWorldPosition.x / 3.0),
            fract(vWorldPosition.z / 3.0)
        );
        vec4 texColor = texture2D(diffuseMap, texUV);
        finalColor *= texColor.rgb;
    }

    if (vHeight > 130.0 && normal.y > 0.03) {
        float snowAmount = smoothstep(30.0, 40.0, vHeight);
        finalColor = mix(finalColor, vec3(0.9, 0.9, 1.0), snowAmount * normal.y);
    }

    // Project pattern from the top face onto all faces to avoid vertical stretching
    // If on the side, use the xz position at the top of the prism
    float isSide = step(abs(normal.y), 0.5); // 1.0 for sides, 0.0 for top/bottom
    float topY = vWorldPosition.y + (1.0 - normal.y) * (vHeight - (vWorldPosition.y - vTerrainHeight));
    vec2 projectedXZ = vec2(vWorldPosition.x, vWorldPosition.z);
    vec2 patternPos = mix(projectedXZ, vec2(vWorldPosition.x, vWorldPosition.z), 1.0 - isSide);

    // For sides, override y with the top face y value
    if (isSide > 0.5) {
        patternPos = 4.4*vec2(vWorldPosition.x, vWorldPosition.z);
        // Optionally, you can use the xz at the top of the prism:
        // patternPos = vec2(vWorldPosition.x, vWorldPosition.z); // Already correct if prisms are axis-aligned
    }

    float noiseScale = 0.4;
    float noiseVal = fbm(patternPos * noiseScale, 8);

    float phaseInfluence = 6.0;
    float pulsePhase = dot(patternPos, vec2(0.1, 0.1)) + time * 2.0 + noiseVal * phaseInfluence;
    float pulse = sin(pulsePhase);
    pulse = (pulse + 1.0) * 0.5;

    float intensity = smoothstep(0.1, 0.9, noiseVal);
    float pulseFactor = smoothstep(pulseThreshold - 5.0, pulseThreshold + 5.0, vTerrainHeight);
    float sideAttenuation = clamp(normal.y, 1.0, 1.0);

    vec3 pulseColor = vec3(0.1, 0.3, 1.0);
    finalColor += pulseEnabled * (pulseColor * pulse * intensity * 0.3 * pulseFactor * sideAttenuation); // <--- Multiply by pulseEnabled

    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0/2.2));
    vec4 color = vec4(finalColor, 0.8);

    // Apply fog
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    color.rgb = mix(color.rgb, fogColor, fogFactor);

    gl_FragColor = color;
}
`;

// CubeTerrainBuilder with updated material creation
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
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1, 1);
        const fallbackTexture = new THREE.CanvasTexture(canvas);
        
        const useTextures = window.HexConfig && window.HexConfig.useTextures !== undefined 
            ? window.HexConfig.useTextures 
            : true;
        const texturePath = window.HexConfig && window.HexConfig.texturePath 
            ? window.HexConfig.texturePath 
            : './assets/grass_13.png';
        const textureScale = window.HexConfig && window.HexConfig.textureScale !== undefined 
            ? window.HexConfig.textureScale 
            : 1.0;
        
        const material = new THREE.ShaderMaterial({
            vertexShader: window.cubeVertexShader,
            fragmentShader: window.cubeFragmentShader,
            vertexColors: true,
            lights: true,
            fog: true,
            toneMapped: true,
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.lights,
                THREE.UniformsLib.common,
                THREE.UniformsLib.fog,
                {
                    diffuseMap: { value: fallbackTexture },
                    useTexture: { value: 0.0 },
                    time: { value: 0.0 }, // Time uniform for pulse effect
                    pulseThreshold: { value: 50.0 }, // Default height threshold for pulse
                    pulseEnabled: { value: window.HexConfig && window.HexConfig.enablePulse ? 1.0 : 0.0 } // <--- Set from config
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
        
        if (useTextures) {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(
                texturePath, 
                function(loadedTexture) {
                    loadedTexture.wrapS = THREE.RepeatWrapping;
                    loadedTexture.wrapT = THREE.RepeatWrapping;
                    loadedTexture.repeat.set(1.0, 1.0);
                    loadedTexture.magFilter = THREE.LinearFilter;
                    loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
                    if (typeof AFRAME !== 'undefined' && AFRAME.THREE && AFRAME.THREE.renderer) {
                        const maxAnisotropy = AFRAME.THREE.renderer.capabilities.getMaxAnisotropy();
                        loadedTexture.anisotropy = maxAnisotropy;
                    }
                    material.uniforms.diffuseMap.value = loadedTexture;
                    material.uniforms.useTexture.value = 1.0;
                    loadedTexture.needsUpdate = true;
                    const event = new CustomEvent('textureLoaded', { 
                        detail: { texture: loadedTexture, scale: textureScale }
                    });
                    document.dispatchEvent(event);
                },
                function(xhr) {},
                function(error) {
                    console.error(`Error loading texture from ${texturePath}:`, error);
                    const altPath = texturePath.startsWith('./') ? texturePath.substring(2) : './' + texturePath;
                    textureLoader.load(
                        altPath,
                        function(loadedTexture) {
                            loadedTexture.wrapS = THREE.RepeatWrapping;
                            loadedTexture.wrapT = THREE.RepeatWrapping;
                            loadedTexture.repeat.set(1.0, 1.0);
                            loadedTexture.magFilter = THREE.LinearFilter;
                            loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
                            if (typeof AFRAME !== 'undefined' && AFRAME.THREE && AFRAME.THREE.renderer) {
                                const maxAnisotropy = AFRAME.THREE.renderer.capabilities.getMaxAnisotropy();
                                loadedTexture.anisotropy = maxAnisotropy;
                            }
                            material.uniforms.diffuseMap.value = loadedTexture;
                            material.uniforms.useTexture.value = 1.0;
                            loadedTexture.needsUpdate = true;
                            const event = new CustomEvent('textureLoaded', { 
                                detail: { texture: loadedTexture, scale: textureScale }
                            });
                            document.dispatchEvent(event);
                        },
                        undefined,
                        function(secondError) {
                            console.error("Failed to load texture from both paths:", secondError);
                            material.uniforms.useTexture.value = 0.0;
                            const event = new CustomEvent('textureLoadFailed');
                            document.dispatchEvent(event);
                        }
                    );
                }
            );
        } else {
            const event = new CustomEvent('textureDisabled');
            document.dispatchEvent(event);
        }
        
        return material;
    }
};

console.log("Hexagon shaders with bioluminescent pulse initialized");