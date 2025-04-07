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

// TerrainEnhancer - Adds advanced terrain features inspired by urizen.js
class TerrainEnhancer {
    constructor(options = {}) {
        // Link to main terrain parameters
        this.perlinNoise = options.perlinNoise || PerlinNoise; // Reference to PerlinNoise object
        this.hexSize = options.hexSize || 1.0;
        this.heightScale = options.heightScale || 8.0;
        this.noiseScale = options.noiseScale || 0.1;
        this.baseHeight = options.baseHeight || 0.2;
        
        // Enhancement-specific parameters
        this.ridgeIntensity = options.ridgeIntensity || 0.5;
        this.erosionStrength = options.erosionStrength || 0.3;
        this.detailLevel = options.detailLevel || 0.8;
        this.usePlateaus = options.usePlateaus !== undefined ? options.usePlateaus : true;
        this.useValleys = options.useValleys !== undefined ? options.useValleys : true;
        
        // Biome parameters
        this.biomeScale = options.biomeScale || 0.005;
        this.moistureScale = options.moistureScale || 0.008;
        
        // Define biome types
        this.BIOME = {
            DARK_LOWLANDS: 0,    // Dark terrain for low areas
            ASHEN_FLATS: 1,      // Grey flatlands
            EMERALD_PLAINS: 2,   // Standard green plains
            DEEP_FOREST: 3,      // Deep, dark green forest
            DESERT: 4,           // Sandy desert areas
            RED_ROCK: 5,         // Red rock formations
            MOUNTAINS: 6,        // Mountain terrain
            SNOW: 7,             // Snow caps
            TEAL_MOSS: 8,        // Teal/blue-green moss
            VOID_STONE: 9,       // Dark stone areas
            NEON_VEGETATION: 10  // Bright neon green vegetation
        };
    }
    
    // Enhance a base height value with additional terrain features
    enhanceHeight(x, z, baseHeight) {
        let height = baseHeight;
        
        // Add medium-scale features (hills)
        const mediumScale = this.noiseScale * 2;
        const mediumNoise = this.perlinNoise.perlin2(x * mediumScale, z * mediumScale);
        height += mediumNoise * this.heightScale * 0.3 * this.detailLevel;
        
        // Add small-scale features (roughness)
        const smallScale = this.noiseScale * 4;
        const smallNoise = this.perlinNoise.perlin2(x * smallScale, z * smallScale);
        height += smallNoise * this.heightScale * 0.1 * this.detailLevel;
        
        // Add ridge features for mountain ranges
        height += this.generateRidges(x, z);
        
        // Add plateaus if enabled
        if (this.usePlateaus) {
            height = this.applyPlateaus(x, z, height);
        }
        
        // Add valleys if enabled
        if (this.useValleys) {
            height = this.applyValleys(x, z, height);
        }
        
        // Apply erosion simulation
        height += this.calculateErosion(x, z);
        
        return height;
    }
    
    // Generate ridge features for mountain ranges
    generateRidges(x, z) {
        const ridgeScale = this.noiseScale * 1.5;
        const n = this.perlinNoise.perlin2(x * ridgeScale, z * ridgeScale);
        
        // Create sharp ridges by inverting absolute value
        const ridge = 1.0 - Math.abs(n);
        
        // Square to make ridges more pronounced
        const sharpRidge = ridge * ridge;
        
        return sharpRidge * this.heightScale * this.ridgeIntensity;
    }
    
    // Apply plateau features
    applyPlateaus(x, z, currentHeight) {
        const plateauScale = this.noiseScale * 0.7;
        const n = this.perlinNoise.perlin2(x * plateauScale, z * plateauScale);
        
        // Only create plateaus in certain areas
        if (n > 0.7) {
            const plateauHeight = this.baseHeight + this.heightScale * 0.6;
            const blend = (n - 0.7) * 3.33; // 0 to 1 transition
            
            // Blend between current height and plateau height
            return currentHeight * (1 - blend) + plateauHeight * blend;
        }
        
        return currentHeight;
    }
    
    // Apply valley/canyon features
    applyValleys(x, z, currentHeight) {
        const valleyScale = this.noiseScale * 0.8;
        const n = this.perlinNoise.perlin2(x * valleyScale, z * valleyScale);
        
        // Create valleys where noise is low
        if (n < 0.3) {
            const valleyDepth = this.baseHeight - this.heightScale * 0.2;
            const blend = (0.3 - n) * 3.33; // 0 to 1 transition
            
            // More dramatic valleys (multiply by a factor)
            return currentHeight * (1 - blend * 0.7) + valleyDepth * blend * 0.7;
        }
        
        return currentHeight;
    }
    
