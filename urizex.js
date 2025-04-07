// Simple implementation of Perlin Noise
const PerlinNoise = {
    // Permutation table
    p: new Array(512),
    
    // Initialize with a random seed
    seed: function(seed) {
        if(seed > 0 && seed < 1) {
            // Scale the seed out
            seed *= 65536;
        }
        
        seed = Math.floor(seed);
        if(seed < 256) {
            seed |= seed << 8;
        }
        
        const perm = new Array(256);
        for(let i = 0; i < 256; i++) {
            const v = i & 1 ? 
                (seed ^ (seed >> 1) ^ (seed >> 2) ^ (seed >> 3) ^ (seed >> 4)) & 0xFF :
                seed & 0xFF;
            perm[i] = v;
        }
        
        // Copy to p array
        for(let i = 0; i < 256; i++) {
            this.p[i] = this.p[i + 256] = perm[i];
        }
    },
    
    // Fade function
    fade: function(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    },
    
    // Linear interpolation
    lerp: function(t, a, b) {
        return a + t * (b - a);
    },
    
    // Gradient function
    grad: function(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    },
    
    // 2D Perlin noise
    perlin2: function(x, y) {
        // Find unit grid cell containing point
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        // Get relative coords of point within cell
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        // Compute fade curves
        const u = this.fade(x);
        const v = this.fade(y);
        
        // Hash coordinates of the 4 square corners
        const A = this.p[X] + Y;
        const B = this.p[X + 1] + Y;
        
        // And add blended results from 4 corners of square
        return this.lerp(v, 
            this.lerp(u, 
                this.grad(this.p[A], x, y, 0),
                this.grad(this.p[B], x-1, y, 0)
            ),
            this.lerp(u,
                this.grad(this.p[A+1], x, y-1, 0),
                this.grad(this.p[B+1], x-1, y-1, 0)
            )
        );
    }
};

// Define TerrainGenerator class that can be used by the worker
class TerrainGenerator {
    constructor(options = {}) {
        // Parameters for the terrain
        this.hexSize = options.hexSize || 1.0; // Size of each hexagon
        this.heightScale = options.heightScale || 8.0; // Maximum height
        this.noiseScale = options.noiseScale || 0.1; // Scale factor for noise
        this.baseHeight = options.baseHeight || 0.2; // Minimum height
        this.maxSlopeDifference = options.maxSlopeDifference || 2.0; // Maximum height difference
        this.seed = options.seed || Math.floor(Math.random() * 65536);
        
        // Initialize noise with the seed
        PerlinNoise.seed(this.seed);
    }
    
    // Helper function to convert axial coordinates (q,r) to pixel (x,z)
    // Using "pointy-top" hex orientation
    axialToPixel(q, r) {
        const x = this.hexSize * Math.sqrt(3) * (q + r/2);
        const z = this.hexSize * 3/2 * r;
        return {x, z};
    }
    
    // Helper function to get a unique key for coordinates
    coordKey(q, r) {
        return `${q},${r}`;
    }
    
