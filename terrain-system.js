// terrain-system.js - Handles terrain generation and management

// ========== TERRAIN CONFIGURATION ==========
window.TerrainConfig = {
    seed: 99,
    heightScale: 2048.0, // 3256.0 1256.0
    noiseScale: 0.0006, // 0.0003 0.0002 0.0008
    baseHeight: 0, // -22.0
    useRidges: true,
    ridgeFactor: 0.28, // 0.14
    octaves: 8,
    ridgeOctaves: 4, // 4
    lacunarity: 2.52, // 2.52 2.0
    gain: 0.5, // 0.52
    useHexagons: true,
    // geometry size corresponds to hex-simple geometry size :(
    geometrySize: 4.0, // 4.02. 4.4 Larger number increases spacing between prisms.
    geometryHeight: 16, // 16
    heightStep: 3.0, // 4.0 2.2 4.4
    chunkSize: 144, // Make sure this is a square number.
    loadDistance: 64*9, // 81*9 1200
    unloadDistance: 64*9+64, // 81*9+81 1260
    pulseThreshold: 50.0, 
    colorVariation: 36.0, //18.0
    // New section for coloration noise adjustments:
    colorNoiseScale: 0.01,  // 0.01 spatial frequency for hue noise variation
    colorNoiseRange: 4.0,    // 2.0 maximum deviation in degrees
    applyToGenerator: function(generator) {
        if (generator) {
            generator.heightScale = this.heightScale;
            generator.noiseScale = this.noiseScale;
            generator.baseHeight = this.baseHeight;
            generator.octaves = this.octaves;
            generator.ridgeOctaves = this.ridgeOctaves;
            generator.useRidges = this.useRidges;
            generator.ridgeFactor = this.ridgeFactor;
            generator.seed = this.seed;
            generator.hex = this.useHexagons;
            generator.cubeSize = this.geometrySize;
        }
    }
};

// ========== IMPROVED NOISE FUNCTIONS ==========
const ImprovedNoise = {
    p: new Array(1024),
    seed: function(seed) {
        if (seed > 0 && seed < 1) seed *= 65536;
        seed = Math.floor(seed);
        if (seed < 256) seed |= seed << 8;
        const perm = new Array(256);
        for (let i = 0; i < 256; i++) perm[i] = i;
        for (let i = 255; i > 0; i--) {
            const seedMix = (seed ^ (seed >> 5) ^ (seed << 7) ^ (i * 13)) & 0xFFFFFFFF;
            const j = seedMix % (i + 1);
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        for (let i = 0; i < 256; i++) {
            this.p[i] = this.p[i + 256] = this.p[i + 512] = this.p[i + 768] = perm[i];
        }
    },
    fade: function(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    },
    lerp: function(t, a, b) {
        return a + t * (b - a);
    },
    grad: function(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    },
    perlin2: function(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = this.fade(x);
        const v = this.fade(y);
        const A = this.p[X] + Y;
        const B = this.p[X + 1] + Y;
        const AA = this.p[A];
        const AB = this.p[A + 1];
        const BA = this.p[B];
        const BB = this.p[B + 1];
        return this.lerp(v, 
            this.lerp(u, this.grad(this.p[AA], x, y, 0), this.grad(this.p[BA], x-1, y, 0)),
            this.lerp(u, this.grad(this.p[AB], x, y-1, 0), this.grad(this.p[BB], x-1, y-1, 0))
        );
    },
    fbm: function(x, y, octaves = 8, lacunarity = 2.0, gain = 0.5) {
        let total = 0;
        let frequency = 1.0;
        let amplitude = 1.0;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            total += this.perlin2(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }
        return total / maxValue;
    },
    ridgedMulti: function(x, y, octaves = 8, lacunarity = 2.0, gain = 0.5, offset = 1.0) {
        let total = 0;
        let frequency = 1.0;
        let amplitude = 1.0;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            let signal = this.perlin2(x * frequency, y * frequency);
            signal = offset - Math.abs(signal);
            signal *= signal;
            total += signal * amplitude;
            maxValue += amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }
        return total / maxValue;
    }
};

window.ImprovedNoise = ImprovedNoise;