    // Calculate erosion effect - subtracts height on steep slopes
    calculateErosion(x, z) {
        const erosionScale = this.noiseScale * 3;
        
        // Calculate slope by sampling nearby points
        const h1 = this.perlinNoise.perlin2((x + 0.1) * this.noiseScale, z * this.noiseScale);
        const h2 = this.perlinNoise.perlin2((x - 0.1) * this.noiseScale, z * this.noiseScale);
        const h3 = this.perlinNoise.perlin2(x * this.noiseScale, (z + 0.1) * this.noiseScale);
        const h4 = this.perlinNoise.perlin2(x * this.noiseScale, (z - 0.1) * this.noiseScale);
        
        const slopeX = Math.abs(h1 - h2);
        const slopeZ = Math.abs(h3 - h4);
        const slope = Math.max(slopeX, slopeZ);
        
        // Apply erosion only on steeper slopes
        if (slope > 0.15) {
            const erosionNoise = this.perlinNoise.perlin2(x * erosionScale, z * erosionScale);
            return -erosionNoise * slope * this.heightScale * this.erosionStrength;
        }
        
        return 0;
    }
    
    // Determine biome type based on location and height
    getBiomeType(x, z, height) {
        // Normalize height for easier comparison
        const normalizedHeight = (height - this.baseHeight) / this.heightScale;
        
        // Get biome value from first noise layer
        const biomeValue = this.perlinNoise.perlin2(x * this.biomeScale, z * this.biomeScale);
        
        // Get moisture from second noise layer
        const moisture = (this.perlinNoise.perlin2(x * this.moistureScale, z * this.moistureScale) + 1) / 2;
        
        // Calculate temperature (decreases with height)
        const baseTemp = (biomeValue + 1) / 2; // 0 to 1
        const tempHeight = normalizedHeight > 0.7 ? 0.7 : normalizedHeight;
        const temperature = baseTemp * (1 - tempHeight * 0.5); // Temperature decreases with height
        
        // Very high areas are snow
        if (normalizedHeight > 0.9) {
            return this.BIOME.SNOW;
        }
        
        // High areas are mountains
        if (normalizedHeight > 0.7) {
            return this.BIOME.MOUNTAINS;
        }
        
        // Very low areas are dark lowlands
        if (normalizedHeight < 0.1) {
            return this.BIOME.DARK_LOWLANDS;
        }
        
        // Low-medium areas with low moisture are ashen flats
        if (normalizedHeight < 0.3 && moisture < 0.4) {
            return this.BIOME.ASHEN_FLATS;
        }
        
        // Hot and dry areas are desert
        if (temperature > 0.7 && moisture < 0.3) {
            return this.BIOME.DESERT;
        }
        
        // Hot areas with medium moisture are red rock
        if (temperature > 0.6 && moisture >= 0.3 && moisture < 0.5) {
            return this.BIOME.RED_ROCK;
        }
        
        // Add some alien vegetation in medium moisture areas
        if (moisture >= 0.4 && moisture < 0.6 && biomeValue > 0.3) {
            return this.BIOME.TEAL_MOSS;
        }
        
        // Add some void stone in specific areas
        if (moisture < 0.4 && biomeValue < -0.4 && normalizedHeight > 0.5) {
            return this.BIOME.VOID_STONE;
        }
        
        // Add neon vegetation in high moisture areas
        if (moisture > 0.7 && temperature > 0.5) {
            return this.BIOME.NEON_VEGETATION;
        }
        
        // High moisture areas are deep forest
        if (moisture > 0.6) {
            return this.BIOME.DEEP_FOREST;
        }
        
        // Default to emerald plains
        return this.BIOME.EMERALD_PLAINS;
    }
    
