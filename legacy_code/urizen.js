// Procedural alien terrain generation with enhanced green variations and pulse effects
let ws = document.currentScript?.getAttribute('data-seed') || '1';
const worldSeed = getSeed(ws);

function getSeed(seedWord) {
    if (!seedWord) return 1;
    // Basic djb2 hash
    let hash = 5381;
    for (let i = 0; i < seedWord.length; i++) {
        hash = ((hash << 5) + hash) + seedWord.charCodeAt(i);
    }
    if (hash == NaN || hash === 5381) return 1;
    return hash >>> 0; 
}

// Perlin noise implementation.
const noise = {
    p: new Uint8Array(512),
    permutation: [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180],
    init: function() {
        for(let i=0; i < 256; i++) {
            this.p[i] = this.p[i + 256] = this.permutation[i] * worldSeed;
        }
        console.log('World seed is ' + worldSeed);
    },
    fade: function(t) { return t * t * t * (t * (t * 6 - 15) + 10); },
    lerp: function(t, a, b) { return a + t * (b - a); },
    grad: function(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    },
    noise: function(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const A = this.p[X] + Y;
        const AA = this.p[A] + Z;
        const AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y;
        const BA = this.p[B] + Z;
        const BB = this.p[B + 1] + Z;

        return this.lerp(w,
            this.lerp(v,
                this.lerp(u,
                    this.grad(this.p[AA], x, y, z),
                    this.grad(this.p[BA], x-1, y, z)
                ),
                this.lerp(u,
                    this.grad(this.p[AB], x, y-1, z),
                    this.grad(this.p[BB], x-1, y-1, z)
                )
            ),
            this.lerp(v,
                this.lerp(u,
                    this.grad(this.p[AA+1], x, y, z-1),
                    this.grad(this.p[BA+1], x-1, y, z-1)
                ),
                this.lerp(u,
                    this.grad(this.p[AB+1], x, y-1, z-1),
                    this.grad(this.p[BB+1], x-1, y-1, z-1)
                )
            )
        );
    }
};

// Expanded biome types with more green variations
const BIOME = {
    DARK_LOWLANDS: 0,     // Dark terrain for low areas
    ASHEN_FLATS: 1,       // Grey flatlands
    EMERALD_PLAINS: 2,    // Standard green plains
    DEEP_FOREST: 3,       // Deep, dark green forest
    DESERT: 4,            // Sandy desert areas
    RED_ROCK: 5,          // Red rock formations
    MOUNTAINS: 6,         // Mountain terrain
    SNOW: 7,              // Snow caps
    CRYSTAL_FIELDS: 8,    // Crystal formations
    TEAL_MOSS: 9,         // Teal/blue-green moss
    VOID_STONE: 10,       // Dark stone areas
    NEON_VEGETATION: 11,  // Bright neon green vegetation
    MOSSY_STONE: 12,      // Green moss-covered stone
    GLOWING_FERNS: 13     // Vibrant green glowing ferns
};

// Enhanced pattern generation for alien terrain features
function getPatternValue(x, z, scale, type) {
    switch(type) {
        case 'ridged':
            return 1.0 - Math.abs(noise.noise(x * scale, 0, z * scale));
        case 'cellular':
            // Approximation of cellular/Worley noise
            const nx = Math.floor(x * scale);
            const nz = Math.floor(z * scale);
            let minDist = 1.0;
            
            // Check neighboring cells
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    // Generate a stable random point in each cell
                    const px = nx + dx + noise.noise(nx + dx, 0, nz + dz) * 0.5 + 0.5;
                    const pz = nz + dz + noise.noise(nx + dx, 1, nz + dz) * 0.5 + 0.5;
                    
                    // Calculate distance to this point
                    const dist = Math.sqrt(Math.pow((x * scale - px), 2) + Math.pow((z * scale - pz), 2));
                    minDist = Math.min(minDist, dist);
                }
            }
            return minDist * 2.0; // Scale to roughly 0-1 range
        case 'striped':
            return Math.abs(Math.sin(x * scale * 10));
        case 'spotted':
            const n1 = noise.noise(x * scale, 0, z * scale);
            const n2 = noise.noise(x * scale * 2, 0, z * scale * 2);
            return (n1 * n2) * (n1 * n2); // Accentuate spots
        case 'waves':
            return (Math.sin(x * scale * 5) + Math.sin(z * scale * 5)) * 0.5 + 0.5;
        default:
            return noise.noise(x * scale, 0, z * scale);
    }
}

