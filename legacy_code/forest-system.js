// radial-forest-system.js - Completely redesigned forest system with persistent radial distribution
// Compatible with existing terrain-system.js

console.log("Initializing radial forest system module...");

AFRAME.registerComponent('forest-system', {
  schema: {
    maxTrees: { type: 'number', default: 512 },
    treeSize: { type: 'number', default: 18.0 },
    treeVariation: { type: 'number', default: 0.3 },
    innerRadius: { type: 'number', default: 300 },    // Min distance from player (no trees removed inside this)
    outerRadius: { type: 'number', default: 360 },   // Max visibility distance for trees
    forestSeed: { type: 'number', default: 99 },    // Base seed for forest generation
    cellSize: { type: 'number', default: 50 },       // Size of each forest cell
    treesPerCell: { type: 'number', default: 32 },   // Maximum trees per forest cell
    treeHeightOffset: { type: 'number', default: 0 }, // Vertical offset for tree placement
    updateInterval: { type: 'number', default: -1 }, // Update interval in ms
    debugMode: { type: 'boolean', default: false }
  },
  
  init: function() {
    console.log("Radial forest system: Initializing");
    
    // Tree pool
    this.trees = [];                  // All tree objects
    this.availableTrees = [];         // Indices of available trees
    this.activeTreesByCell = new Map(); // Maps cell IDs to sets of tree indices
    this.treePositions = new Map();   // Maps tree indices to their world positions
    
    // Cell tracking
    this.activeCells = new Set();     // Currently active cell IDs
    this.cellForestDensity = new Map(); // Maps cell IDs to their forest density
    
    // Timing and position tracking
    this.lastUpdateTime = 0;
    this.lastPosition = new THREE.Vector3();
    
    // Create tree materials
    this.trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    this.leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x2E8B57 });
    
    // Random number generator based on seed (for deterministic forest generation)
    this.rng = this.createSeededRandom(this.data.forestSeed);
    
    // Create the tree pool
    this.createTreePool();
    
    // Get player reference
    this.player = document.querySelector('#subject');
    if (!this.player) {
      console.error('Forest system: Subject entity not found');
      return;
    }
    
    // Initialize noise for forest distribution
    this.initializeNoise();
    
    // Wait for terrain to initialize
    setTimeout(() => {
      this.lastPosition.copy(this.player.object3D.position);
      this.updateForest();
    }, 2000);
    
    // Listen for terrain ready event
    document.addEventListener('terrainReady', () => {
      console.log("Forest system: Terrain ready, updating trees");
      this.updateForest();
    });
    
    console.log("Radial forest system: Initialization complete");
  },
  
  // Create a seeded random number generator for deterministic forest generation
  createSeededRandom: function(seed) {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  },
  
  // Create a deterministic random number generator for a specific cell
  cellRNG: function(cellX, cellZ) {
    const cellSeed = (cellX * 73856093) ^ (cellZ * 19349663) ^ this.data.forestSeed;
    return this.createSeededRandom(cellSeed);
  },
  
  createTreePool: function() {
    // Create the tree pool
    for (let i = 0; i < this.data.maxTrees; i++) {
      const tree = this.createTreeMesh(i);
      tree.visible = false;
      this.el.object3D.add(tree);
      this.trees.push(tree);
      this.availableTrees.push(i);
    }
    
    console.log(`Radial forest system: Created pool of ${this.data.maxTrees} trees`);
  },
  
  createTreeMesh: function(index) {
    // Create a tree mesh with trunk and foliage
    const treeGroup = new THREE.Group();
    
    // Use the tree index as part of the seed for variation
    const treeSeed = this.data.forestSeed + index;
    const treeRNG = this.createSeededRandom(treeSeed);
    
    // Create trunk (cylinder)
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 6);
    const trunk = new THREE.Mesh(trunkGeometry, this.trunkMaterial);
    trunk.position.y = 0.75;
    treeGroup.add(trunk);
    
    // Create foliage (cone)
    const foliageGeometry = new THREE.ConeGeometry(1.2, 3.0, 6);
    const foliage = new THREE.Mesh(foliageGeometry, this.leavesMaterial);
    foliage.position.y = 2.5;
    treeGroup.add(foliage);
    
    // Add a second foliage layer
    const foliage2Geometry = new THREE.ConeGeometry(1.0, 2.5, 6);
    const foliage2 = new THREE.Mesh(foliage2Geometry, this.leavesMaterial);
    foliage2.position.y = 1.8;
    treeGroup.add(foliage2);
    
    // Use deterministic random values for this tree
    const baseScale = this.data.treeSize;
    const widthVar = 0.8 + treeRNG() * 0.4;
    const heightVar = 0.9 + treeRNG() * 0.2;
    
    // Scale the tree with deterministic randomness
    treeGroup.scale.set(
      baseScale * widthVar,
      baseScale * heightVar,
      baseScale * widthVar
    );
    
    // Deterministic rotation
    treeGroup.rotation.y = treeRNG() * Math.PI * 2;
    
    // Add metadata to tree
    treeGroup.userData = {
      index: index,
      cellId: null
    };
    
    return treeGroup;
  },
  
  initializeNoise: function() {
    // Use the existing ImprovedNoise from terrain system if available
    this.noise = {
      seed: (seed) => {
        if (window.ImprovedNoise && window.ImprovedNoise.seed) {
          window.ImprovedNoise.seed(seed);
        }
      },
      perlin2: (x, z) => {
        if (window.ImprovedNoise && window.ImprovedNoise.perlin2) {
          return window.ImprovedNoise.perlin2(x, z);
        } else {
          // Simple fallback
          return (Math.sin(x * 0.1) + Math.sin(z * 0.1)) * 0.5;
        }
      }
    };
    
    // Seed the noise generator
    this.noise.seed(this.data.forestSeed);
  },
  
  tick: function(time) {
    // Only update at specified intervals
    if (time - this.lastUpdateTime < this.data.updateInterval) return;
    this.lastUpdateTime = time;
    
    // Skip if player not found
    if (!this.player) return;
    
    // Check if player has moved
    const playerPos = this.player.object3D.position;
    const movedDistance = this.lastPosition.distanceTo(playerPos);
    
    // Update forest if player moved enough or we have no active trees
    if (movedDistance > this.data.cellSize * 0.2 || this.activeCells.size === 0) {
      this.updateForest();
    }
  },
  
  updateForest: function() {
    if (!this.player) return;
    
    const playerPos = this.player.object3D.position;
    
    // Store current position for next update
    this.lastPosition.copy(playerPos);
    
    // Calculate which cells should be active based on player position
    const newActiveCells = this.getCellsInRadius(
      playerPos.x, playerPos.z, 
      this.data.outerRadius, 
      this.data.cellSize
    );
    
    // Calculate protected cells (inner radius where trees are never removed)
    const protectedCells = this.getCellsInRadius(
      playerPos.x, playerPos.z,
      this.data.innerRadius,
      this.data.cellSize
    );
    
    if (this.data.debugMode) {
      console.log(`Forest system: Active cells: ${newActiveCells.size}, Protected cells: ${protectedCells.size}`);
    }
    
    // Find cells to add (in new set but not in current active set)
    const cellsToAdd = new Set();
    for (const cellId of newActiveCells) {
      if (!this.activeCells.has(cellId)) {
        cellsToAdd.add(cellId);
      }
    }
    
    // Find cells to remove (in current active set but not in new set and not protected)
    const cellsToRemove = new Set();
    for (const cellId of this.activeCells) {
      if (!newActiveCells.has(cellId) && !protectedCells.has(cellId)) {
        cellsToRemove.add(cellId);
      }
    }
    
    if (this.data.debugMode) {
      console.log(`Forest system: Adding ${cellsToAdd.size} cells, removing ${cellsToRemove.size} cells`);
    }
    
    // Process cells to remove first to free up trees
    for (const cellId of cellsToRemove) {
      this.removeTreesInCell(cellId);
    }
    
    // Process cells to add
    for (const cellId of cellsToAdd) {
      this.populateCell(cellId);
    }
    
    // Update the active cells set
    this.activeCells = new Set([...newActiveCells]);
    
    if (this.data.debugMode) {
      const activeTreeCount = this.countActiveTrees();
      console.log(`Forest system: Update complete. Active trees: ${activeTreeCount}, Available: ${this.availableTrees.length}`);
    }
  },
  
  countActiveTrees: function() {
    let count = 0;
    for (const treeSet of this.activeTreesByCell.values()) {
      count += treeSet.size;
    }
    return count;
  },
  
  getCellsInRadius: function(centerX, centerZ, radius, cellSize) {
    const cells = new Set();
    const cellRadius = Math.ceil(radius / cellSize);
    
    // Get cell coordinates for center point
    const centerCellX = Math.floor(centerX / cellSize);
    const centerCellZ = Math.floor(centerZ / cellSize);
    
    // Create a radial pattern of cells
    for (let x = -cellRadius; x <= cellRadius; x++) {
      for (let z = -cellRadius; z <= cellRadius; z++) {
        // Calculate the cell center position
        const cellX = (centerCellX + x) * cellSize + cellSize / 2;
        const cellZ = (centerCellZ + z) * cellSize + cellSize / 2;
        
        // Calculate distance from player to cell center
        const dx = cellX - centerX;
        const dz = cellZ - centerZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Only include cells within the radius
        if (distance <= radius) {
          const cellId = `${centerCellX + x},${centerCellZ + z}`;
          cells.add(cellId);
        }
      }
    }
    
    return cells;
  },
  
  removeTreesInCell: function(cellId) {
    // Get the trees in this cell
    const treesInCell = this.activeTreesByCell.get(cellId);
    if (!treesInCell) return;
    
    // Return all trees in this cell to the available pool
    for (const treeIndex of treesInCell) {
      const tree = this.trees[treeIndex];
      tree.visible = false;
      tree.userData.cellId = null;
      this.availableTrees.push(treeIndex);
      this.treePositions.delete(treeIndex);
    }
    
    // Remove cell from tracking
    this.activeTreesByCell.delete(cellId);
    this.activeCells.delete(cellId);
  },
  
  populateCell: function(cellId) {
    // Parse cell coordinates
    const [cellXStr, cellZStr] = cellId.split(',');
    const cellX = parseInt(cellXStr);
    const cellZ = parseInt(cellZStr);
    
    // Calculate world coordinates of cell corners
    const worldX = cellX * this.data.cellSize;
    const worldZ = cellZ * this.data.cellSize;
    
    // Determine forest density for this cell (0-1)
    let cellDensity;
    if (this.cellForestDensity.has(cellId)) {
      // Use cached density for consistent results
      cellDensity = this.cellForestDensity.get(cellId);
    } else {
      // Calculate forest density based on cell center and noise
      const cellCenterX = worldX + this.data.cellSize / 2;
      const cellCenterZ = worldZ + this.data.cellSize / 2;
      
      // Use multiple noise scales for natural-looking forest boundaries
      const largeScale = 0.003;
      const mediumScale = 0.01;
      
      const largeNoise = (this.noise.perlin2(cellCenterX * largeScale, cellCenterZ * largeScale) + 1) * 0.5;
      const mediumNoise = (this.noise.perlin2(cellCenterX * mediumScale, cellCenterZ * mediumScale) + 1) * 0.5;
      
      // Combine noise values (weighted more toward large-scale features)
      cellDensity = largeNoise * 0.7 + mediumNoise * 0.3;
      
      // Apply threshold to create distinct forested and non-forested areas
      cellDensity = cellDensity > 0.4 ? cellDensity : 0;
      
      // Cache the result
      this.cellForestDensity.set(cellId, cellDensity);
    }
    
    // If cell has no trees, mark as empty but still active
    if (cellDensity <= 0.1) {
      this.activeTreesByCell.set(cellId, new Set());
      this.activeCells.add(cellId);
      return;
    }
    
    // Get cell-specific RNG for deterministic placement
    const cellRandom = this.cellRNG(cellX, cellZ);
    
    // Determine number of trees based on density
    const maxTreesInCell = Math.floor(this.data.treesPerCell * cellDensity);
    
    // Create set to track trees in this cell
    const treesInCell = new Set();
    this.activeTreesByCell.set(cellId, treesInCell);
    
    // Generate deterministic tree positions for this cell
    const treePositions = [];
    for (let i = 0; i < maxTreesInCell * 2; i++) {
      // Cell-specific random positions with Poisson-like distribution
      // Using rejection sampling for more natural distribution
      let validPosition = false;
      let attempts = 0;
      let x, z;
      
      while (!validPosition && attempts < 5) {
        x = worldX + cellRandom() * this.data.cellSize;
        z = worldZ + cellRandom() * this.data.cellSize;
        
        // Check minimum distance from other tree positions
        validPosition = true;
        for (const pos of treePositions) {
          const dx = x - pos.x;
          const dz = z - pos.z;
          const distSquared = dx * dx + dz * dz;
          
          // Minimum distance between trees
          if (distSquared < 8 * 8) {
            validPosition = false;
            break;
          }
        }
        
        attempts++;
      }
      
      if (validPosition) {
        // Get terrain height at position
        const y = this.getTerrainHeightAt(x, z);
        
        // Check if this is a valid location for a tree
        if (this.isValidTreeLocation(x, z, y)) {
          treePositions.push({x, y, z});
          
          // Stop if we've found enough positions
          if (treePositions.length >= maxTreesInCell) {
            break;
          }
        }
      }
    }
    
    // Place trees at the determined positions
    for (const pos of treePositions) {
      // Check if we have available trees
      if (this.availableTrees.length === 0) {
        if (this.data.debugMode) {
          console.warn("Forest system: Out of available trees, stopping cell population");
        }
        break;
      }
      
      // Get a tree from the pool
      const treeIndex = this.availableTrees.pop();
      const tree = this.trees[treeIndex];
      
      // Position and show the tree
      tree.position.set(pos.x, pos.y + this.data.treeHeightOffset, pos.z);
      tree.visible = true;
      tree.userData.cellId = cellId;
      
      // Track the tree
      treesInCell.add(treeIndex);
      this.treePositions.set(treeIndex, new THREE.Vector3(pos.x, pos.y, pos.z));
    }
    
    // Mark cell as active
    this.activeCells.add(cellId);
  },
  
  getTerrainHeightAt: function(x, z) {
    // Lazy load terrain generator reference
    if (!this.terrainGenerator) {
      try {
        const scene = document.querySelector('a-scene');
        if (scene && scene.hasAttribute('terrain-manager')) {
          const terrainManager = scene.components['terrain-manager'];
          if (terrainManager && terrainManager.chunkManager && terrainManager.chunkManager.terrainGenerator) {
            this.terrainGenerator = terrainManager.chunkManager.terrainGenerator;
            
            if (this.data.debugMode) {
              const testHeight = this.terrainGenerator.generateTerrainHeight(0, 0);
              console.log('Forest system: Test terrain height at origin:', testHeight);
            }
          }
        }
      } catch (err) {
        console.error('Forest system: Error accessing terrain generator:', err);
        return 0;
      }
    }
    
    // Generate terrain height
    try {
      if (this.terrainGenerator) {
        return this.terrainGenerator.generateTerrainHeight(x, z);
      }
      return 0;
    } catch (error) {
      if (this.data.debugMode) {
        console.warn("Forest system: Error getting terrain height:", error);
      }
      return 0;
    }
  },
  
  isValidTreeLocation: function(x, z, height) {
    if (!window.TerrainConfig) return true;
    
    // Skip if no height data
    if (height === undefined) {
      return false;
    }
    
    // Normalize height for biome checks
    const baseHeight = window.TerrainConfig.baseHeight || 0;
    const heightScale = window.TerrainConfig.heightScale || 100;
    const normalizedHeight = (height - baseHeight) / heightScale;
    
    // Trees don't grow underwater
    if (normalizedHeight < 0.2) {
      return false;
    }
    
    // Trees don't grow in snow
    if (normalizedHeight > 0.8) {
      return false;
    }
    
    // Check terrain slope
    try {
      const checkDist = 3;
      const heightNorth = this.getTerrainHeightAt(x, z - checkDist);
      const heightEast = this.getTerrainHeightAt(x + checkDist, z);
      
      // Calculate slope
      const slopeNorth = Math.abs(height - heightNorth) / checkDist;
      const slopeEast = Math.abs(height - heightEast) / checkDist;
      const maxSlope = Math.max(slopeNorth, slopeEast);
      
      // Trees don't grow on steep slopes
      if (maxSlope > 1.0) {
        return false;
      }
    } catch(e) {
      // Continue even if slope check fails
    }
    
    return true;
  }
});

console.log("Radial forest system loaded");