// Terrain Generator
class TerrainGenerator {
    constructor(options = {}) {
        const config = window.TerrainConfig || {};
        this.hex = options.hex !== undefined ? options.hex : config.useHexagons || true;
        this.cubeSize = options.cubeSize || config.geometrySize || 1.0;
        this.heightScale = options.heightScale || config.heightScale || 20.0;
        this.noiseScale = options.noiseScale || config.noiseScale || 0.03;
        this.baseHeight = options.baseHeight || config.baseHeight || 0.1;
        this.seed = options.seed || config.seed || Math.floor(Math.random() * 65536);
        this.geometryHeight = options.geometryHeight || config.geometryHeight || 3;
        this.heightStep = options.heightStep || config.heightStep || 1;
        this.octaves = options.octaves || config.octaves || 8;
        this.ridgeOctaves = options.ridgeOctaves || config.ridgeOctaves || 4;
        this.useRidges = options.useRidges !== undefined ? options.useRidges : (config.useRidges !== undefined ? config.useRidges : true);
        this.ridgeFactor = options.ridgeFactor || config.ridgeFactor || 0.3;
        this.lacunarity = options.lacunarity || config.lacunarity || 2.0;
        this.gain = options.gain || config.gain || 0.5;
        this.colorVariation = options.colorVariation || config.colorVariation || 0.1;
        ImprovedNoise.seed(this.seed);
        console.log(`TerrainGenerator initialized with seed: ${this.seed}`);
    }
    
    generateTerrainHeight(x, z) {
        const continentScale = this.noiseScale;
        let baseHeight = ImprovedNoise.fbm(x * continentScale, z * continentScale, this.octaves, this.lacunarity, this.gain);
        if (this.useRidges) {
            const ridgeNoise = ImprovedNoise.ridgedMulti(x * continentScale * 2, z * continentScale * 2, this.ridgeOctaves, this.lacunarity, this.gain);
            baseHeight = baseHeight * (1 - this.ridgeFactor) + ridgeNoise * this.ridgeFactor;
        }
        const detailScale = this.noiseScale * 6;
        const detail = ImprovedNoise.perlin2(x * detailScale, z * detailScale) * 0.1;
        baseHeight += detail;
        baseHeight = this.baseHeight + ((baseHeight + 1) / 2) * this.heightScale;
        return baseHeight;
    }
    
    // New helper: convert HSV to RGB
    static hsvToRgb(h, s, v) {
        // h: 0-360, s: 0-1, v: 0-1
        let c = v * s;
        let x = c * (1 - Math.abs((h / 60) % 2 - 1));
        let m = v - c;
        let r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        return [r + m, g + m, b + m];
    }
    
    getColor(x, z, height) {
        const normalizedHeight = Math.min(1, Math.max(0, (height - this.baseHeight) / this.heightScale));
        const baseHue = normalizedHeight * 360; // Base hue from height
        
        // Amplify hue noise variation significantly.
        const hueNoise = ImprovedNoise.perlin2(x * TerrainConfig.colorNoiseScale, z * TerrainConfig.colorNoiseScale)
            * (TerrainConfig.colorNoiseRange * 50); // amplified variation
        const hue = (baseHue + hueNoise + 360) % 360;
        
        // Increase saturation and brightness variations.
        const satNoise = ImprovedNoise.perlin2((x + 100) * TerrainConfig.colorNoiseScale, (z + 100) * TerrainConfig.colorNoiseScale);
        const valNoise = ImprovedNoise.perlin2((x - 100) * TerrainConfig.colorNoiseScale, (z - 100) * TerrainConfig.colorNoiseScale);
        const baseSaturation = 0.85, baseValue = 0.97;//0.8 0.9
        const saturation = baseSaturation + satNoise * 0.001; // increased variation
        const value = baseValue + valNoise * 0.001; // increased variation
        
        return TerrainGenerator.hsvToRgb(hue, saturation, value);
    }
    