// Get pulse effect for a given coordinate
function getPulseEffect(x, z, height, time) {
    // Base pulse with time component (will be multiplied by magnitude)
    const baseTime = Date.now() * 0.001; // Convert to seconds
    const pulse = Math.sin(baseTime * 0.5 + x * 0.01 + z * 0.01) * 0.5 + 0.5;
    
    // Additional spatial variation
    const spatialVariation = noise.noise(x * 0.03, height * 0.05, z * 0.03) * 0.3;
    
    // Combine for final pulse effect (0.7 to 1.0 range)
    return 0.7 + (pulse * 0.3 * (1.0 + spatialVariation));
}

// Function to determine biome based on location and height
function getBiomeType(x, z, height) {
    // More dramatic variations
    const biomeScale = 0.005; 
    const biomeValue = noise.noise(x * biomeScale, 0, z * biomeScale);
    
    // Use different phase for feature distribution
    const featureValue = noise.noise((x + 500) * biomeScale * 1.2, 0, (z + 500) * biomeScale * 1.2);
    
    // Add another noise layer for alien biome distribution
    const alienValue = noise.noise((x - 350) * biomeScale * 0.7, 0, (z - 350) * biomeScale * 0.7);
    
    // Temperature decreases with height
    const baseTemp = biomeValue * 0.8 + 0.2; // 0.2 to 1.0
    const heightTemp = Math.max(0, 1 - (height > 30 ? (height - 30) / 100 : 0));
    const temperature = baseTemp * heightTemp;
    
    // Moisture (0 to 1)
    const moisture = featureValue * 0.8 + 0.2; // 0.2 to 1.0
    
    // Add local variation
    const localNoise = noise.noise(x * 0.02, 0, z * 0.02) * 0.15;
    
    // Pattern variants for complex features
    const cellularPattern = getPatternValue(x, z, 0.01, 'cellular');
    const spotPattern = getPatternValue(x, z, 0.05, 'spotted');
    const wavePattern = getPatternValue(x, z, 0.02, 'waves');
    
    // Low areas
    if (height < -5) return BIOME.DARK_LOWLANDS;
    
    // Flat areas near low terrain
    if (height < 0) return BIOME.ASHEN_FLATS;
    
    // GLOWING_FERNS (vibrant green glowing vegetation)
    if (wavePattern > 0.7 && moisture > 0.6 && height > 2 && height < 25) {
        return BIOME.GLOWING_FERNS;
    }
    
    // NEON_VEGETATION (bright neon green)
    if (cellularPattern > 0.5 && moisture > 0.5 && height > 0 && height < 30) {
        return BIOME.NEON_VEGETATION;
    }
    
    // CRYSTAL_FIELDS (rare and special)
    if (alienValue > 0.7 && moisture > 0.5 && height > 10 && height < 40) {
        return BIOME.CRYSTAL_FIELDS;
    }
    
    // TEAL_MOSS (blue-green alien vegetation)
    if (alienValue < 0.4 && alienValue > 0.1 && moisture > 0.5 && height > 5 && height < 35) {
        return BIOME.TEAL_MOSS;
    }
    
    // VOID_STONE (in scattered patches)
    if (alienValue > 0.6 && alienValue < 0.7 && height > 15 && height < 60) {
        return BIOME.VOID_STONE;
    }
    
    // MOSSY_STONE (green moss covered stone)
    if (cellularPattern < 0.4 && moisture > 0.4 && height > 20 && height < 50) {
        return BIOME.MOSSY_STONE;
    }
    
    // Snow on high peaks
    if (height > 60 || (height > 45 && temperature < 0.4)) {
        return BIOME.SNOW;
    }
    
    // Desert (hot and dry)
    if (temperature > 0.7 && moisture < 0.3) {
        return BIOME.DESERT;
    }
    
    // Red rock formations (hot, medium moisture)
    if (temperature > 0.6 && moisture > 0.3 && moisture < 0.5 && height > 15) {
        return BIOME.RED_ROCK;
    }
    
    // Mountains
    if (height > 35) {
        return BIOME.MOUNTAINS;
    }
    
    // Deep Forest (more moisture, darker green)
    if (moisture > 0.6) {
        return BIOME.DEEP_FOREST;
    }
    
    // Default to emerald plains (standard green)
    return BIOME.EMERALD_PLAINS;
}