    // Get color based on biome type with variations
    getColor(x, z, height, biomeType) {
        // Add some local variation for texture
        const variation = this.perlinNoise.perlin2(x * this.noiseScale * 5, z * this.noiseScale * 5) * 0.1;
        
        // Base colors for each biome (in HSL format)
        let h, s, l;
        
        switch (biomeType) {
            case this.BIOME.DARK_LOWLANDS:
                // Dark purple-black lowlands
                h = 270 + variation * 20;
                s = 50 + variation * 20;
                l = 15 + variation * 10;
                break;
                
            case this.BIOME.ASHEN_FLATS:
                // Grey ashen areas
                h = 0 + variation * 30;
                s = 5 + variation * 10;
                l = 40 + variation * 15;
                break;
                
            case this.BIOME.EMERALD_PLAINS:
                // Green plains
                h = 120 + variation * 20;
                s = 60 + variation * 20;
                l = 40 + variation * 15;
                break;
                
            case this.BIOME.DEEP_FOREST:
                // Dark green forest
                h = 140 + variation * 20;
                s = 70 + variation * 20;
                l = 25 + variation * 10;
                break;
                
            case this.BIOME.DESERT:
                // Sandy desert
                h = 40 + variation * 15;
                s = 80 + variation * 15;
                l = 70 + variation * 10;
                break;
                
            case this.BIOME.RED_ROCK:
                // Red rock formations
                h = 10 + variation * 15;
                s = 70 + variation * 20;
                l = 35 + variation * 15;
                break;
                
            case this.BIOME.MOUNTAINS:
                // Mountain rock
                h = 30 + variation * 20;
                s = 30 + variation * 20;
                l = 40 + variation * 15;
                break;
                
            case this.BIOME.SNOW:
                // Snow caps
                h = 210 + variation * 20;
                s = 10 + variation * 10;
                l = 90 - variation * 10;
                break;
                
            case this.BIOME.TEAL_MOSS:
                // Teal/blue-green moss
                h = 180 + variation * 20;
                s = 70 + variation * 20;
                l = 40 + variation * 15;
                break;
                
            case this.BIOME.VOID_STONE:
                // Dark stone
                h = 270 + variation * 20;
                s = 40 + variation * 20;
                l = 20 + variation * 10;
                break;
                
            case this.BIOME.NEON_VEGETATION:
                // Bright neon green
                h = 120 + variation * 20;
                s = 90 + variation * 10;
                l = 50 + variation * 20;
                break;
                
            default:
                // Fallback to height-based coloring
                const normalizedHeight = (height - this.baseHeight) / this.heightScale;
                h = Math.max(30, Math.min(120, 120 - 90 * normalizedHeight));
                s = 60 + 20 * normalizedHeight;
                l = 60 - 30 * normalizedHeight;
        }
        
        return { h, s, l };
    }
}

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
        
        // Enhanced terrain options
        this.useEnhancedTerrain = options.useEnhancedTerrain !== undefined ? 
            options.useEnhancedTerrain : false;
        this.useBiomeColors = options.useBiomeColors !== undefined ? 
            options.useBiomeColors : false;
        
        // Initialize noise with the seed
        PerlinNoise.seed(this.seed);
        
        // Create terrain enhancer if needed
        if (this.useEnhancedTerrain || this.useBiomeColors) {
            this.enhancer = new TerrainEnhancer({
                perlinNoise: PerlinNoise,
                hexSize: this.hexSize,
                heightScale: this.heightScale,
                noiseScale: this.noiseScale,
                baseHeight: this.baseHeight,
                ridgeIntensity: options.ridgeIntensity || 0.5,
                erosionStrength: options.erosionStrength || 0.3,
                detailLevel: options.detailLevel || 0.8,
                usePlateaus: options.usePlateaus !== undefined ? options.usePlateaus : true,
                useValleys: options.useValleys !== undefined ? options.useValleys : true,
                biomeScale: options.biomeScale || 0.005,
                moistureScale: options.moistureScale || 0.008
            });
        }
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
                let height;
                if (this.useEnhancedTerrain && this.enhancer) {
                    // Get base height first
                    const noiseValue = PerlinNoise.perlin2(x * this.noiseScale, z * this.noiseScale);
                    const baseHeight = this.baseHeight + ((noiseValue + 1) / 2) * this.heightScale;
                    
                    // Enhance with advanced features
                    height = this.enhancer.enhanceHeight(x, z, baseHeight);
                } else {
                    // Original height calculation
                    const noiseValue = PerlinNoise.perlin2(x * this.noiseScale, z * this.noiseScale);
                    // Convert to range 0 to 1
                    const normalizedNoiseValue = (noiseValue + 1) / 2;
                    // Calculate height
                    height = this.baseHeight + normalizedNoiseValue * this.heightScale;
                }
                
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
                
                // Calculate color based on height and/or biome
                let hue, sat, light;
                
                if (this.useBiomeColors && this.enhancer) {
                    // Get biome type
                    const biomeType = this.enhancer.getBiomeType(x, z, currentHeight);
                    
                    // Get color info based on biome
                    const colorInfo = this.enhancer.getColor(x, z, currentHeight, biomeType);
                    hue = colorInfo.h;
                    sat = colorInfo.s;
                    light = colorInfo.l;
                } else {
                    // Original height-based coloring
                    const normalizedHeight = (currentHeight - this.baseHeight) / this.heightScale;
                    
                    // Green for low areas, brown for mountains
                    hue = Math.max(30, Math.min(120, 120 - 90 * normalizedHeight));
                    sat = 60 + 20 * normalizedHeight;
                    light = 60 - 30 * normalizedHeight;
                }
                
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
    
    // Create a terrain generator with enhanced settings
    const generator = new TerrainGenerator({
        hexSize: hexSize,
        heightScale: 8.0,
        noiseScale: 0.1,
        baseHeight: 0.2,
        maxSlopeDifference: 20.0,
        useEnhancedTerrain: true,
        useBiomeColors: true,
        ridgeIntensity: 0.5,
        erosionStrength: 0.3,
        detailLevel: 0.8
    });
    
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
    
    // console.log(`Terrain generated with ${hexagons.length} hexagons`);
}

