
AFRAME.registerComponent('tree-manager', {
  schema: {
    maxTrees: { type: 'number', default: 128 },     // Maximum active trees
    poolSize: { type: 'number', default: 128 },     // Total tree pool size
    radius: { type: 'number', default: 1200 },       // Placement radius
    noiseThreshold: { type: 'number', default: 0.2 }, // Noise threshold for tree placement
    noiseScale: { type: 'number', default: 1.0 },  // Perlin noise scale
    treeHeight: { type: 'number', default: 64 },      // Height offset from terrain
    treeScale: { type: 'number', default: 8 }       // Tree size multiplier
  },
  
  init: function () {
    //console.log("Tree manager initializing with new Perlin noise placement...");
    this.pool = [];
    this.lastSampledPosition = { x: 0, z: 0 };
    this.needsResampling = true;
    
    // Create tree pool
    for (let i = 0; i < this.data.poolSize; i++) {
      let tree = document.createElement('a-entity');
      
      const trunk = document.createElement('a-cylinder');
      trunk.setAttribute('height', '6');
      trunk.setAttribute('radius', '0.8');
      trunk.setAttribute('material', { color: '#8B4513', roughness: 0.8 });
      trunk.setAttribute('position', { x: 0, y: 3, z: 0 });
      
      const foliage = document.createElement('a-cone');
      foliage.setAttribute('height', '18');
      foliage.setAttribute('radius-bottom', '8');
      foliage.setAttribute('radius-top', '0');
      foliage.setAttribute('material', { color: '#2E8B57', emissive: '#003300', emissiveIntensity: 0.2 });
      foliage.setAttribute('position', { x: 0, y: 15, z: 0 });
      
      tree.appendChild(trunk);
      tree.appendChild(foliage);
      
      tree.setAttribute('scale', `${this.data.treeScale} ${this.data.treeScale} ${this.data.treeScale}`);
      tree.setAttribute('visible', false);
      tree.setAttribute('position', { x: 0, y: -999, z: 0 });
      this.el.sceneEl.appendChild(tree);
      this.pool.push({ entity: tree, active: false, worldPos: { x: 0, z: 0 } });
    }
    
    this.terrainGenerator = null;
    this.setupTerrainAccess();
    
    document.addEventListener('terrainReady', () => {
      this.setupTerrainAccess();
    });
    
    this.debugTimestamp = 0;
    this.activeTreeCount = 0;
    
    // Initialize perlin noise
    this.noise = {
      seed: 99,
      lerp: function(a, b, t) { return a + t * (b - a); },
      grad: function(hash, x, y) {
        const h = hash & 15;
        const grad_x = 1 + (h & 7);
        const grad_y = grad_x & 1 ? 1 : -1;
        return grad_x * x + grad_y * y;
      },
      fade: function(t) { return t * t * t * (t * (t * 6 - 15) + 10); },
      p: new Array(512)
    };
    
    // Initialize permutation table
    const permutation = [];
    for (let i = 0; i < 256; i++) permutation[i] = i;
    
    // Shuffle permutation
    for (let i = 255; i > 0; i--) {
      const j = Math.floor((i + 1) * Math.random());
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    
    // Extend with duplicates
    for (let i = 0; i < 512; i++) {
      this.noise.p[i] = permutation[i & 255];
    }
  },
  
  perlin2D: function(x, y) {
    // Get grid cell coordinates
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    // Get relative position in cell
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    // Compute fade curves
    const u = this.noise.fade(x);
    const v = this.noise.fade(y);
    
    // Get hash values for corners
    const A = this.noise.p[X] + Y;
    const B = this.noise.p[X + 1] + Y;
    
    // Blend gradients
    return this.noise.lerp(
      this.noise.lerp(
        this.noise.grad(this.noise.p[A], x, y),
        this.noise.grad(this.noise.p[B], x - 1, y),
        u
      ),
      this.noise.lerp(
        this.noise.grad(this.noise.p[A + 1], x, y - 1),
        this.noise.grad(this.noise.p[B + 1], x - 1, y - 1),
        u
      ),
      v
    ) * 0.5 + 0.5; // Transform from -1..1 to 0..1
  },
  
  setupTerrainAccess: function() {
    try {
      const scene = document.querySelector('a-scene');
      if (!scene) return;
      
      if (scene.hasAttribute('terrain-manager')) {
        const terrainManager = scene.components['terrain-manager'];
        if (terrainManager && terrainManager.chunkManager && terrainManager.chunkManager.terrainGenerator) {
          this.terrainGenerator = terrainManager.chunkManager.terrainGenerator;
          //console.log('Tree manager: Successfully obtained terrain generator');
          this.needsResampling = true;
        }
      }
    } catch (err) {
      //console.error('Tree manager: Error setting up terrain access:', err);
    }
  },
  
  getTerrainHeight: function(x, z) {
    if (this.terrainGenerator) {
      try {
        return this.terrainGenerator.generateTerrainHeight(x, z);
      } catch (err) {
        return 0;
      }
    }
    
    if (typeof window.getTerrainHeight === 'function') {
      return window.getTerrainHeight(x, z);
    }
    
    return 0;
  },
  
  getGridPosition: function(x, z) {
    // Get grid step from config or fall back to default
    const gridStep = window.TerrainConfig ? window.TerrainConfig.geometrySize : 4.4;
    
    // Snap to grid
    return {
      x: Math.round(x / gridStep) * gridStep,
      z: Math.round(z / gridStep) * gridStep
    };
  },
  
  checkNeedsResampling: function(subjectPos) {
    // Calculate distance from last sampled position
    const dx = subjectPos.x - this.lastSampledPosition.x;
    const dz = subjectPos.z - this.lastSampledPosition.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // Resample when moved 5% of radius distance.
    return distance > (this.data.radius * 0.01);
  },
  
  tick: function () {
    const subject = document.querySelector('#subject');
    if (!subject || !this.terrainGenerator) return;
    
    const subjectPos = subject.object3D.position;
    const halfRadius = this.data.radius * 0.5;
    
    // Log status every 5 seconds
    const now = Date.now();
    if (now - this.debugTimestamp > 5000) {
      //console.log(`Tree manager: ${this.activeTreeCount} active trees, position: ${JSON.stringify({x: subjectPos.x.toFixed(0), z: subjectPos.z.toFixed(0)})}`);
      this.debugTimestamp = now;
    }

    // Check if we need to resample tree positions
    if (this.needsResampling || this.checkNeedsResampling(subjectPos)) {
      //console.log("Tree manager: Resampling trees with Perlin noise");
      this.sampleTreePositions(subjectPos);
      this.lastSampledPosition = { x: subjectPos.x, z: subjectPos.z };
      this.needsResampling = false;
    }
    
    // Update active tree visibility and deactivate distant trees
    this.pool.forEach(treeObj => {
      if (treeObj.active) {
        const dx = treeObj.worldPos.x - subjectPos.x;
        const dz = treeObj.worldPos.z - subjectPos.z;
        const distanceSq = dx * dx + dz * dz;
        
        // Deactivate if beyond half radius
        if (distanceSq > halfRadius * halfRadius) {
          treeObj.entity.setAttribute('visible', false);
          treeObj.entity.setAttribute('position', { x: 0, y: -999, z: 0 });
          treeObj.active = false;
          this.activeTreeCount--;
        }
      }
    });
  },
  
  sampleTreePositions: function(subjectPos) {
    // Reset tree count
    this.activeTreeCount = 0;
    
    // Inactivate all existing trees
    this.pool.forEach(treeObj => {
      if (treeObj.active) {
        treeObj.entity.setAttribute('visible', false);
        treeObj.entity.setAttribute('position', { x: 0, y: -999, z: 0 });
        treeObj.active = false;
      }
    });
    
    // Use terrain config grid size
    const gridStep = window.TerrainConfig ? window.TerrainConfig.geometrySize : 4.4;
    const radius = this.data.radius;
    const noiseScale = this.data.noiseScale;
    const maxTrees = this.data.maxTrees;
    
    // Sample positions over the circular area
    const positions = [];
    
    // Calculate grid boundaries
    const minX = Math.floor((subjectPos.x - radius) / gridStep) * gridStep;
    const maxX = Math.floor((subjectPos.x + radius) / gridStep) * gridStep;
    const minZ = Math.floor((subjectPos.z - radius) / gridStep) * gridStep;
    const maxZ = Math.floor((subjectPos.z + radius) / gridStep) * gridStep;
    
    // Sample grid positions
    for (let x = minX; x <= maxX; x += gridStep) {
      for (let z = minZ; z <= maxZ; z += gridStep) {
        // Check if within radius
        const dx = x - subjectPos.x;
        const dz = z - subjectPos.z;
        const distSq = dx * dx + dz * dz;
        
        if (distSq <= radius * radius) {
          // Sample perlin noise
          const noiseValue = this.perlin2D(x * noiseScale, z * noiseScale);
          
          if (noiseValue < this.data.noiseThreshold) {
            positions.push({ x, z, noise: noiseValue });
          }
        }
      }
    }
    
    // Sort positions by noise value (lower = more likely to place tree)
    positions.sort((a, b) => a.noise - b.noise);
    
    // Limit to maxTrees
    const selectedPositions = positions.slice(0, maxTrees);
    
    // Place trees at these positions
    for (const pos of selectedPositions) {
      if (this.activeTreeCount >= maxTrees) break;
      
      // Find inactive tree in pool
      const treeObj = this.pool.find(t => !t.active);
      if (!treeObj) continue;
      
      // Get terrain height
      const terrainHeight = this.getTerrainHeight(pos.x, pos.z);
      
      // Randomize rotation and scale
      const randomRotation = 0.0;//Math.random() * 360;
      const randomScale = 1.0;//0.8 + Math.random() * 0.4;
      
      // Position tree
      treeObj.entity.setAttribute('position', { 
        x: pos.x, 
        y: terrainHeight + (this.data.treeHeight * 0.1), 
        z: pos.z 
      });
      
      // Set rotation and scale
      //treeObj.entity.setAttribute('rotation', { x: 0, y: randomRotation, z: 0 });
      treeObj.entity.setAttribute('scale', {
        x: this.data.treeScale * randomScale,
        y: this.data.treeScale * randomScale,
        z: this.data.treeScale * randomScale
      });
      
      // Activate.
      treeObj.entity.setAttribute('visible', true);
      treeObj.active = true;
      treeObj.worldPos = { x: pos.x, z: pos.z };
      this.activeTreeCount++;
    }
    
    //console.log(`Tree manager: Placed ${this.activeTreeCount} trees out of ${positions.length} candidate positions`);
  }
});