function getTerrainHeight(x, z) {
    // Default 0.05.
    const xCoord = x * 0.05;
    const zCoord = z * 0.05;
    
    // Base terrain with multiple layers
    let height = 0;

    const gSpread2 = 0.001;
    height += noise.noise(xCoord * 0.1 * gSpread2, 0, zCoord * 0.1 * gSpread2) * 2048;
    
    // General spread multiplier attempt. Default 1.
    const gSpread = 0.7;
    height += noise.noise(xCoord * 0.1 * gSpread, 0, zCoord * 0.1 * gSpread) * 64;
    
    // Medium features (hills)
    height += noise.noise(xCoord * 1 * gSpread, 0, zCoord * 1 * gSpread) * 12;
    
    // Small features (rough terrain)
    height += noise.noise(xCoord * 2 * gSpread, 0, zCoord * 2 * gSpread) * 6;
    
    // Micro features (texture)
    height += noise.noise(xCoord * 4 * gSpread, 0, zCoord * 4 * gSpread) * 3;
    
    // Mountain generation with more variation
    const mountainNoise = noise.noise(xCoord * 0.25 * gSpread, 0, zCoord * 0.25 * gSpread);
    if (mountainNoise > 0.5) {
        const mountainHeight = (mountainNoise - 0.5) * 2; // 0 to 1
        const mountainScale = 40 + noise.noise(xCoord * 0.1, 0, zCoord * 0.1) * 200;
        height += mountainHeight * mountainScale;
    }
    
    // Add plateaus.
    const plateauNoise = noise.noise(xCoord * 0.15 * gSpread, 0, zCoord * 0.15 * gSpread);
    if (plateauNoise > 0.7) {
        const plateauHeight = 15;
        const plateauBlend = (plateauNoise - 0.7) * 3.33; // 0 to 1
        height = height * (1 - plateauBlend) + plateauHeight * plateauBlend;
    }
    
    // Add valleys/canyons.
    const valleyNoise = noise.noise(xCoord * 0.2 * gSpread, 0, zCoord * 0.2 * gSpread);
    if (valleyNoise < 0.2) {
        const valleyDepth = -10;
        const valleyBlend = (0.2 - valleyNoise) * 5; // 0 to 1
        height *= (1 - valleyBlend * 0.8);
    }

    let biomes = true;
    let erosion = true;
    let ridges = true;
    
    // Add biomes.
    if (biomes) {
        height += getBiomeHeight(x, z, gSpread);
    }
    
    // Add ridges.
    if (ridges) {
        const ridgeNoise = getRidgeNoise(xCoord * 0.5, zCoord * 0.5);
        height += ridgeNoise * ridgeNoise * 12; // Square it for sharper ridges.
    }
    
    // Add erosion.
    if (erosion) {
        height += getErosionNoise(xCoord, zCoord);
    }
    
    return height;
}