    // Generate a chunk of terrain
    generateChunk(chunkX, chunkZ, chunkSize) {
        // Create a map to store the heights for each coordinate
        const heightMap = new Map();
        
        // Convert chunk world coordinates to axial coordinates
        const hexWidth = this.hexSize * Math.sqrt(3);
        const hexHeight = this.hexSize * 1.5;
        
        // Calculate the base axial coordinates for this chunk
        // We need to convert from world space to axial coordinates
        const baseQ = Math.floor(chunkX / hexWidth);
        const baseR = Math.floor(chunkZ / hexHeight);
        
        // Collection to track valid hexagons
        const validHexagons = [];
        
        // First pass: Calculate heights for all positions in this chunk and surrounding area (for slope checks)
        // We need to calculate a bit more than just the chunk to check slopes at edges
        for (let q = baseQ - 1; q <= baseQ + chunkSize + 1; q++) {
            for (let r = baseR - 1; r <= baseR + chunkSize + 1; r++) {
                // Convert hex coordinates to Cartesian
                const {x, z} = this.axialToPixel(q, r);
                
                // Generate height based on Perlin noise (range approximately -1 to 1)
                const noiseValue = PerlinNoise.perlin2(x * this.noiseScale, z * this.noiseScale);
                // Convert to range 0 to 1
                const normalizedNoiseValue = (noiseValue + 1) / 2;
                // Calculate height
                const height = this.baseHeight + normalizedNoiseValue * this.heightScale;
                
                // Store the height
                heightMap.set(this.coordKey(q, r), height);
            }
        }
        
        // Second pass: Collect valid hexagon data for instancing (only for hexes in the chunk)
        for (let q = baseQ; q < baseQ + chunkSize; q++) {
            for (let r = baseR; r < baseR + chunkSize; r++) {
                // Get the height at this position
                const currentHeight = heightMap.get(this.coordKey(q, r));
                
                // Skip if height is undefined (shouldn't happen for the main chunk)
                if (currentHeight === undefined) continue;
                
                // Check neighbors for steep slopes
                const neighbors = [
                    {q: q+1, r: r}, {q: q, r: r+1}, {q: q-1, r: r+1},
                    {q: q-1, r: r}, {q: q, r: r-1}, {q: q+1, r: r-1}
                ];
                
                // Flag to indicate if this hex has steep neighbors
                let hasSteepSlope = false;
                
                // Check each neighbor
                for (const neighbor of neighbors) {
                    const neighborHeight = heightMap.get(this.coordKey(neighbor.q, neighbor.r));
                    
                    // Skip if neighbor is outside calculated area
                    if (neighborHeight === undefined) continue;
                    
                    // Check if slope is too steep
                    if (Math.abs(currentHeight - neighborHeight) > this.maxSlopeDifference) {
                        hasSteepSlope = true;
                        break;
                    }
                }
                
                // Skip this hex if it has steep slopes
                if (hasSteepSlope) continue;
                
                // Convert hex coordinates to Cartesian
                const {x, z} = this.axialToPixel(q, r);
                
                // Calculate normalized height for color (0 to 1)
                const normalizedHeight = (currentHeight - this.baseHeight) / this.heightScale;
                
                // Color based on height
                // Green for low areas, brown for mountains
                const hue = Math.max(30, Math.min(120, 120 - 90 * normalizedHeight));
                const sat = 60 + 20 * normalizedHeight;
                const light = 60 - 30 * normalizedHeight;
                
                // Convert HSL to RGB
                const h = hue / 360;
                const s = sat / 100;
                const l = light / 100;
                
                let r1, g1, b1;
                
                if (s === 0) {
                    r1 = g1 = b1 = l; // achromatic
                } else {
                    const hue2rgb = (p, q, t) => {
                        if (t < 0) t += 1;
                        if (t > 1) t -= 1;
                        if (t < 1/6) return p + (q - p) * 6 * t;
                        if (t < 1/2) return q;
                        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                        return p;
                    };
                    
                    const q1 = l < 0.5 ? l * (1 + s) : l + s - l * s;
                    const p1 = 2 * l - q1;
                    
                    r1 = hue2rgb(p1, q1, h + 1/3);
                    g1 = hue2rgb(p1, q1, h);
                    b1 = hue2rgb(p1, q1, h - 1/3);
                }
                
                // Add this hexagon to our collection
                validHexagons.push({
                    position: [x, 0, z], // Base position (y=0)
                    height: currentHeight,
                    color: [r1, g1, b1]
                });
            }
        }
        
        // Return chunk data
        return {
            chunkX: chunkX,
            chunkZ: chunkZ,
            size: chunkSize,
            hexagons: validHexagons
        };
    }
}

// Export for web workers in a way that works in both browsers and workers
if (typeof self !== 'undefined' && typeof self.importScripts === 'function') {
    // We're in a worker - just export the necessary components
    self.TerrainGenerator = TerrainGenerator;
    self.PerlinNoise = PerlinNoise;
} else if (typeof window !== 'undefined') {
    // We're in a browser - export and set up UI initialization
    window.TerrainGenerator = TerrainGenerator;
    window.PerlinNoise = PerlinNoise;
    
    // Wait for the scene to load before generating the terrain (legacy function)
    document.addEventListener('DOMContentLoaded', function() {
        // Make sure to wait for A-Frame to initialize
        const checkScene = function() {
            const scene = document.querySelector('a-scene');
            if (scene) {
                // If scene exists, wait for it to be loaded
                if (scene.hasLoaded) {
                    // Check if we're running in legacy mode (no chunk manager)
                    if (typeof TerrainChunkManager === 'undefined') {
                        console.log("Running in legacy mode - generating single terrain chunk");
                        generateInstancingTerrain();
                    }
                } else {
                    scene.addEventListener('loaded', function () {
                        // Check if we're running in legacy mode (no chunk manager)
                        if (typeof TerrainChunkManager === 'undefined') {
                            console.log("Running in legacy mode - generating single terrain chunk");
                            generateInstancingTerrain();
                        }
                    });
                }
            } else {
                // If scene doesn't exist yet, try again in a moment
                setTimeout(checkScene, 100);
            }
        };
        
        // Start checking for the scene
        checkScene();
    });
}

