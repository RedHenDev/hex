// terrain-system.js - Consolidated terrain generation system
// This file replaces improved-noise.js, urizex.js, enhanced-terrain.js, and terrain-enhancer.js

// ========== IMPROVED NOISE FUNCTIONS ==========
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
    
    // Fractal Brownian Motion for multi-octave noise
    fbm: function(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
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
    
    // Domain warping for more organic, less grid-like patterns
    warpedNoise: function(x, y, warpStrength = 1.0) {
        // Sample twice with offset to create warp vectors
        const warpX = this.perlin2(x * 0.5, y * 0.5) * warpStrength;
        const warpY = this.perlin2(x * 0.5 + 100, y * 0.5 + 100) * warpStrength;
        
        // Apply the warp to the coordinates before final noise sampling
        return this.perlin2(x + warpX, y + warpY);
    },
    
    // Ridged multi-fractal noise - creates more realistic ridges
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
    
    // 2D directional noise for creating ridges/features with directionality
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

// ========== BASE TERRAIN GENERATOR ==========
class TerrainGenerator {
    constructor(options = {}) {
        // Parameters for the terrain
        this.hexSize = options.hexSize || 1.0; // Size of each hexagon
        this.heightScale = options.heightScale || 12.0; // Maximum height
        this.noiseScale = options.noiseScale || 0.1; // Scale factor for noise
        this.baseHeight = options.baseHeight || 0.2; // Minimum height
        this.seed = options.seed || Math.floor(Math.random() * 65536);
        
        // Enhanced terrain options
        this.useEnhancedTerrain = options.useEnhancedTerrain !== undefined ? 
            options.useEnhancedTerrain : true;
        this.useBiomeColors = options.useBiomeColors !== undefined ? 
            options.useBiomeColors : true;
        
        // Initialize noise with the seed
        ImprovedNoise.seed(this.seed);
        
        console.log(`TerrainGenerator initialized with seed: ${this.seed}`);
    }
    
    // Helper function to convert axial coordinates (q,r) to pixel (x,z)
    // Using "pointy-top" hex orientation
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
    // Override the generateChunk method
    generateChunk(chunkX, chunkZ, chunkSize) {
        // Convert chunk world coordinates to axial coordinates
        const hexWidth = this.hexSize * Math.sqrt(3);
        const hexHeight = this.hexSize * 1.5;
        
        // Calculate the base axial coordinates for this chunk
        const baseQ = Math.floor(chunkX / hexWidth);
        const baseR = Math.floor(chunkZ / hexHeight);
        
        // Collection to track valid hexagons
        const validHexagons = [];
        
        // First pass: Calculate heights
        for (let q = 0; q < chunkSize; q++) {
            for (let r = 0; r < chunkSize; r++) {
                // Convert axial coordinates to local Cartesian coordinates
                const localPos = this.axialToPixel(q, r);
                
                // These are positions relative to the chunk's origin, not world coordinates
                const worldX = localPos.x;
                const worldZ = localPos.z;
                
                // Generate terrain height using world coordinates for consistent noise sampling
                const absoluteX = chunkX + worldX;
                const absoluteZ = chunkZ + worldZ;
                const height = this.generateTerrainHeight(absoluteX, absoluteZ);
                
                // Determine biome type based on absolute world position
                let biomeType, colorInfo;
                if (this.useBiomeColors) {
                    biomeType = this.getBiomeType(absoluteX, absoluteZ, height);
                    colorInfo = this.getColor(absoluteX, absoluteZ, height, biomeType);
                } else {
                    const normalizedHeight = (height - this.baseHeight) / this.heightScale;
                    colorInfo = {
                        h: Math.max(30, Math.min(120, 120 - 90 * normalizedHeight)),
                        s: 60 + 20 * normalizedHeight,
                        l: 60 - 30 * normalizedHeight
                    };
                }
                
                // Convert HSL to RGB
                const h = colorInfo.h / 360;
                const s = colorInfo.s / 100;
                const l = colorInfo.l / 100;
                
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
                
                // Add this hexagon to our collection with LOCAL positions
                // This is the key change - positions are relative to chunk origin (0,0,0)
                validHexagons.push({
                    position: [worldX, 0, worldZ],
                    height: height,
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

// ========== ENHANCED TERRAIN GENERATOR ==========
class EnhancedTerrainGenerator extends TerrainGenerator {
    constructor(options = {}) {
        super(options);
        
        // Additional parameters for terrain variety
        this.octaves = options.octaves || 6; // More octaves for finer detail
        this.ridgeOctaves = options.ridgeOctaves || 4;
        this.warpStrength = options.warpStrength || 4.0; // Stronger warping for more varied terrain
        this.useWarp = options.useWarp !== undefined ? options.useWarp : true;
        this.useRidges = options.useRidges !== undefined ? options.useRidges : true;
        this.ridgeIntensity = options.ridgeIntensity || 0.8; // Stronger ridges
        this.directionalRidges = options.directionalRidges !== undefined ? options.directionalRidges : true;
        
        // Terrain features
        this.useMountains = options.useMountains !== undefined ? options.useMountains : true;
        this.usePlateaus = options.usePlateaus !== undefined ? options.usePlateaus : true;
        this.useValleys = options.useValleys !== undefined ? options.useValleys : true;
        this.mountainScale = options.mountainScale || 0.03; // Scale for mountain features
        this.plateauThreshold = options.plateauThreshold || 0.65; // Height threshold for plateaus
        this.valleyDepth = options.valleyDepth || 0.3; // Depth of valleys
        
        // Biome parameters
        this.biomeScale = options.biomeScale || 0.005; // Scale of biome transitions
        this.moistureScale = options.moistureScale || 0.008; // Scale of moisture variation
        
        // Define biome types
        this.BIOME = {
            DARK_LOWLANDS: 0,
            ASHEN_FLATS: 1,
            EMERALD_PLAINS: 2,
            DEEP_FOREST: 3,
            DESERT: 4,
            RED_ROCK: 5,
            MOUNTAINS: 6,
            SNOW: 7,
            TEAL_MOSS: 8,
            VOID_STONE: 9,
            NEON_VEGETATION: 10
        };
        
        // Define regions with different terrain features
        this.setupTerrainRegions();
        
        console.log(`EnhancedTerrainGenerator initialized with seed: ${this.seed}`);
    }
    
    // Set up different terrain regions for variety
    setupTerrainRegions() {
        this.regions = [];
        
        // Create several mountain ranges with different orientations
        const mountainRangeCount = 4;
        for (let i = 0; i < mountainRangeCount; i++) {
            this.regions.push({
                type: 'mountains',
                centerX: (Math.random() * 2 - 1) * 1000,
                centerZ: (Math.random() * 2 - 1) * 1000,
                radius: 300 + Math.random() * 500,
                angle: Math.random() * Math.PI, // Direction of the mountain range
                intensity: 0.6 + Math.random() * 0.4
            });
        }
        
        // Create plateau regions
        const plateauCount = 3;
        for (let i = 0; i < plateauCount; i++) {
            this.regions.push({
                type: 'plateau',
                centerX: (Math.random() * 2 - 1) * 1000,
                centerZ: (Math.random() * 2 - 1) * 1000,
                radius: 200 + Math.random() * 400,
                height: 0.5 + Math.random() * 0.5, // Height of the plateau (normalized)
                sharpness: 0.7 + Math.random() * 0.3 // How sharp the plateau edges are
            });
        }
        
        // Create valley regions
        const valleyCount = 3;
        for (let i = 0; i < valleyCount; i++) {
            this.regions.push({
                type: 'valley',
                centerX: (Math.random() * 2 - 1) * 1000,
                centerZ: (Math.random() * 2 - 1) * 1000,
                radius: 250 + Math.random() * 350,
                depth: 0.3 + Math.random() * 0.4, // Depth of the valley (normalized)
                angle: Math.random() * Math.PI, // Direction of the valley
                width: 100 + Math.random() * 200 // Width of the valley
            });
        }
    }
    
    // Override the generateChunk method
    // Override the generateChunk method in EnhancedTerrainGenerator class
    generateChunk(chunkX, chunkZ, chunkSize) {
        // Collection to track valid hexagons
        const validHexagons = [];
        
        // Important: We need to determine the q,r coordinates of the first hexagon in this chunk
        // based on the chunk's world position
        const hexWidth = this.hexSize * Math.sqrt(3);
        const hexHeight = this.hexSize * 1.5;
        
        // Calculate q,r for the first hexagon in this chunk
        // This is a reverse transform from world coordinates to axial coordinates
        // For pointy-top hexagons, the formula is:
        // q = (x * sqrt(3)/3 - z/3) / hexSize
        // r = z * 2/3 / hexSize
        
        // But we need integer coordinates, so we use Math.floor to get the closest grid position
        const firstQ = Math.floor(chunkX * Math.sqrt(3)/3 / this.hexSize);
        const firstR = Math.floor(chunkZ * 2/3 / this.hexSize);
        
        // Now generate hexagons from this starting point
        for (let dq = 0; dq < chunkSize; dq++) {
            for (let dr = 0; dr < chunkSize; dr++) {
                // Calculate actual q,r coordinates
                const q = firstQ + dq;
                const r = firstR + dr;
                
                // Convert axial coordinates to world coordinates
                const position = this.axialToPixel(q, r);
                
                // Generate terrain height using absolute world coordinates
                const absoluteX = position.x;
                const absoluteZ = position.z;
                const height = this.generateTerrainHeight(absoluteX, absoluteZ);
                
                // Calculate position relative to chunk origin
                const localX = position.x - chunkX;
                const localZ = position.z - chunkZ;
                
                // Determine biome and color
                let biomeType, colorInfo;
                if (this.useBiomeColors) {
                    biomeType = this.getBiomeType(absoluteX, absoluteZ, height);
                    colorInfo = this.getColor(absoluteX, absoluteZ, height, biomeType);
                } else {
                    const normalizedHeight = (height - this.baseHeight) / this.heightScale;
                    colorInfo = {
                        h: Math.max(30, Math.min(120, 120 - 90 * normalizedHeight)),
                        s: 60 + 20 * normalizedHeight,
                        l: 60 - 30 * normalizedHeight
                    };
                }
                
                // Convert HSL to RGB (using existing code)
                const h = colorInfo.h / 360;
                const s = colorInfo.s / 100;
                const l = colorInfo.l / 100;
                
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
                
                // Add this hexagon with LOCAL positions relative to chunk
                validHexagons.push({
                    position: [localX, 0, localZ],
                    height: height,
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
    
    // Enhanced terrain height generation
    generateTerrainHeight(x, z) {
        // Base continents using FBM noise (large scale)
        const continentScale = this.noiseScale * 0.3;
        let baseHeight;
        
        if (this.useWarp) {
            // Apply domain warping for more natural, flowing landforms
            const warpX = ImprovedNoise.perlin2(x * continentScale * 0.5, z * continentScale * 0.5) * this.warpStrength;
            const warpZ = ImprovedNoise.perlin2(x * continentScale * 0.5 + 100, z * continentScale * 0.5 + 100) * this.warpStrength;
            
            baseHeight = ImprovedNoise.fbm(
                (x + warpX) * continentScale, 
                (z + warpZ) * continentScale, 
                this.octaves
            );
        } else {
            // Standard FBM without warping
            baseHeight = ImprovedNoise.fbm(x * continentScale, z * continentScale, this.octaves);
        }
        
        // Scale to our height range
        baseHeight = this.baseHeight + ((baseHeight + 1) / 2) * this.heightScale;
        
        // Apply mountain ranges
        if (this.useMountains) {
            baseHeight = this.applyMountainRanges(x, z, baseHeight);
        }
        
        // Apply plateaus
        if (this.usePlateaus) {
            baseHeight = this.applyPlateaus(x, z, baseHeight);
        }
        
        // Apply valleys
        if (this.useValleys) {
            baseHeight = this.applyValleys(x, z, baseHeight);
        }
        
        // Add small-scale detail noise
        const detailScale = this.noiseScale * 5;
        const detail = ImprovedNoise.perlin2(x * detailScale, z * detailScale) * this.heightScale * 0.1;
        baseHeight += detail;
        
        return baseHeight;
    }
    
    // Apply mountain ranges based on regions
    applyMountainRanges(x, z, currentHeight) {
        let height = currentHeight;
        
        // Find mountain range regions
        for (const region of this.regions) {
            if (region.type !== 'mountains') continue;
            
            // Calculate distance from point to region center
            const dx = x - region.centerX;
            const dz = z - region.centerZ;
            
            // For mountain ranges, we want to consider distance along the perpendicular axis
            // to create elongated ranges
            const angle = region.angle;
            const cosAngle = Math.cos(angle);
            const sinAngle = Math.sin(angle);
            
            // Rotate coordinates to align with mountain range direction
            const rotatedX = dx * cosAngle - dz * sinAngle;
            const rotatedZ = dx * sinAngle + dz * cosAngle;
            
            // Use elliptical distance for elongated mountain ranges
            const distanceAlongRange = Math.abs(rotatedX / (region.radius * 2)); // Along the range
            const distanceAcrossRange = Math.abs(rotatedZ / (region.radius * 0.5)); // Across the range
            const ellipticalDistance = Math.sqrt(distanceAlongRange * distanceAlongRange + 
                                               distanceAcrossRange * distanceAcrossRange);
            
            // Calculate influence weight - stronger near the center of the range
            const weight = Math.max(0, 1 - ellipticalDistance);
            
            if (weight > 0) {
                // Generate ridge-like noise for mountains
                const mountainNoise = ImprovedNoise.ridgedMulti(
                    x * this.mountainScale, 
                    z * this.mountainScale, 
                    this.ridgeOctaves
                );
                
                // Apply mountain elevation
                const mountainHeight = mountainNoise * this.heightScale * region.intensity;
                height += mountainHeight * weight;
            }
        }
        
        return height;
    }
    
    // Apply plateaus based on regions
    applyPlateaus(x, z, currentHeight) {
        let height = currentHeight;
        
        // Find plateau regions
        for (const region of this.regions) {
            if (region.type !== 'plateau') continue;
            
            // Calculate distance from point to region center
            const dx = x - region.centerX;
            const dz = z - region.centerZ;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            // Calculate falloff from plateau edge
            const distanceFromEdge = region.radius - distance;
            const edgeFalloff = Math.min(1, Math.max(0, distanceFromEdge / (region.radius * 0.2)));
            
            // Make transitions sharper with power function
            const plateauFactor = Math.pow(edgeFalloff, region.sharpness * 3);
            
            if (plateauFactor > 0) {
                // Set plateau height
                const plateauHeight = this.baseHeight + this.heightScale * region.height;
                
                // Blend between current height and plateau height
                // Only raise terrain, don't lower it for plateaus
                if (plateauHeight > height) {
                    height = height * (1 - plateauFactor) + plateauHeight * plateauFactor;
                }
            }
        }
        
        return height;
    }
    
    // Apply valleys based on regions
    applyValleys(x, z, currentHeight) {
        let height = currentHeight;
        
        // Find valley regions
        for (const region of this.regions) {
            if (region.type !== 'valley') continue;
            
            // Calculate distance from point to region center
            const dx = x - region.centerX;
            const dz = z - region.centerZ;
            
            // For valleys, we want to consider distance along the perpendicular axis
            // to create elongated valleys
            const angle = region.angle;
            const cosAngle = Math.cos(angle);
            const sinAngle = Math.sin(angle);
            
            // Rotate coordinates to align with valley direction
            const rotatedX = dx * cosAngle - dz * sinAngle;
            const rotatedZ = dx * sinAngle + dz * cosAngle;
            
            // Distance across the valley (perpendicular to valley direction)
            const distanceAcross = Math.abs(rotatedZ);
            
            // Check if we're within the valley width and length
            if (distanceAcross < region.width && Math.abs(rotatedX) < region.radius) {
                // Calculate how deep the valley is at this point
                const valleyDepth = this.heightScale * region.depth;
                
                // Valley profile - deeper in center, gradual slopes on sides
                const valleyFactor = Math.pow(1 - (distanceAcross / region.width), 2);
                
                // Apply valley depth
                height -= valleyDepth * valleyFactor;
            }
        }
        
        return height;
    }
    
    // Determine biome type based on location and height
    getBiomeType(x, z, height) {
        // Normalized height for easier comparison
        const normalizedHeight = (height - this.baseHeight) / this.heightScale;
        
        // Get biome value from first noise layer (scale reduced for larger biomes)
        const biomeScale = 0.003; // Smaller scale for more gradual biome transitions
        const biomeValue = ImprovedNoise.perlin2(x * biomeScale, z * biomeScale);
        
        // Get moisture from second noise layer (independent of biome value)
        const moistureScale = 0.005;
        const moisture = (ImprovedNoise.perlin2(x * moistureScale + 500, z * moistureScale + 500) + 1) / 2;
        
        // Calculate temperature (decreases with height)
        const baseTemp = (biomeValue + 1) / 2; // 0 to 1
        const tempHeight = normalizedHeight > 0.7 ? 0.7 : normalizedHeight;
        const temperature = baseTemp * (1 - tempHeight * 0.5); // Temperature decreases with height
        
        // Very high areas are snow
        if (normalizedHeight > 0.85) {
            return this.BIOME.SNOW;
        }
        
        // High areas are mountains
        if (normalizedHeight > 0.7) {
            return this.BIOME.MOUNTAINS;
        }
        
        // Very low areas are dark lowlands
        if (normalizedHeight < 0.15) {
            return this.BIOME.DARK_LOWLANDS;
        }
        
        // Low-medium areas with low moisture are ashen flats
        if (normalizedHeight < 0.3 && moisture < 0.4) {
            return this.BIOME.ASHEN_FLATS;
        }
        
        // Hot and dry areas are desert
        if (temperature > 0.65 && moisture < 0.3) {
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
        const variation = ImprovedNoise.perlin2(x * this.noiseScale * 5, z * this.noiseScale * 5) * 0.1;
        
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

// ========== TERRAIN UTILITIES ==========
// Namespace for terrain utilities
window.TerrainUtils = {
    // Height generator instance
    _generator: null,
    
    // Function to get terrain height at any world position
    getTerrainHeight: function(x, z) {
        // If we don't have a terrain generator, create one
        if (!this._generator) {
            console.log("Creating terrain height generator");
            
            // Create a temporary generator with the same seed as the main terrain system
            const scene = document.querySelector('a-scene');
            let seed = 0;
            
            if (scene && scene.components['terrain-manager']) {
                seed = scene.components['terrain-manager'].data.seed;
            } else {
                seed = Math.floor(Math.random() * 1000000);
            }
            
            // Create a simplified terrain generator for height sampling
            this._generator = new EnhancedTerrainGenerator({
                seed: seed,
                heightScale: 12.0,
                noiseScale: 0.1,
                baseHeight: 0.2
            });
        }
        
        // Use the generator to get height at this position
        return this._generator.generateTerrainHeight(x, z);
    }
};

// Create a global function that's used in the terrain-manager component
window.generateTerrainHeight = function(x, z) {
    return window.TerrainUtils.getTerrainHeight(x, z);
};