    generateChunk(chunkX, chunkZ, chunkSize) {
        const cubes = [];
        for (let x = 0; x < chunkSize; x++) {
            for (let z = 0; z < chunkSize; z++) {
                const worldX = chunkX + x * this.cubeSize;
                const worldZ = chunkZ + z * this.cubeSize; // Squeeze hexagons together on Z.
                const height = this.generateTerrainHeight(worldX, worldZ);
                const color = this.getColor(worldX, worldZ, height);
                // Hex positioning hack.
                // Note the 2.18 and 1.09 values correspond (1st 2*2nd)
                // in order to squeeze hexagons together
                // on the x axis. Geometry might be shorter here?
                const slider = z % 2 * 2;
                //const slider = z % 2 * 2.18;
                //const wX = x * this.cubeSize * 1.09 + slider;
                const wX = x * this.cubeSize + slider;
                const wZ = z * this.cubeSize;
                cubes.push({
                    position: [wX, Math.floor(height / this.heightStep) * this.heightStep, wZ],
                    // Added random height change.
                    height: this.geometryHeight,
                    color: color
                });
            }
        }
        return {
            chunkX: chunkX,
            chunkZ: chunkZ,
            size: chunkSize,
            cubes: cubes
        };
    }
}

// Register the terrain-manager component
AFRAME.registerComponent('terrain-manager', {
    schema: {
        loadDistance: {type: 'number', default: 100},
        unloadDistance: {type: 'number', default: 150},
        heightOffset: {type: 'number', default: 16},
        followTerrain: {type: 'boolean', default: false},
        chunkSize: {type: 'number', default: 16},
        cubeSize: {type: 'number', default: 1.0},
        seed: {type: 'number', default: 0}
    },
    
    init: function() {
        console.log("Terrain manager component initializing...");
        if (window.TerrainConfig) {
            this.data.loadDistance = window.TerrainConfig.loadDistance || this.data.loadDistance;
            this.data.unloadDistance = window.TerrainConfig.unloadDistance || this.data.unloadDistance;
            this.data.chunkSize = window.TerrainConfig.chunkSize || this.data.chunkSize;
            this.data.cubeSize = window.TerrainConfig.geometrySize || this.data.cubeSize;
            if (window.TerrainConfig.seed && this.data.seed === 0) {
                this.data.seed = window.TerrainConfig.seed;
            }
        }
        this.subject = document.querySelector('#subject');
        if (!this.subject) {
            console.error('Element with id "subject" not found!');
            return;
        }
        this.subjectObj = this.subject.object3D;
        // Move subject to a different world position at start
        // so that they do
        //this.subjectObj.position.set(100, 0, 100);
        this.lastX = this.subject.object3D.position.x;
        this.lastZ = this.subject.object3D.position.z;
        this.chunkManager = null;
        this.lastChunkX = null;
        this.lastChunkZ = null;
        if (this.data.seed === 0) {
            this.data.seed = Math.floor(Math.random() * 1000000);
        }
        const scene = this.el.sceneEl;
        if (scene.hasLoaded) {
            setTimeout(() => this.onSceneLoaded(), 100);
        } else {
            scene.addEventListener('loaded', () => {
                this.onSceneLoaded();
            });
        }
        console.log('Terrain manager initialized, waiting for scene to load...');
    },
    
    onSceneLoaded: function() {
        try {
            console.log("Scene loaded, initializing terrain...");
            this.chunkManager = new TerrainChunkManager({
                chunkSize: this.data.chunkSize,
                cubeSize: this.data.cubeSize,
                seed: this.data.seed,
                useHexagons: window.TerrainConfig ? window.TerrainConfig.useHexagons : true
            });
            const initialX = this.subjectObj.position.x;
            const initialZ = this.subjectObj.position.z;
            this.lastX = initialX;
            this.lastZ = initialZ;
            const chunkWorldSize = this.data.chunkSize * this.data.cubeSize;
            this.lastChunkX = Math.floor(initialX / chunkWorldSize);
            this.lastChunkZ = Math.floor(initialZ / chunkWorldSize);
            this.updateTerrain(initialX, initialZ);
            this.setupDebugPanel();
            this.tick = AFRAME.utils.throttleTick(this.tick, 1, this);
            setTimeout(() => {
                this.updateTerrain(this.subjectObj.position.x, this.subjectObj.position.z);
                const event = new CustomEvent('terrainReady');
                document.dispatchEvent(event);
            }, 500);
            console.log("Terrain manager initialization complete");
        } catch (error) {
            console.error("Failed to initialize terrain:", error);
        }
    },
    
    updateTerrain: function(x, z) {
        if (this.chunkManager) {
            this.chunkManager.updateChunksFromPosition(x, z, this.data.loadDistance, this.data.unloadDistance);
        }
    },
    
    tick: function() {
        try {
            const x = this.subjectObj.position.x;
            const z = this.subjectObj.position.z;
            // Update the time uniform for the pulse effect
            if (this.chunkManager && this.chunkManager.cubeMaterial) {
                this.chunkManager.cubeMaterial.uniforms.time.value = performance.now() / 1000.0;
            }
            const distX = x - this.lastX;
            const distZ = z - this.lastZ;
            const distance = Math.sqrt(distX * distX + distZ * distZ);
            const chunkWorldSize = this.data.chunkSize * this.data.cubeSize;
            const currentChunkX = Math.floor(x / chunkWorldSize);
            const currentChunkZ = Math.floor(z / chunkWorldSize);
            const chunkChanged = currentChunkX !== this.lastChunkX || currentChunkZ !== this.lastChunkZ;
            if (chunkChanged || distance > 10) {
                this.updateTerrain(x, z);
                this.lastChunkX = currentChunkX;
                this.lastChunkZ = currentChunkZ;
                this.lastX = x;
                this.lastZ = z;
            }
            if (this.data.followTerrain && this.chunkManager && this.chunkManager.terrainGenerator) {
                try {
                    const terrainHeight = this.chunkManager.terrainGenerator.generateTerrainHeight(x, z);
                    const targetHeight = terrainHeight + this.data.heightOffset;
                    if (this.subjectObj.position.y !== targetHeight) {
                        this.subjectObj.position.y += (targetHeight - this.subjectObj.position.y) * 0.8;
                    }
                } catch (error) {
                    console.warn("Error in terrain following:", error);
                }
            }
            this.updateDebugPanel();
        } catch (error) {
            console.error('Error in terrain-manager tick:', error);
        }
    },
    
    setupDebugPanel: function() {
        console.log("Using unified debug panel system");
        if (window.DebugPanel) {
            window.DebugPanel.terrainManager = this;
            window.DebugPanel.updateAllSections();
        }
    },
    
    updateDebugPanel: function() {
        try {
            if (!window.DebugPanel) return;
            const pos = this.subjectObj.position;
            const chunkWorldSize = this.data.chunkSize * this.data.cubeSize;
            const chunkX = Math.floor(pos.x / chunkWorldSize);
            const chunkZ = Math.floor(pos.z / chunkWorldSize);
            let terrainHeight = 0;
            if (this.chunkManager && this.chunkManager.terrainGenerator) {
                try {
                    terrainHeight = this.chunkManager.terrainGenerator.generateTerrainHeight(pos.x, pos.z);
                } catch (error) {
                    console.warn("Error calculating terrain height:", error);
                }
            }
            const loadedChunks = this.chunkManager ? this.chunkManager.loadedChunks.size : 0;
            window.DebugPanel.updateInfoSection(pos.x, pos.y, pos.z, chunkX, chunkZ, terrainHeight, loadedChunks);
        } catch (error) {
            console.error('Error updating debug panel:', error);
        }
    }
});

