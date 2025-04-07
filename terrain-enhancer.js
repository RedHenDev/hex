// TerrainEnhancer - Extends the TerrainGenerator with advanced terrain features
// This module can be integrated with the existing terrain system

class TerrainEnhancer {
    constructor(options = {}) {
        // Link to main terrain parameters
        this.hexSize = options.hexSize || 1.0;
        this.heightScale = options.heightScale || 8.0;
        this.noiseScale = options.noiseScale || 0.1;
        this.baseHeight = options.baseHeight || 0.2;
        
        // Enhancement-specific parameters
        this.ridgeIntensity = options.ridgeIntensity || 0.5;    // Controls the height of ridges
        this.erosionStrength = options.erosionStrength || 0.0;  // Controls erosion intensity
        this.detailLevel = options.detailLevel || 0.8;          // Controls amount of detail
        this.usePlateaus = options.usePlateaus !== undefined ? options.usePlateaus : false;
        this.useValleys = options.useValleys !== undefined ? options.useValleys : false;
        
        // Biome parameters
        this.biomeScale = options.biomeScale || 0.005;  // Scale of biome transitions
        this.moistureScale = options.moistureScale || 0.008;  // Scale of moisture variation
        
        // Define biome types (from urizen.js)
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
        const mediumNoise = PerlinNoise.perlin2(x * mediumScale, z * mediumScale);
        height += mediumNoise * this.heightScale * 0.3 * this.detailLevel;
        
        // Add small-scale features (roughness)
        const smallScale = this.noiseScale * 4;
        const smallNoise = PerlinNoise.perlin2(x * smallScale, z * smallScale);
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
        const n = PerlinNoise.perlin2(x * ridgeScale, z * ridgeScale);
        
        // Create sharp ridges by inverting absolute value
        // This creates peaks where noise crosses zero
        const ridge = 1.0 - Math.abs(n);
        
        // Square to make ridges more pronounced
        const sharpRidge = Math.pow(ridge, 2);
        
        return sharpRidge * this.heightScale * this.ridgeIntensity;
    }
    
    // Apply plateau features
    applyPlateaus(x, z, currentHeight) {
        const plateauScale = this.noiseScale * 0.7;
        const n = PerlinNoise.perlin2(x * plateauScale, z * plateauScale);
        
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
        const n = PerlinNoise.perlin2(x * valleyScale, z * valleyScale);
        
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
        const h1 = PerlinNoise.perlin2((x + 0.1) * this.noiseScale, z * this.noiseScale);
        const h2 = PerlinNoise.perlin2((x - 0.1) * this.noiseScale, z * this.noiseScale);
        const h3 = PerlinNoise.perlin2(x * this.noiseScale, (z + 0.1) * this.noiseScale);
        const h4 = PerlinNoise.perlin2(x * this.noiseScale, (z - 0.1) * this.noiseScale);
        
        const slopeX = Math.abs(h1 - h2);
        const slopeZ = Math.abs(h3 - h4);
        const slope = Math.max(slopeX, slopeZ);
        
        // Apply erosion only on steeper slopes
        if (slope > 0.15) {
            const erosionNoise = PerlinNoise.perlin2(x * erosionScale, z * erosionScale);
            return -erosionNoise * slope * this.heightScale * this.erosionStrength;
        }
        
        return 0;
    }
    
    // Determine biome type based on location and height
    getBiomeType(x, z, height) {
        // Normalize height for easier comparison
        const normalizedHeight = (height - this.baseHeight) / this.heightScale;
        
        // Get biome value from first noise layer
        const biomeValue = PerlinNoise.perlin2(x * this.biomeScale, z * this.biomeScale);
        
        // Get moisture from second noise layer
        const moisture = (PerlinNoise.perlin2(x * this.moistureScale, z * this.moistureScale) + 1) / 2;
        
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
        const variation = PerlinNoise.perlin2(x * this.noiseScale * 5, z * this.noiseScale * 5) * 0.1;
        
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