// Original function for legacy support (single large terrain)
function generateInstancingTerrain() {
    // Parameters for the terrain
    const gridRadius = 88; // Size of the hexagonal grid
    const hexSize = 1.0; // Size of each hexagon
    
    // Create a terrain generator with default settings
    const generator = new TerrainGenerator();
    
    // Generate a single large chunk
    const chunkData = generator.generateChunk(-gridRadius * hexSize, -gridRadius * hexSize, gridRadius * 2);
    
    // Create the instanced mesh
    createInstancedHexagonMesh(chunkData.hexagons);
}

// Original mesh creation function for legacy support
function createInstancedHexagonMesh(hexagons) {
    // We need to access Three.js directly for instancing
    const scene = document.querySelector('a-scene').object3D;
    
    // Create a hexagonal cylinder geometry for the base shape
    const geometry = new THREE.CylinderGeometry(0.95, 0.95, 1.0, 6, 1, false);
    
    // Move the geometry origin to the bottom of the cylinder instead of center
    geometry.translate(0, 0.5, 0);
    
    // Get the shader code directly from the script tags
    const vertexShaderElement = document.getElementById('vertexShader');
    const fragmentShaderElement = document.getElementById('fragmentShader');
    
    if (!vertexShaderElement || !fragmentShaderElement) {
        console.error('Shader script elements not found!');
        return;
    }
    
    // Create shader material
    const material = new THREE.ShaderMaterial({
        vertexShader: vertexShaderElement.textContent,
        fragmentShader: fragmentShaderElement.textContent,
        vertexColors: true,
        lights: true,
        flatShading: true,
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.lights,
            THREE.UniformsLib.common
        ])
    });
    
    // Explicitly enable lights for shader material
    material.lights = true;
    
    // Create the instanced mesh
    const instancedMesh = new THREE.InstancedMesh(
        geometry,
        material,
        hexagons.length
    );
    
    // Set frustum culling to false to prevent disappearing when camera moves
    instancedMesh.frustumCulled = false;
    
    // Create buffer attributes for instance data
    const instancePositions = new Float32Array(hexagons.length * 3);
    const instanceHeights = new Float32Array(hexagons.length);
    const instanceColors = new Float32Array(hexagons.length * 3);
    
    // Fill the instance buffers
    for (let i = 0; i < hexagons.length; i++) {
        const hexagon = hexagons[i];
        
        // Position (x, y, z)
        instancePositions[i * 3] = hexagon.position[0];
        instancePositions[i * 3 + 1] = hexagon.position[1];
        instancePositions[i * 3 + 2] = hexagon.position[2];
        
        // Height
        instanceHeights[i] = hexagon.height;
        
        // Color (r, g, b)
        instanceColors[i * 3] = hexagon.color[0];
        instanceColors[i * 3 + 1] = hexagon.color[1];
        instanceColors[i * 3 + 2] = hexagon.color[2];
    }
    
    // Add the attributes to the geometry
    geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    geometry.setAttribute('instanceHeight', new THREE.InstancedBufferAttribute(instanceHeights, 1));
    geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 3));
    
    // Add the instanced mesh to the scene
    scene.add(instancedMesh);
    
    // Add the mesh to the terrain entity
    const terrainEntity = document.getElementById('terrain');
    if (terrainEntity) {
        terrainEntity.setObject3D('mesh', instancedMesh);
    }
    
    console.log(`Terrain generated with ${hexagons.length} hexagons`);
}

// Note: Export declarations already handled at the end of the file