// Enhanced Terrain Generator with more varied elevation
class EnhancedTerrainGenerator extends TerrainGenerator {
    constructor(options = {}) {
        super(options);
        
        // Additional parameters for terrain variety
        this.octaves = options.octaves || 6; // More octaves for finer detail
        this.ridgeOctaves = options.ridgeOctaves || 4;
        this.warpStrength = options.warpStrength || 4.0; // Stronger warping for more varied terrain
        this.heightScale = options.heightScale || 12.0; // Increased height scale for more dramatic terrain
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
        
        // Initialize noise with the seed
        this.seed = options.seed || Math.floor(Math.random() * 65536);
        this.noise = ImprovedNoise;
        this.noise.seed(this.seed);
        
        // Define regions with different terrain features
        this.setupTerrainRegions();
        
        console.log(`Enhanced Terrain Generator initialized with seed: ${this.seed}`);
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
    
    // Override the generateChunk method - maintain the hexagon layout but eliminate slope checks
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
        
        // First pass: Calculate heights
        for (let q = baseQ; q < baseQ + chunkSize; q++) {
            for (let r = baseR; r < baseR + chunkSize; r++) {
                // Convert hex coordinates to Cartesian
                const {x, z} = this.axialToPixel(q, r);
                
                // Generate height using our enhanced terrain functions
                const height = this.generateTerrainHeight(x, z);
                
                // Store height and calculate biome
                let biomeType, colorInfo;
                if (this.useBiomeColors) {
                    // Determine biome type based on location and height
                    biomeType = this.getBiomeType(x, z, height);
                    
                    // Get color based on biome
                    colorInfo = this.getColor(x, z, height, biomeType);
                } else {
                    // Use default height-based coloring
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
                
                // Add this hexagon to our collection with no slope constraints
                validHexagons.push({
                    position: [x, 0, z], // Base position (y=0)
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
        const detail = this.noise.perlin2(x * detailScale, z * detailScale) * this.heightScale * 0.1;
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
                const mountainNoise = this.noise.ridgedMulti(
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
        const biomeValue = this.noise.perlin2(x * biomeScale, z * biomeScale);
        
        // Get moisture from second noise layer (independent of biome value)
        const moistureScale = 0.005;
        const moisture = (this.noise.perlin2(x * moistureScale + 500, z * moistureScale + 500) + 1) / 2;
        
        // Calculate temperature (decreases with height)
        const baseTemp = (biomeValue + 1) / 2; // 0 to 1
        const tempHeight = normalizedHeight > 0.7 ? 0.7 : normalizedHeight;
        const temperature = baseTemp * (1 - tempHeight * 0.5); // Temperature decreases with height
        
        // Define biome types (from urizex.js)
        const BIOME = {
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
        
        // Very high areas are snow
        if (normalizedHeight > 0.85) {
            return BIOME.SNOW;
        }
        
        // High areas are mountains
        if (normalizedHeight > 0.7) {
            return BIOME.MOUNTAINS;
        }
        
        // Very low areas are dark lowlands
        if (normalizedHeight < 0.15) {
            return BIOME.DARK_LOWLANDS;
        }
        
        // Low-medium areas with low moisture are ashen flats
        if (normalizedHeight < 0.3 && moisture < 0.4) {
            return BIOME.ASHEN_FLATS;
        }
        
        // Hot and dry areas are desert
        if (temperature > 0.65 && moisture < 0.3) {
            return BIOME.DESERT;
        }
        
        // Hot areas with medium moisture are red rock
        if (temperature > 0.6 && moisture >= 0.3 && moisture < 0.5) {
            return BIOME.RED_ROCK;
        }
        
        // Add some alien vegetation in medium moisture areas
        if (moisture >= 0.4 && moisture < 0.6 && biomeValue > 0.3) {
            return BIOME.TEAL_MOSS;
        }
        
        // Add some void stone in specific areas
        if (moisture < 0.4 && biomeValue < -0.4 && normalizedHeight > 0.5) {
            return BIOME.VOID_STONE;
        }
        
        // Add neon vegetation in high moisture areas
        if (moisture > 0.7 && temperature > 0.5) {
            return BIOME.NEON_VEGETATION;
        }
        
        // High moisture areas are deep forest
        if (moisture > 0.6) {
            return BIOME.DEEP_FOREST;
        }
        
        // Default to emerald plains
        return BIOME.EMERALD_PLAINS;
    }
    
    // Get color based on biome type with variations
    getColor(x, z, height, biomeType) {
        // Add some local variation for texture
        const variation = this.noise.perlin2(x * this.noiseScale * 5, z * this.noiseScale * 5) * 0.1;
        
        // Define biome types (from urizex.js)
        const BIOME = {
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
        
        // Base colors for each biome (in HSL format)
        let h, s, l;
        
        switch (biomeType) {
            case BIOME.DARK_LOWLANDS:
                // Dark purple-black lowlands
                h = 270 + variation * 20;
                s = 50 + variation * 20;
                l = 15 + variation * 10;
                break;
                
            case BIOME.ASHEN_FLATS:
                // Grey ashen areas
                h = 0 + variation * 30;
                s = 5 + variation * 10;
                l = 40 + variation * 15;
                break;
                
            case BIOME.EMERALD_PLAINS:
                // Green plains
                h = 120 + variation * 20;
                s = 60 + variation * 20;
                l = 40 + variation * 15;
                break;
                
            case BIOME.DEEP_FOREST:
                // Dark green forest
                h = 140 + variation * 20;
                s = 70 + variation * 20;
                l = 25 + variation * 10;
                break;
                
            case BIOME.DESERT:
                // Sandy desert
                h = 40 + variation * 15;
                s = 80 + variation * 15;
                l = 70 + variation * 10;
                break;
                
            case BIOME.RED_ROCK:
                // Red rock formations
                h = 10 + variation * 15;
                s = 70 + variation * 20;
                l = 35 + variation * 15;
                break;
                
            case BIOME.MOUNTAINS:
                // Mountain rock
                h = 30 + variation * 20;
                s = 30 + variation * 20;
                l = 40 + variation * 15;
                break;
                
            case BIOME.SNOW:
                // Snow caps
                h = 210 + variation * 20;
                s = 10 + variation * 10;
                l = 90 - variation * 10;
                break;
                
            case BIOME.TEAL_MOSS:
                // Teal/blue-green moss
                h = 180 + variation * 20;
                s = 70 + variation * 20;
                l = 40 + variation * 15;
                break;
                
            case BIOME.VOID_STONE:
                // Dark stone
                h = 270 + variation * 20;
                s = 40 + variation * 20;
                l = 20 + variation * 10;
                break;
                
            case BIOME.NEON_VEGETATION:
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