// Enhanced terrain coloring that considers both height and biome
function getTerrainColor(height, x, z) {
    // Get position information if not provided
    if (x === undefined || z === undefined) {
        // Assuming this is a call from the original code path
        // Return a fallback color based on height only
        return getHeightBasedColor(height);
    }
    
    // Get the biome type for this location
    const biomeType = getBiomeType(x, z, height);
    
    // Small-scale noise for color variation within biomes
    const colorNoise = noise.noise(x * 0.05, height * 0.05, z * 0.05) * 0.15;
    
    // Get pulse effect for living terrain
    const pulseEffect = getPulseEffect(x, z, height);
    
    // Get pattern values for detailed features
    const stripedPattern = getPatternValue(x, z, 0.02, 'striped');
    const cellularPattern = getPatternValue(x, z, 0.01, 'cellular');
    
    // Adjust colors based on biome type
    switch (biomeType) {
        case BIOME.DARK_LOWLANDS:
            // Dark purple-black lowlands with pulsing
            const lowlandShade = 0.3 + colorNoise * 0.2;
            const lowlandPulse = 0.8 + pulseEffect * 0.2;
            return `rgb(${Math.floor(20 * lowlandShade * lowlandPulse)}, 
                        ${Math.floor(5 * lowlandShade * lowlandPulse)}, 
                        ${Math.floor(25 * lowlandShade * lowlandPulse)})`;
            
        case BIOME.ASHEN_FLATS:
            // Grey ashen areas with subtle pulse
            const ashenShade = 0.6 + colorNoise;
            const ashenPulse = 0.9 + pulseEffect * 0.1;
            return `rgb(${Math.floor(90 * ashenShade * ashenPulse)}, 
                        ${Math.floor(90 * ashenShade * ashenPulse)}, 
                        ${Math.floor(95 * ashenShade * ashenPulse)})`;
            
        case BIOME.EMERALD_PLAINS:
            // Standard green plains with pulse effect
            const grassShade = 0.5 + colorNoise;
            const grassPulse = pulseEffect;
            return `rgb(${Math.floor(30 * grassShade * grassPulse)}, 
                        ${Math.floor(120 * grassShade * grassPulse)}, 
                        ${Math.floor(40 * grassShade * grassPulse)})`;
            
        case BIOME.DEEP_FOREST:
            // Darker green forests with pulse
            const forestShade = 0.6 + colorNoise;
            const forestPulse = pulseEffect;
            return `rgb(${Math.floor(10 * forestShade * forestPulse)}, 
                        ${Math.floor(60 * forestShade * forestPulse)}, 
                        ${Math.floor(30 * forestShade * forestPulse)})`;
            
        case BIOME.DESERT:
            // Sandy desert with subtle pulse
            const sandShade = 0.8 + colorNoise;
            const sandPulse = 0.95 + pulseEffect * 0.05;
            return `rgb(${Math.floor(210 * sandShade * sandPulse)}, 
                        ${Math.floor(180 * sandShade * sandPulse)}, 
                        ${Math.floor(120 * sandShade * sandPulse)})`;
            
        case BIOME.RED_ROCK:
            // Red rock formations with subtle pulse
            const rockShade = 0.7 + colorNoise;
            const rockPulse = 0.9 + pulseEffect * 0.1;
            return `rgb(${Math.floor(160 * rockShade * rockPulse)}, 
                        ${Math.floor(80 * rockShade * rockPulse)}, 
                        ${Math.floor(60 * rockShade * rockPulse)})`;
            
        case BIOME.MOUNTAINS:
            // Grey-brown mountain rock with pulse
            const mtShade = 0.7 + colorNoise;
            const mtPulse = 0.9 + pulseEffect * 0.1;
            return `rgb(${Math.floor(110 * mtShade * mtPulse)}, 
                        ${Math.floor(100 * mtShade * mtPulse)}, 
                        ${Math.floor(90 * mtShade * mtPulse)})`;
            
        case BIOME.SNOW:
            // White snow with subtle pulse
            const snowShade = 0.9 + colorNoise * 0.5;
            const snowPulse = 0.95 + pulseEffect * 0.05;
            return `rgb(${Math.floor(240 * snowShade * snowPulse)}, 
                        ${Math.floor(235 * snowShade * snowPulse)}, 
                        ${Math.floor(245 * snowShade * snowPulse)})`;
            
        case BIOME.CRYSTAL_FIELDS:
            // Glowing purple crystals with strong pulsing effect
            const crystalPulse = pulseEffect;
            return `rgb(${Math.floor(180 * crystalPulse + colorNoise * 30)}, 
                        ${Math.floor(50 * crystalPulse + colorNoise * 20)}, 
                        ${Math.floor(170 * crystalPulse + colorNoise * 40)})`;
            
        case BIOME.TEAL_MOSS:
            // Blue-green alien vegetation with pulse
            const tealShade = 0.7 + colorNoise;
            const tealPulse = pulseEffect;
            return `rgb(${Math.floor(20 * tealShade * tealPulse)}, 
                        ${Math.floor(150 * tealShade * tealPulse)}, 
                        ${Math.floor(130 * tealShade * tealPulse)})`;
            
        case BIOME.VOID_STONE:
            // Dark terrain with subtle red pulse
            const voidShade = 0.3 + colorNoise * 0.5;
            const voidPulse = pulseEffect;
            return `rgb(${Math.floor(30 * voidShade * voidPulse)}, 
                        ${Math.floor(5 * voidShade)}, 
                        ${Math.floor(20 * voidShade)})`;
        
        case BIOME.NEON_VEGETATION:
            // Bright neon green vegetation with strong pulse
            const neonPulse = pulseEffect * 1.2;
            const neonPattern = stripedPattern * 0.3 + 0.7;
            return `rgb(${Math.floor(70 * neonPulse * neonPattern)}, 
                        ${Math.floor(230 * neonPulse * neonPattern)}, 
                        ${Math.floor(50 * neonPulse * neonPattern)})`;
                        
        case BIOME.MOSSY_STONE:
            // Grey-green mossy stone with pulse
            const mossShade = 0.6 + colorNoise * 0.3;
            const mossPattern = cellularPattern * 0.7 + 0.3;
            const mossPulse = pulseEffect;
            return `rgb(${Math.floor(70 * mossShade)}, 
                        ${Math.floor(120 * mossShade * mossPattern * mossPulse)}, 
                        ${Math.floor(70 * mossShade)})`;
                        
        case BIOME.GLOWING_FERNS:
            // Vibrant green glowing ferns with strong pulse
            const fernShade = 0.8 + colorNoise * 0.2;
            const fernPulse = pulseEffect * 1.3;
            return `rgb(${Math.floor(40 * fernShade)}, 
                        ${Math.floor(180 * fernShade * fernPulse)}, 
                        ${Math.floor(60 * fernShade)})`;
            
        default:
            // Fallback to height-based coloring
            return getHeightBasedColor(height);
    }
}

