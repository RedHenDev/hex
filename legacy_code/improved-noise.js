// Enhanced PerlinNoise implementation with better permutation and fractal capabilities
const ImprovedNoise = {
    // Permutation table - will be expanded to 1024 elements (4x256)
    p: new Array(1024),
    
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
        
        // Initialize with values 0-255
        for(let i = 0; i < 256; i++) {
            perm[i] = i;
        }
        
        // Fisher-Yates shuffle with seed influence for better randomization
        for(let i = 255; i > 0; i--) {
            // Use a better mixing function for the seed
            const seedMix = (seed ^ (seed >> 5) ^ (seed << 7) ^ (i * 13)) & 0xFFFFFFFF;
            const j = seedMix % (i + 1);
            
            // Swap
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        
        // Extend the permutation table to 1024 elements for less repetition
        for(let i = 0; i < 256; i++) {
            this.p[i] = this.p[i + 256] = this.p[i + 512] = this.p[i + 768] = perm[i];
        }
    },
    
    // Improved fade function (Ken Perlin's improved curve)
    fade: function(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    },
    
    // Linear interpolation
    lerp: function(t, a, b) {
        return a + t * (b - a);
    },
    
    // Improved gradient function with more directions
    grad: function(hash, x, y, z) {
        // Use lower 4 bits of hash
        const h = hash & 15;
        
        // Convert lower 3 bits to gradient directions
        // This creates 12 gradient directions instead of 8
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        
        // Add sign based on bit patterns
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    },
    
    // 2D Perlin noise - improved sampling
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
        const AA = this.p[A];
        const AB = this.p[A + 1];
        const BA = this.p[B];
        const BB = this.p[B + 1];
        
        // And add blended results from 4 corners of square
        return this.lerp(v, 
            this.lerp(u, 
                this.grad(this.p[AA], x, y, 0),
                this.grad(this.p[BA], x-1, y, 0)
            ),
            this.lerp(u,
                this.grad(this.p[AB], x, y-1, 0),
                this.grad(this.p[BB], x-1, y-1, 0)
            )
        );
    },
    
    // New: Fractal Brownian Motion for multi-octave noise
    // This creates much more natural looking terrain
    fbm: function(x, y, octaves =
    4, lacunarity = 2.0, gain = 0.5) {
        let total = 0;
        let frequency = 1.0;
        let amplitude = 1.0;
        let maxValue = 0;  // Used for normalizing
        
        // Sum multiple noise functions with different frequencies
        for(let i = 0; i < octaves; i++) {
            total += this.perlin2(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }
        
        // Normalize to range -1 to 1
        return total / maxValue;
    },
    
    // New: Domain warping for more organic, less grid-like patterns
    warpedNoise: function(x, y, warpStrength = 1.0) {
        // Sample twice with offset to create warp vectors
        const warpX = this.perlin2(x * 0.5, y * 0.5) * warpStrength;
        const warpY = this.perlin2(x * 0.5 + 100, y * 0.5 + 100) * warpStrength;
        
        // Apply the warp to the coordinates before final noise sampling
        return this.perlin2(x + warpX, y + warpY);
    },
    
    // New: Ridged multi-fractal noise - creates more realistic ridges
    ridgedMulti: function(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5, offset = 1.0) {
        let total = 0;
        let frequency = 1.0;
        let amplitude = 1.0;
        let maxValue = 0;
        
        for(let i = 0; i < octaves; i++) {
            // Get absolute value of noise to create ridges
            let signal = this.perlin2(x * frequency, y * frequency);
            signal = offset - Math.abs(signal);
            // Square signal to increase sharpness of ridges
            signal *= signal;
            
            total += signal * amplitude;
            maxValue += amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }
        
        return total / maxValue;
    },
    
    // New: 2D directional noise for creating ridges/features with directionality
    directionalNoise: function(x, y, angle = 0, scale = 1.0) {
        // Rotate coordinates to achieve directional effect
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const nx = x * cos - y * sin;
        const ny = x * sin + y * cos;
        
        // Sample using rotated coordinates at the given scale
        return this.perlin2(nx * scale, ny * scale);
    }
};