/**
 * Get terrain height at a specific world position
 * @param {number} x - X coordinate in world space
 * @param {number} z - Z coordinate in world space
 * @param {Object} options - Optional parameters to override defaults
 * @returns {number} The height of terrain at the specified position
 */
function generateTerrainHeight(x, z, options = {}) {
    // Create a terrain generator if not already created
    if (!window._terrainHeightGenerator) {
        console.log("Creating terrain height generator");
        
        // Check if EnhancedTerrainGenerator is available
        if (typeof EnhancedTerrainGenerator === 'function') {
            window._terrainHeightGenerator = new EnhancedTerrainGenerator({
                hexSize: options.hexSize || 1.0,
                heightScale: options.heightScale || 8.0,
                noiseScale: options.noiseScale || 0.1,
                baseHeight: options.baseHeight || 0.2,
                useEnhancedTerrain: true,
                useBiomeColors: true,
                ridgeIntensity: options.ridgeIntensity || 0.7,
                erosionStrength: options.erosionStrength || 0.5,
                detailLevel: options.detailLevel || 0.9,
                warpStrength: options.warpStrength || 3.0,
                useWarp: options.useWarp !== undefined ? options.useWarp : true,
                useRidges: options.useRidges !== undefined ? options.useRidges : true,
                directionalRidges: options.directionalRidges !== undefined ? options.directionalRidges : true,
                octaves: options.octaves || 5,
                ridgeOctaves: options.ridgeOctaves || 3,
                seed: options.seed || Math.floor(Math.random() * 65536)
            });
            console.log("Using EnhancedTerrainGenerator for height calculations");
        } else {
            // Fallback to standard generator if enhanced is not available
            window._terrainHeightGenerator = new TerrainGenerator({
                hexSize: options.hexSize || 1.0,
                heightScale: options.heightScale || 8.0,
                noiseScale: options.noiseScale || 0.1,
                baseHeight: options.baseHeight || 0.2,
                useEnhancedTerrain: true,
                ridgeIntensity: options.ridgeIntensity || 0.6,
                erosionStrength: options.erosionStrength || 0.4,
                detailLevel: options.detailLevel || 0.9,
                seed: options.seed || Math.floor(Math.random() * 65536)
            });
            console.log("Falling back to TerrainGenerator for height calculations");
        }
    }
    
    try {
        // If we have the enhanced generator with its own height function, use that
        if (window._terrainHeightGenerator instanceof EnhancedTerrainGenerator && 
            typeof window._terrainHeightGenerator.generateTerrainHeight === 'function') {
            
            return window._terrainHeightGenerator.generateTerrainHeight(x, z);
        }
        
        // Otherwise use the standard approach
        // Get perlin noise at this location
        const noiseValue = PerlinNoise.perlin2(
            x * window._terrainHeightGenerator.noiseScale, 
            z * window._terrainHeightGenerator.noiseScale
        );
        
        let height;
        if (window._terrainHeightGenerator.useEnhancedTerrain && 
            window._terrainHeightGenerator.enhancer) {
            // Get base height first
            const baseHeight = window._terrainHeightGenerator.baseHeight + 
                ((noiseValue + 1) / 2) * window._terrainHeightGenerator.heightScale;
            
            // Enhance with advanced features
            height = window._terrainHeightGenerator.enhancer.enhanceHeight(x, z, baseHeight);
        } else {
            // Original height calculation
            const normalizedNoiseValue = (noiseValue + 1) / 2;
            height = window._terrainHeightGenerator.baseHeight + 
                normalizedNoiseValue * window._terrainHeightGenerator.heightScale;
        }
        
        return height;
    } catch (error) {
        console.error("Error generating terrain height:", error);
        // Return a default height if there's an error
        return 0;
    }
}