// Revised height-based coloring with green focus
function getHeightBasedColor(height) {
    if (height < -11.5) return '#261a26'; // Dark purple for very low areas
    if (height < 0) return '#404040';     // Dark grey for low areas  
    if (height < 5) return '#1a331a';     // Dark green for slightly higher
    if (height < 10) return '#004400';    // Darker green
    if (height < 30) return '#006622';    // Medium green
    if (height < 50) return '#008833';    // Lighter green
    if (height < 70) return '#6B776B';    // Grey-green
    return '#FFFFFF';                     // White for high peaks
}

// Terrain generator component.
AFRAME.registerComponent('terrain-generator', {
    schema: {
        chunk: {type: 'vec2'} // Current chunk coordinates.
    },

    init: function() {
        noise.init();
        this.player = document.querySelector('#player').object3D;
        this.chunks = new Map(); // Store generated chunks.
        this.generateChunk(-99,999);
        this.chunkSize = 64;
        this.chunksToGen = 3;
    },

    generateChunk: function(chunkX, chunkZ) {
        const chunkSize = this.chunkSize;
        const resolution = 1;
        const vertices = [];
        const indices = [];
        
        const offsetX = chunkX * (chunkSize - 1);
        const offsetZ = chunkZ * (chunkSize - 1);
        
        // Store world coordinates for color calculation
        const worldCoords = [];
        
        for (let z = 0; z < chunkSize; z += resolution) {
            for (let x = 0; x < chunkSize; x += resolution) {
                const worldX = x + offsetX;
                const worldZ = z + offsetZ;
                const height = getTerrainHeight(worldX, worldZ);
                vertices.push(worldX, height, worldZ);
                
                // Store world coordinates for later color assignment
                worldCoords.push({x: worldX, z: worldZ});
            }
        }

        // Generate indices.
        const verticesPerRow = chunkSize / resolution;
        for (let z = 0; z < verticesPerRow - 1; z++) {
            for (let x = 0; x < verticesPerRow - 1; x++) {
                const topLeft = z * verticesPerRow + x;
                const topRight = topLeft + 1;
                const bottomLeft = (z + 1) * verticesPerRow + x;
                const bottomRight = bottomLeft + 1;

                indices.push(topLeft, bottomLeft, topRight);
                indices.push(bottomLeft, bottomRight, topRight);
            }
        }

        // Calculate colors using enhanced function that uses position + height
        const colors = [];
        for (let i = 0; i < vertices.length; i += 3) {
            const height = vertices[i + 1]; // Y coordinate is height
            const coordIndex = i / 3;
            const worldX = worldCoords[coordIndex].x;
            const worldZ = worldCoords[coordIndex].z;
            
            // Get color based on both height and world position
            const colorHex = getTerrainColor(height, worldX, worldZ);
            const color = new THREE.Color(colorHex);
            colors.push(color.r, color.g, color.b);
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const chunk = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.8,
                metalness: 0.2,
                flatShading: true
            })
        );

        this.el.object3D.add(chunk);
        this.chunks.set(`${chunkX},${chunkZ}`, chunk);

        // Emit custom event after chunk generation.
        const event = new CustomEvent('chunk-generated', {
            detail: { 
                chunkX, 
                chunkZ,
                offsetX,
                offsetZ
            }
        });
        this.el.dispatchEvent(event);
    },

    tick: function() {
        const player = this.player;
        const chunkSize = this.chunkSize;
        
        // Calculate current chunk.
        const chunkX = Math.floor(player.position.x / chunkSize);
        const chunkZ = Math.floor(player.position.z / chunkSize);
        
        // Generate surrounding chunks if they don't exist.
        for (let z = chunkZ - this.chunksToGen; z <= chunkZ + this.chunksToGen; z++) {
            for (let x = chunkX - this.chunksToGen; x <= chunkX + this.chunksToGen; x++) {
                const key = `${x},${z}`;
                if (!this.chunks.has(key)) {
                    this.generateChunk(x, z);
                }
            }
        }

        // Remove far chunks.
        for (const [key, chunk] of this.chunks.entries()) {
            const [x, z] = key.split(',').map(Number);
            if (Math.abs(x - chunkX) > (this.chunksToGen+1) || 
                Math.abs(z - chunkZ) > (this.chunksToGen+1)) {
                this.el.object3D.remove(chunk);
                this.chunks.delete(key);
            }
        }
    }
});