// Enhanced TerrainGenerator class that uses the improved noise functions
class EnhancedTerrainGenerator extends TerrainGenerator {
    constructor(options = {}) {
        super(options);
        
        // Override the noise object with our improved version
        this.noise = ImprovedNoise;
        this.noise.seed(this.seed);
        
        // Additional parameters
        this.octaves = options.octaves || 5;
        this.ridgeOctaves = options.ridgeOctaves || 3;
        this.warpStrength = options.warpStrength || 3.0;
        this.useWarp = options.useWarp !== undefined ? options.useWarp : true;
        this.useRidges = options.useRidges !== undefined ? options.useRidges : true;
        this.directionalRidges = options.directionalRidges !== undefined ? options.directionalRidges : true;
        
        // Define regions with different ridge directions for more variety
        this.regions = [];
        const regionCount = 5;
        for(let i = 0; i < regionCount; i++) {
            this.regions.push({
                // Random center point
                centerX: (Math.random() * 2 - 1) * 1000,
                centerZ: (Math.random() * 2 - 1) * 1000,
                // Random radius between 300 and 800
                radius: 300 + Math.random() * 500,
                // Random angle for ridge direction
                angle: Math.random() * Math.PI,
                // Random ridge intensity
                intensity: 0.5 + Math.random() * 0.5
            });
        }
    }
    
    // Override the generateChunk method
    generateChunk(chunkX, chunkZ, chunkSize) {
        // Create a map to store the heights for each coordinate
        const heightMap = new Map();
        
        // Convert chunk world coordinates to axial coordinates
        const hexWidth = this.hexSize * Math.sqrt(3);
        const hexHeight = this.hexSize * 1.5;
        
        // Calculate the base axial coordinates for this chunk
        const baseQ = Math.floor(chunkX / hexWidth);
        const baseR = Math.floor(chunkZ / hexHeight);
        
        // Collection to track valid hexagons
        const validHexagons = [];
        
        // First pass: Calculate heights for all positions in this chunk and surrounding area
        for (let q = baseQ - 1; q <= baseQ + chunkSize + 1; q++) {
            for (let r = baseR - 1; r <= baseR + chunkSize + 1; r++) {
                // Convert hex coordinates to Cartesian
                const {x, z} = this.axialToPixel(q, r);
                
                // Use our enhanced noise functions to generate terrain
                let height = this.generateTerrainHeight(x, z);
                
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
    
    // New method to generate terrain height using our improved algorithms
    generateTerrainHeight(x, z) {
        // Base continents using FBM noise (large scale)
        const continentScale = this.noiseScale * 0.3;
        let baseHeight;
        
        if (this.useWarp) {
            // Apply domain warping for more natural, flowing landforms
            const warpX = this.noise.perlin2(x * continentScale * 0.5, z * continentScale * 0.5) * this.warpStrength;
            const warpZ = this.noise.perlin2(x * continentScale * 0.5 + 100, z * continentScale * 0.5 + 100) * this.warpStrength;
            
            baseHeight = this.noise.fbm(
                (x + warpX) * continentScale, 
                (z + warpZ) * continentScale, 
                this.octaves
            );
        } else {
            // Standard FBM without warping
            baseHeight = this.noise.fbm(x * continentScale, z * continentScale, this.octaves);
        }
        
        // Scale to our height range
        baseHeight = this.baseHeight + ((baseHeight + 1) / 2) * this.heightScale;
        
        // Add ridge features if enabled
        if (this.useRidges) {
            if (this.directionalRidges) {
                // Apply directional ridges based on regions
                let ridgeContribution = 0;
                let totalWeight = 0;
                
                // Find the influence of each region on this point
                for (const region of this.regions) {
                    // Distance from point to region center
                    const dx = x - region.centerX;
                    const dz = z - region.centerZ;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    // Calculate weight based on distance (inverse square falloff)
                    const weight = Math.max(0, 1 - Math.min(1, (distance / region.radius) * (distance / region.radius)));
                    
                    if (weight > 0) {
                        // Use directional ridged multi-fractal noise
                        const ridge = this.noise.ridgedMulti(
                            x * this.noiseScale * 1.5, 
                            z * this.noiseScale * 1.5, 
                            this.ridgeOctaves
                        );
                        
                        // Add weighted contribution
                        ridgeContribution += ridge * weight * region.intensity;
                        totalWeight += weight;
                    }
                }
                
                // If we have any contribution, add it to the base height
                if (totalWeight > 0) {
                    baseHeight += (ridgeContribution / totalWeight) * this.heightScale * 0.5;
                }
            } else {
                // Non-directional ridges
                const ridge = this.noise.ridgedMulti(
                    x * this.noiseScale * 1.5, 
                    z * this.noiseScale * 1.5, 
                    this.ridgeOctaves
                );
                
                baseHeight += ridge * this.heightScale * 0.5;
            }
        }
        
        // Add small-scale detail noise
        const detailScale = this.noiseScale * 5;
        const detail = this.noise.perlin2(x * detailScale, z * detailScale) * this.heightScale * 0.1;
        baseHeight += detail;
        
        return baseHeight;
    }
}