// Terrain Chunk Manager class
class TerrainChunkManager {
    constructor(options = {}) {
        try {
            const config = window.TerrainConfig || {};
            this.chunkSize = options.chunkSize || config.chunkSize || 16;
            this.cubeSize = options.cubeSize || config.geometrySize || 1.0;
            this.seed = options.seed || config.seed || Math.floor(Math.random() * 65536);
            this.useHexagons = options.useHexagons !== undefined ? options.useHexagons : (config.useHexagons !== undefined ? config.useHexagons : false);
            console.log("TerrainChunkManager options:", {
                chunkSize: this.chunkSize,
                cubeSize: this.cubeSize,
                seed: this.seed,
                useHexagons: this.useHexagons
            });
            this.loadedChunks = new Map();
            this.terrainContainer = document.getElementById('terrain-container');
            if (!this.terrainContainer) {
                this.terrainContainer = document.createElement('a-entity');
                this.terrainContainer.id = 'terrain-container';
                document.querySelector('a-scene').appendChild(this.terrainContainer);
            }
            this.cubeMaterial = window.CubeTerrainBuilder.createCubeMaterial();
            this.terrainGenerator = new TerrainGenerator({
                cubeSize: this.cubeSize,
                seed: this.seed,
                hex: this.useHexagons
            });
            if (window.TerrainConfig && window.TerrainConfig.applyToGenerator) {
                window.TerrainConfig.applyToGenerator(this.terrainGenerator);
            }
            console.log('Terrain Chunk Manager initialized with seed:', this.seed);
        } catch (error) {
            console.error("Error in TerrainChunkManager constructor:", error);
            throw error;
        }
    }
    