function getBiomeHeight(x, z, gSpread) {
    const xCoord = x * 0.05 * gSpread;
    const zCoord = z * 0.05 * gSpread;
    
    // Biome selection.
    const biomeNoise = noise.noise(xCoord * 0.002, 0, zCoord * 0.002);
    
    let height = 0;
    
    if (biomeNoise < 0.5) {
        // Plains biome
        height += noise.noise(xCoord * 1, 0, zCoord * 1) * 8;
        height += noise.noise(xCoord * 2, 0, zCoord * 2) * 4;
        
    } else if (biomeNoise < 0.6) {
        // Hills biome
        height += noise.noise(xCoord * 0.5, 0, zCoord * 0.5) * 20;
        height += noise.noise(xCoord * 1, 0, zCoord * 1) * 10;
        
    } else {
        // Mountains biome
        height += noise.noise(xCoord * 0.3, 0, zCoord * 0.3) * 35;
        height += noise.noise(xCoord * 0.8, 0, zCoord * 0.8) * 15;
        
        // Sharp peaks
        const peakNoise = noise.noise(xCoord * 1.5, 0, zCoord * 1.5);
        if (peakNoise > 0.7) {
            height += Math.pow(peakNoise - 0.7, 2) * 60;
        }
    }
    
    return height;
}

function getRidgeNoise(x, z) {
    const n = noise.noise(x, 0, z);
    return 1 - Math.abs(n); // Creates sharp ridges
}

function getErosionNoise(xCoord, zCoord) {
    // Erosion effect.
    const erosionNoise = noise.noise(xCoord * 3, 0, zCoord * 3);
    const slope = Math.abs(
        noise.noise(xCoord + 0.1, 0, zCoord) - 
        noise.noise(xCoord - 0.1, 0, zCoord)
    );
    
    // More erosion on steeper slopes.
    const erosionStrength = 16;
    if (slope > 0.2) {
        return -erosionNoise * slope * erosionStrength;
    } else return 0;
}