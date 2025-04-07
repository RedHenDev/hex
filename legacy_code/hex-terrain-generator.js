// Hexagonal terrain generator for A-Frame
// Based on flat-top hexagonal grid system

AFRAME.registerComponent('hex-terrain-generator', {
  schema: {
    chunkSize: { type: 'number', default: 8 }, // Number of hexes per chunk side
    hexSize: { type: 'number', default: 4 }, // Size of hexagon (flat to flat distance)
    heightScale: { type: 'number', default: 1.0 }, // Scale factor for terrain height
    noiseScale: { type: 'number', default: 0.05 }, // Scale factor for noise
    seed: { type: 'string', default: '1' }, // Seed for noise generation
    waterLevel: { type: 'number', default: -10 } // Level for water surface
  },

  init: function() {
    // Ensure noise is initialized (from urizen.js)
    if (typeof noise !== 'undefined' && noise.init) {
      noise.init();
    } else {
      console.error('Noise utility not found. Make sure urizen.js is loaded.');
    }
    
    this.player = document.querySelector('#player').object3D;
    this.chunks = new Map(); // Store generated chunks
    this.chunkSize = this.data.chunkSize;
    this.hexSize = this.data.hexSize;
    
    // Calculate hex constants
    this.hexHeight = this.hexSize * 2;
    this.hexWidth = Math.sqrt(3) * this.hexSize;
    this.verticalSpacing = this.hexHeight * 0.75;
    
    // Override the global getTerrainHeight function for compatibility with a-loco.js
    window.getTerrainHeight = this.getHeightAt.bind(this);
    
    // Initialize heightmap cache for efficient lookup
    this.heightCache = new Map();
    
    console.log('Hex terrain generator initialized with seed:', this.data.seed);
  },
  
  // Convert hex coordinates to world coordinates
  hexToWorld: function(q, r) {
    const x = this.hexWidth * (q + r/2);
    const z = this.verticalSpacing * r;
    return { x, z };
  },
  
  // Convert world coordinates to closest hex coordinates
  worldToHex: function(x, z) {
    // Simplified conversion for flat-top hexes
    const r = (z / this.verticalSpacing);
    const q = (x / this.hexWidth) - (r / 2);
    
    // Round to nearest hex
    return { 
      q: Math.round(q), 
      r: Math.round(r) 
    };
  },
  
  // Get terrain height at world coordinates
  getHeightAt: function(x, z) {
    // Cache lookup for performance
    const key = `${Math.floor(x/2)},${Math.floor(z/2)}`;
    if (this.heightCache.has(key)) {
      return this.heightCache.get(key);
    }
    
    // Base noise for overall terrain shape
    const baseNoise = noise.noise(
      x * this.data.noiseScale * 0.2, 
      0, 
      z * this.data.noiseScale * 0.2
    );
    
    // Medium-scale features
    const mediumNoise = noise.noise(
      x * this.data.noiseScale * 0.5, 
      0, 
      z * this.data.noiseScale * 0.5
    ) * 0.3;
    
    // Small-scale features for detail
    const detailNoise = noise.noise(
      x * this.data.noiseScale * 2, 
      0, 
      z * this.data.noiseScale * 2
    ) * 0.1;
    
    // Combine noise layers
    let height = (baseNoise * 40 + mediumNoise * 20 + detailNoise * 10) * this.data.heightScale;
    
    // Add mountains
    const mountainNoise = noise.noise(x * 0.007, 0, z * 0.007);
    if (mountainNoise > 0.65) {
      const mountainFactor = (mountainNoise - 0.65) * 2.85; // 0-1 range
      height += mountainFactor * 50 * this.data.heightScale;
    }
    
    // Add plateaus
    const plateauNoise = noise.noise(x * 0.015, 0, z * 0.015);
    if (plateauNoise > 0.7 && plateauNoise < 0.78) {
      const plateauBlend = (plateauNoise - 0.7) * 12.5; // 0-1 range
      const plateauHeight = 20 * this.data.heightScale;
      height = height * (1 - plateauBlend) + plateauHeight * plateauBlend;
    }
    
    // Add deep valleys
    const valleyNoise = noise.noise(x * 0.02, 0, z * 0.02);
    if (valleyNoise < 0.25) {
      const valleyFactor = (0.25 - valleyNoise) * 4; // 0-1 range
      height -= valleyFactor * 20 * this.data.heightScale;
    }
    
    // Cache result
    this.heightCache.set(key, height);
    return height;
  },
  
  // Get biome type based on position and height
  getBiomeType: function(x, z, height) {
    const biomeScale = 0.008;
    const temperatureNoise = noise.noise(x * biomeScale, 0, z * biomeScale);
    const moistureNoise = noise.noise((x + 500) * biomeScale * 1.2, 0, (z + 500) * biomeScale * 1.2);
    
    // Temperature (0 to 1, affected by height)
    const baseTemp = temperatureNoise * 0.7 + 0.3;
    const heightTemp = Math.max(0, 1 - (height > 30 ? (height - 30) / 70 : 0));
    const temperature = baseTemp * heightTemp;
    
    // Moisture (0 to 1)
    const moisture = moistureNoise * 0.8 + 0.2;
    
    // Simplified biome selection
    if (height < this.data.waterLevel) return 'WATER';
    if (height < this.data.waterLevel + 2) return 'BEACH';
    if (height > 55 || (height > 40 && temperature < 0.3)) return 'SNOW';
    if (temperature > 0.7 && moisture < 0.3) return 'DESERT';
    if (temperature > 0.6 && moisture > 0.3 && moisture < 0.5 && height > 15) return 'RED_ROCK';
    if (height > 35) return 'MOUNTAINS';
    if (moisture > 0.65) return 'DEEP_FOREST';
    if (moisture > 0.45) return 'FOREST';
    
    return 'PLAINS';
  },
  
  // Get color for a biome (with subtle variations)
  getBiomeColor: function(biome, x, z, height) {
    // Add small variation to colors
    const variation = noise.noise(x * 0.1, height * 0.05, z * 0.1) * 0.1;
    
    // Base color by biome
    let color;
    switch(biome) {
      case 'WATER': 
        return new THREE.Color(0.16 + variation/3, 0.35 + variation/2, 0.6 + variation/3);
      case 'BEACH': 
        return new THREE.Color(0.86 + variation, 0.8 + variation, 0.5 + variation);
      case 'SNOW': 
        return new THREE.Color(0.9 + variation/5, 0.9 + variation/5, 0.93 + variation/5);
      case 'DESERT': 
        return new THREE.Color(0.85 + variation, 0.7 + variation, 0.45 + variation);
      case 'RED_ROCK': 
        return new THREE.Color(0.65 + variation, 0.3 + variation, 0.2 + variation);
      case 'MOUNTAINS': 
        return new THREE.Color(0.5 + variation, 0.5 + variation, 0.5 + variation);
      case 'DEEP_FOREST': 
        return new THREE.Color(0.1 + variation, 0.3 + variation, 0.15 + variation);
      case 'FOREST': 
        return new THREE.Color(0.15 + variation, 0.4 + variation, 0.15 + variation);
      case 'PLAINS': 
        return new THREE.Color(0.2 + variation, 0.5 + variation, 0.25 + variation);
      default: 
        return new THREE.Color(0.2 + variation, 0.5 + variation, 0.25 + variation);
    }
  },
  
  // Generate a chunk of hexagonal terrain
  generateChunk: function(chunkX, chunkZ) {
    const chunkGroup = new THREE.Group();
    const chunkSize = this.chunkSize;
    const hexSize = this.hexSize;
    const offsetX = chunkX * (chunkSize * this.hexWidth);
    const offsetZ = chunkZ * (chunkSize * this.verticalSpacing);
    
    // Determine LOD based on distance to player
    const chunkCenterX = offsetX + (chunkSize * this.hexWidth) / 2;
    const chunkCenterZ = offsetZ + (chunkSize * this.verticalSpacing) / 2;
    const distToPlayer = Math.sqrt(
      Math.pow(chunkCenterX - this.player.position.x, 2) +
      Math.pow(chunkCenterZ - this.player.position.z, 2)
    );
    
    // Higher LOD (more detail) for closer chunks
    let lodStep = 1; // Default for close chunks
    if (distToPlayer > 90) {
      lodStep = 2; // Medium distance
    } else if (distToPlayer > 180) {
      lodStep = 3; // Far distance
    }
    
    // Create hexes for this chunk with LOD
    for (let r = 0; r < chunkSize; r += lodStep) {
      const rOffset = Math.floor(r / 2); // Offset for even-r layout
      for (let q = -rOffset; q < chunkSize - rOffset; q += lodStep) {
        // Calculate world position
        const pos = this.hexToWorld(q, r);
        const worldX = pos.x + offsetX;
        const worldZ = pos.z + offsetZ;
        
        // For lower LOD, create larger hexes
        const scaledHexSize = hexSize * lodStep;
        
        // Get height for this hex
        const height = this.getHeightAt(worldX, worldZ);
        
        // Get biome and color
        const biome = this.getBiomeType(worldX, worldZ, height);
        const color = this.getBiomeColor(biome, worldX, worldZ, height);
        
        // Create hex prism geometry based on biome
        let hexGeometry;
        let hexMaterial;
        let hexHeight = Math.max(1, height); // Minimum height of 1 unit
        
        if (biome === 'WATER') {
          // Create water hex with flat surface at water level
          hexGeometry = new THREE.CylinderGeometry(
            scaledHexSize,
            scaledHexSize,
            1.5, // Fixed water height
            6,   // 6 sides for hexagon
            1,
            false
          );
          
          hexMaterial = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            roughness: 0.2,
            metalness: 0.6,
            flatShading: false
          });
          
          const waterMesh = new THREE.Mesh(hexGeometry, hexMaterial);
          
          // Position at water level
          waterMesh.position.set(worldX, this.data.waterLevel + 0.75, worldZ);
          waterMesh.rotateY(Math.PI / 6); // Align flat sides with grid
          
          chunkGroup.add(waterMesh);
          
          // Also create underwater terrain (slightly darker)
          const underwaterColor = color.clone().multiplyScalar(0.7);
          const terrainHeight = Math.abs(this.data.waterLevel - height);
          
          if (terrainHeight > 0.5) { // Only if significantly below water
            const terrainGeometry = new THREE.CylinderGeometry(
              scaledHexSize,
              scaledHexSize,
              terrainHeight,
              6,
              1,
              false
            );
            
            const terrainMaterial = new THREE.MeshStandardMaterial({
              color: underwaterColor,
              roughness: 0.9,
              metalness: 0.1,
              flatShading: true
            });
            
            const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
            terrainMesh.position.set(worldX, this.data.waterLevel - terrainHeight/2, worldZ);
            terrainMesh.rotateY(Math.PI / 6);
            
            chunkGroup.add(terrainMesh);
          }
          
          continue; // Skip regular hex creation
        }
        
        // Regular terrain hex
        hexGeometry = new THREE.CylinderGeometry(
          scaledHexSize,
          scaledHexSize,
          hexHeight,
          6, // 6 sides for hexagon
          1,
          false
        );
        
        hexMaterial = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.8,
          metalness: 0.2,
          flatShading: true
        });
        
        const hexMesh = new THREE.Mesh(hexGeometry, hexMaterial);
        
        // Position hex (bottom of cylinder at ground level, so offset by half height)
        hexMesh.position.set(worldX, height / 2, worldZ);
        hexMesh.rotateY(Math.PI / 6); // Align flat sides with grid
        
        chunkGroup.add(hexMesh);
      }
    }
    
    // Add chunk to scene
    this.el.object3D.add(chunkGroup);
    
    // Store in chunks map
    this.chunks.set(`${chunkX},${chunkZ}`, chunkGroup);
    
    // Emit custom event after chunk generation (for other systems)
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
    if (!this.player) return;
    
    // Calculate current chunk
    const playerPos = this.player.position;
    const chunkSize = this.chunkSize;
    const hexWidth = this.hexWidth;
    const vertSpacing = this.verticalSpacing;
    
    const chunkX = Math.floor(playerPos.x / (chunkSize * hexWidth));
    const chunkZ = Math.floor(playerPos.z / (chunkSize * vertSpacing));
    
    // Generate surrounding chunks if they don't exist
    const renderDistance = 2; // Chunks to generate in each direction
    for (let z = chunkZ - renderDistance; z <= chunkZ + renderDistance; z++) {
      for (let x = chunkX - renderDistance; x <= chunkX + renderDistance; x++) {
        const key = `${x},${z}`;
        if (!this.chunks.has(key)) {
          this.generateChunk(x, z);
        }
      }
    }
    
    // Remove far chunks
    for (const [key, chunk] of this.chunks.entries()) {
      const [x, z] = key.split(',').map(Number);
      if (Math.abs(x - chunkX) > renderDistance + 1 || Math.abs(z - chunkZ) > renderDistance + 1) {
        this.el.object3D.remove(chunk);
        
        // Dispose of geometries and materials to free memory
        chunk.traverse(object => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
        
        this.chunks.delete(key);
      }
    }
  },
  
  // Cleanup on removal
  remove: function() {
    // Remove all chunks and clean up
    for (const [key, chunk] of this.chunks.entries()) {
      this.el.object3D.remove(chunk);
      
      // Dispose of geometries and materials
      chunk.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }
    
    this.chunks.clear();
    this.heightCache.clear();
  }
});

// Make getTerrainHeight available globally if it's not already defined
if (typeof window.getTerrainHeight === 'undefined') {
  window.getTerrainHeight = function(x, z) {
    const terrainGen = document.querySelector('[hex-terrain-generator]');
    if (terrainGen && terrainGen.components['hex-terrain-generator']) {
      return terrainGen.components['hex-terrain-generator'].getHeightAt(x, z);
    }
    return 0; // Default height if no generator exists
  };
}