    updateChunksFromPosition(viewX, viewZ, loadDistance, unloadDistance) {
        const chunkWorldSize = this.chunkSize * this.cubeSize;
        const centerChunkX = Math.floor(viewX / chunkWorldSize);
        const centerChunkZ = Math.floor(viewZ / chunkWorldSize);
        const chunkRadius = Math.ceil(loadDistance / chunkWorldSize) + 1;
        const chunksToKeep = new Set();
        for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
            for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
                // Stretch out to undo squeeze of tesselation hack?
                const chunkX = (centerChunkX + dx) * chunkWorldSize;
                const chunkZ = (centerChunkZ + dz) * chunkWorldSize;
                const centerX = chunkX + chunkWorldSize * 0.5;
                const centerZ = chunkZ + chunkWorldSize * 0.5;
                const distX = centerX - viewX;
                const distZ = centerZ - viewZ;
                const distance = Math.sqrt(distX * distX + distZ * distZ);
                if (distance <= loadDistance) {
                    const key = `${chunkX},${chunkZ}`;
                    chunksToKeep.add(key);
                    if (!this.loadedChunks.has(key)) {
                        this.loadChunkAt(chunkX, chunkZ);
                    }
                }
            }
        }
        for (const [key, chunkInfo] of this.loadedChunks.entries()) {
            if (!chunksToKeep.has(key)) {
                const [chunkX, chunkZ] = key.split(',').map(Number);
                const centerX = chunkX + chunkWorldSize * 0.5;
                const centerZ = chunkZ + chunkWorldSize * 0.5;
                const distX = centerX - viewX;
                const distZ = centerZ - viewZ;
                const distance = Math.sqrt(distX * distX + distZ * distZ);
                if (distance > unloadDistance) {
                    this.unloadChunk(key);
                }
            }
        }
    }
    
    loadChunkAt(chunkX, chunkZ) {
        const key = `${chunkX},${chunkZ}`;
        if (this.loadedChunks.has(key)) return;
        const entity = document.createElement('a-entity');
        entity.setAttribute('position', `${chunkX} 0 ${chunkZ}`);
        this.terrainContainer.appendChild(entity);
        const chunkData = this.terrainGenerator.generateChunk(chunkX, chunkZ, this.chunkSize);
        const chunk = window.CubeTerrainBuilder.createChunkMesh(chunkData, this.cubeMaterial);
        this.loadedChunks.set(key, { entity: entity, mesh: chunk });
        entity.setObject3D('mesh', chunk);
    }
    
    unloadChunk(key) {
        if (!this.loadedChunks.has(key)) return;
        const chunkInfo = this.loadedChunks.get(key);
        this.loadedChunks.delete(key);
        chunkInfo.entity.removeObject3D('mesh');
        if (chunkInfo.entity.parentNode) {
            chunkInfo.entity.parentNode.removeChild(chunkInfo.entity);
        }
    }
}

// Global terrain height function for other components to use
window.getTerrainHeight = function(x, z) {
    const scene = document.querySelector('a-scene');
    if (!scene) return 0;
    const terrainManagerEl = scene.querySelector('[terrain-manager]');
    if (!terrainManagerEl) return 0;
    const terrainManager = terrainManagerEl.components['terrain-manager'];
    if (!terrainManager || !terrainManager.chunkManager || !terrainManager.chunkManager.terrainGenerator) return 0;
    try {
        return terrainManager.chunkManager.terrainGenerator.generateTerrainHeight(x, z);
    } catch (error) {
        console.warn("Error getting terrain height:", error);
        return 0;
    }
};