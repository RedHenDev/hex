// forest-system.js - Add procedural forests to hexagon terrain
// Performance-optimized forest generation using instanced meshes

document.addEventListener('DOMContentLoaded', () => {
  // Register the forest system component when DOM is loaded
  AFRAME.registerComponent('forest-system', {
    schema: {
      enabled: { default: true },
      density: { default: 0.1 }, // default 0.4 Tree density factor (0-1)
      maxTrees: { default: 4000 }, // default 40k Maximum number of trees to render
      treeDistance: { default: 650 }, // Maximum distance to render trees
      updateInterval: { default: 1000 }, // How often to update forests (ms)
      debugMode: { default: false } // Enable debugging visuals
    },

    init: function() {
      console.log("Forest system initializing...");
      
      // Keep track of tree instances
      this.treeInstances = {};
      this.treeMeshes = {};
      this.treeTypes = ['pine', 'oak', 'birch'];
      this.forestChunks = new Map(); // Track which chunks have forests
      this.forestsCreated = false;
      this.lastUpdateTime = 0;
      
      // Wait for terrain to be ready
      this.attachToTerrain();
      
      // Create tree geometries and materials
      this.createTreeAssets();
      
      // Listen for terrain updates
      document.addEventListener('terrainReady', () => {
        console.log("Terrain ready, initializing forests");
        this.attachToTerrain();
        
        // Create forests after a short delay to ensure terrain is loaded
        setTimeout(() => {
          if (!this.forestsCreated) {
            this.createInitialForests();
          }
        }, 2000);
      });
      
      // Add event listener for chunk creation
      document.addEventListener('chunkCreated', (e) => {
        if (e.detail && e.detail.chunkKey) {
          this.addForestsToChunk(e.detail.chunkKey, e.detail.chunkX, e.detail.chunkZ);
        }
      });
    },
    
    attachToTerrain: function() {
      // Find terrain manager
      const scene = this.el.sceneEl;
      if (!scene) return;
      
      // Try to get terrain manager from scene component
      if (scene.hasAttribute('terrain-manager')) {
        this.terrainManager = scene.components['terrain-manager'];
        
        if (this.terrainManager && this.terrainManager.chunkManager && 
            this.terrainManager.chunkManager.terrainGenerator) {
          console.log("Forest system connected to terrain manager");
          this.terrainGenerator = this.terrainManager.chunkManager.terrainGenerator;
          return;
        }
      }
      
      // Alternatively, look for a child element with terrain-manager
      const terrainManagerEl = scene.querySelector('[terrain-manager]');
      if (!terrainManagerEl) return;
      
      const terrainManager = terrainManagerEl.components['terrain-manager'];
      if (!terrainManager || !terrainManager.chunkManager || 
          !terrainManager.chunkManager.terrainGenerator) return;
      
      this.terrainManager = terrainManager;
      this.terrainGenerator = terrainManager.chunkManager.terrainGenerator;
      console.log("Forest system connected to terrain manager");
    },
    
    createTreeAssets: function() {
      // Create materials for different tree types
      this.materials = {
        trunk: new THREE.MeshStandardMaterial({
          color: 0x8B4513,
          roughness: 0.9,
          metalness: 0.1
        }),
        pineFoliage: new THREE.MeshStandardMaterial({
          color: 0x2E5E3F,
          roughness: 0.8,
          metalness: 0.1
        }),
        oakFoliage: new THREE.MeshStandardMaterial({
          color: 0x3A7D44,
          roughness: 0.8,
          metalness: 0.1
        }),
        birchFoliage: new THREE.MeshStandardMaterial({
          color: 0x81B622,
          roughness: 0.7,
          metalness: 0.1
        }),
        birchTrunk: new THREE.MeshStandardMaterial({
          color: 0xD3D3CB,
          roughness: 0.7,
          metalness: 0.1
        })
      };
      
      // Create tree geometries - simplified for performance
      this.createPineTreeGeometry();
      this.createOakTreeGeometry();
      this.createBirchTreeGeometry();
      
      // Create the instanced meshes
      this.createInstancedMeshes();
    },
    
    createPineTreeGeometry: function() {
      // Create the cone (tree top)
      const pineTop = new THREE.ConeGeometry(5, 20, 8);
      pineTop.translate(0, 14, 0);
      
      // Create the trunk (cylinder)
      const pineTrunk = new THREE.CylinderGeometry(1, 1.5, 8, 8);
      pineTrunk.translate(0, 4, 0);
      
      // Create a second, smaller cone on top
      const pineTopUpper = new THREE.ConeGeometry(3, 12, 8);
      pineTopUpper.translate(0, 25, 0);
      
      // Combine geometries
      this.pineGeometry = BufferGeometryUtils.mergeBufferGeometries([
        pineTrunk.toNonIndexed(),
        pineTop.toNonIndexed(),
        pineTopUpper.toNonIndexed()
      ]);
      
      // Create a group to hold the materials
      const positions = this.pineGeometry.getAttribute('position');
      const colors = new Float32Array(positions.count * 3);
      
      // Set colors for each vertex - trunk vs foliage
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        
        // Trunk color
        if (y < 8) {
          colors[i * 3] = 0.545; // r
          colors[i * 3 + 1] = 0.271; // g
          colors[i * 3 + 2] = 0.075; // b
        } 
        // Foliage color
        else {
          colors[i * 3] = 0.18; // r
          colors[i * 3 + 1] = 0.37; // g
          colors[i * 3 + 2] = 0.25; // b
        }
      }
      
      this.pineGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    },
    
    createOakTreeGeometry: function() {
      // Create a more rounded, broader tree top for oak
      const oakTop = new THREE.SphereGeometry(8, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      oakTop.translate(0, 14, 0);
      oakTop.scale(1.3, 1.0, 1.3);
      
      // Create the trunk
      const oakTrunk = new THREE.CylinderGeometry(1.8, 2.2, 12, 8);
      oakTrunk.translate(0, 6, 0);
      
      // Combine geometries
      this.oakGeometry = BufferGeometryUtils.mergeBufferGeometries([
        oakTrunk.toNonIndexed(),
        oakTop.toNonIndexed()
      ]);
      
      // Create colors for each vertex
      const positions = this.oakGeometry.getAttribute('position');
      const colors = new Float32Array(positions.count * 3);
      
      // Set colors for each vertex - trunk vs foliage
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        
        // Trunk color
        if (y < 12) {
          colors[i * 3] = 0.545; // r
          colors[i * 3 + 1] = 0.271; // g
          colors[i * 3 + 2] = 0.075; // b
        } 
        // Foliage color
        else {
          colors[i * 3] = 0.23; // r
          colors[i * 3 + 1] = 0.49; // g
          colors[i * 3 + 2] = 0.27; // b
        }
      }
      
      this.oakGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    },
    
    createBirchTreeGeometry: function() {
      // Create an even more rounded top
      const birchTop = new THREE.SphereGeometry(6, 8, 6);
      birchTop.translate(0, 18, 0);
      birchTop.scale(1.1, 1.2, 1.1);
      
      // Create a thinner trunk
      const birchTrunk = new THREE.CylinderGeometry(0.9, 1.3, 14, 8);
      birchTrunk.translate(0, 7, 0);
      
      // Combine geometries
      this.birchGeometry = BufferGeometryUtils.mergeBufferGeometries([
        birchTrunk.toNonIndexed(),
        birchTop.toNonIndexed()
      ]);
      
      // Create colors for each vertex
      const positions = this.birchGeometry.getAttribute('position');
      const colors = new Float32Array(positions.count * 3);
      
      // Set colors for each vertex - trunk vs foliage
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        
        // Trunk color (white/gray for birch)
        if (y < 14) {
          colors[i * 3] = 0.827; // r
          colors[i * 3 + 1] = 0.827; // g
          colors[i * 3 + 2] = 0.796; // b
        } 
        // Foliage color (lighter green)
        else {
          colors[i * 3] = 0.505; // r
          colors[i * 3 + 1] = 0.714; // g
          colors[i * 3 + 2] = 0.133; // b
        }
      }
      
      this.birchGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    },
    
    createInstancedMeshes: function() {
      // Create a basic material that uses vertex colors
      const treeMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.8,
        metalness: 0.1
      });
      
      // Create instanced meshes for each tree type - starting with high counts
      // (We'll only use what we need)
      const maxCount = Math.ceil(this.data.maxTrees / 3);
      
      // Create instanced meshes
      this.treeMeshes = {
        pine: new THREE.InstancedMesh(this.pineGeometry, treeMaterial.clone(), maxCount),
        oak: new THREE.InstancedMesh(this.oakGeometry, treeMaterial.clone(), maxCount),
        birch: new THREE.InstancedMesh(this.birchGeometry, treeMaterial.clone(), maxCount)
      };
      
      // Force each mesh to create its default attributes
      for (const type of this.treeTypes) {
        // Make sure instance matrices are properly initialized
        this.treeMeshes[type].count = maxCount;
        
        // Initialize all matrices as invisible (scaled to 0)
        const matrix = new THREE.Matrix4();
        matrix.makeScale(0, 0, 0); // Initially invisible
        
        for (let i = 0; i < maxCount; i++) {
          this.treeMeshes[type].setMatrixAt(i, matrix);
        }
        
        this.treeMeshes[type].instanceMatrix.needsUpdate = true;
      }
      
      // Initialize with zero trees visible
      this.treeInstances = {
        pine: 0,
        oak: 0,
        birch: 0
      };
      
      // Add meshes to scene
      const scene = document.querySelector('a-scene').object3D;
      for (const type of this.treeTypes) {
        this.treeMeshes[type].frustumCulled = false; // DISABLE frustum culling - fixes disappearing trees
        this.treeMeshes[type].castShadow = true;
        this.treeMeshes[type].receiveShadow = false;
        scene.add(this.treeMeshes[type]);
      }
    },
    
    createInitialForests: function() {
      if (!this.terrainManager || !this.terrainGenerator) {
        console.warn("Cannot create forests: terrain manager not available");
        return;
      }
      
      console.log("Creating initial forests...");
      
      // Get the center position from the camera/player
      const subject = document.querySelector('#subject');
      if (!subject) return;
      
      const position = subject.object3D.position;
      const centerX = position.x;
      const centerZ = position.z;
      
      // Iterate through existing chunks and add forests
      if (this.terrainManager.chunkManager && this.terrainManager.chunkManager.loadedChunks) {
        const loadedChunks = this.terrainManager.chunkManager.loadedChunks;
        
        console.log(`Adding forests to ${loadedChunks.size} existing chunks`);
        
        // Process chunks from closest to farthest for better perceived performance
        const chunkEntries = Array.from(loadedChunks.entries());
        
        // Sort chunks by distance from player
        chunkEntries.sort((a, b) => {
          const [keyA, infoA] = a;
          const [keyB, infoB] = b;
          
          const [xA, zA] = keyA.split(',').map(Number);
          const [xB, zB] = keyB.split(',').map(Number);
          
          const distA = Math.sqrt(Math.pow(xA - centerX, 2) + Math.pow(zA - centerZ, 2));
          const distB = Math.sqrt(Math.pow(xB - centerX, 2) + Math.pow(zB - centerZ, 2));
          
          return distA - distB;
        });
        
        // Add forests to chunks, starting from the closest ones
        for (const [key, chunkInfo] of chunkEntries) {
          const [chunkX, chunkZ] = key.split(',').map(Number);
          this.addForestsToChunk(key, chunkX, chunkZ);
        }
        
        this.forestsCreated = true;
      }
    },
    
    addForestsToChunk: function(chunkKey, chunkX, chunkZ) {
      // Skip if we've already processed this chunk or if components aren't ready
      if (this.forestChunks.has(chunkKey) || !this.terrainGenerator) return;
      
      // Mark this chunk as processed
      this.forestChunks.set(chunkKey, true);
      
      // Check if we're within a reasonable distance before adding trees
      // This prevents creating trees that are extremely far away
      const subject = document.querySelector('#subject');
      if (subject) {
        const position = subject.object3D.position;
        const chunkWorldSize = this.terrainManager.data.chunkSize * this.terrainManager.data.cubeSize;
        const chunkCenterX = chunkX + (chunkWorldSize / 2);
        const chunkCenterZ = chunkZ + (chunkWorldSize / 2);
        
        const distToChunk = Math.sqrt(
          Math.pow(position.x - chunkCenterX, 2) + 
          Math.pow(position.z - chunkCenterZ, 2)
        );
        
        // Skip far chunks, but track them as processed
        if (distToChunk > this.data.treeDistance) {
          return;
        }
      }
      
      // Get configuration from terrain manager
      const chunkSize = this.terrainManager.data.chunkSize;
      const cubeSize = this.terrainManager.data.cubeSize;
      
      // Seed for this chunk's forest distribution
      const chunkSeed = (chunkX * 12345 + chunkZ * 54321) ^ this.terrainGenerator.seed;
      const noiseScale = 0.03; // Scale for distribution noise
      
      // Create a small random generator for this chunk
      const rand = this.createRandomGenerator(chunkSeed);
      
      // Determine tree density for this chunk based on terrain type
      const chunkCenterX = chunkX + (chunkSize * cubeSize / 2);
      const chunkCenterZ = chunkZ + (chunkSize * cubeSize / 2);
      const centerHeight = this.terrainGenerator.generateTerrainHeight(chunkCenterX, chunkCenterZ);
      const normalizedHeight = this.normalizeHeight(centerHeight);
      
      // Skip forest generation for water or high mountain chunks
      if (normalizedHeight < 0.3 || normalizedHeight > 0.85) return;
      
      // Adjust density based on terrain type
      let density = this.data.density;
      
      // Forests are densest in the "forest" height range
      if (normalizedHeight > 0.5 && normalizedHeight < 0.7) {
        density *= 1.5; // Denser forests on hills
      } else if (normalizedHeight > 0.7) {
        density *= 0.3; // Sparse trees on lower mountain areas
      }
      
      // Calculate how many trees to attempt placing
      const maxTreesPerChunk = Math.floor(chunkSize * chunkSize * density * 0.7);
      let treesPlaced = 0;
      
      // Temporary matrix for tree transformations
      const matrix = new THREE.Matrix4();
      
      // Offset trees slightly inward from chunk edges to avoid pop-in effects
      const edgeBuffer = cubeSize * 0.5;
      
      // Place trees
      for (let attempt = 0; attempt < maxTreesPerChunk * 2 && treesPlaced < maxTreesPerChunk; attempt++) {
        // Random position within chunk (with edge buffer)
        const localX = edgeBuffer + rand() * (chunkSize * cubeSize - edgeBuffer * 2);
        const localZ = edgeBuffer + rand() * (chunkSize * cubeSize - edgeBuffer * 2);
        
        // Convert to world coordinates
        const worldX = chunkX + localX;
        const worldZ = chunkZ + localZ;
        
        // Get terrain height at this position
        const terrainHeight = this.terrainGenerator.generateTerrainHeight(worldX, worldZ);
        const normalizedHeight = this.normalizeHeight(terrainHeight);
        
        // Skip if underwater or on steep mountains/snow
        if (normalizedHeight < 0.35 || normalizedHeight > 0.85) continue;
        
        // Use noise for natural distribution
        const noiseValue = this.fbm(worldX * noiseScale, worldZ * noiseScale, 3, chunkSeed);
        
        // Skip based on noise distribution and height
        if (rand() > (0.3 + noiseValue * 0.7)) continue;
        
        // Determine tree type based on elevation
        let treeType;
        if (normalizedHeight > 0.65) {
          treeType = 'pine'; // Pines at higher elevations
        } else if (normalizedHeight > 0.45) {
          treeType = rand() < 0.7 ? 'pine' : 'birch'; // Mix at middle elevations, mostly pine
        } else {
          treeType = rand() < 0.6 ? 'oak' : 'birch'; // Mix at lower elevations, mostly oak
        }
        
        // Randomize tree scale slightly
        const baseScale = 0.7 + rand() * 0.6;
        
        // Calculate scale based on tree type
        let scaleX, scaleY, scaleZ;
        switch (treeType) {
          case 'pine':
            scaleX = baseScale * (0.8 + rand() * 0.4);
            scaleY = baseScale * (0.9 + rand() * 0.5);
            scaleZ = scaleX;
            break;
          case 'oak':
            scaleX = baseScale * (0.9 + rand() * 0.6);
            scaleY = baseScale * (0.7 + rand() * 0.3);
            scaleZ = scaleX;
            break;
          case 'birch':
            scaleX = baseScale * (0.7 + rand() * 0.3);
            scaleY = baseScale * (1.1 + rand() * 0.3);
            scaleZ = scaleX;
            break;
        }
        
        // Add small random rotation for variety
        const rotation = rand() * Math.PI * 2;
        
        // Get instance index for this tree type
        const instanceIndex = this.treeInstances[treeType]++;
        
        // Skip if we've reached the maximum instance count
        if (instanceIndex >= this.treeMeshes[treeType].count) {
          console.warn(`Maximum number of ${treeType} trees reached`);
          continue;
        }
        
        // Set tree position and rotation
        matrix.makeRotationY(rotation);
        matrix.setPosition(worldX, terrainHeight, worldZ);
        matrix.scale(new THREE.Vector3(scaleX, scaleY, scaleZ));
        
        // Apply matrix to the instanced mesh
        this.treeMeshes[treeType].setMatrixAt(instanceIndex, matrix);
        
        treesPlaced++;
      }
      
      // Update the instance matrices
      for (const type of this.treeTypes) {
        this.treeMeshes[type].instanceMatrix.needsUpdate = true;
      }
      
      // console.log(`Added ${treesPlaced} trees to chunk ${chunkKey}`);
    },
    
    // Simple deterministic random number generator
    createRandomGenerator: function(seed) {
      return function() {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };
    },
    
    // Normalize height value based on terrain configuration
    normalizeHeight: function(height) {
      if (!this.terrainGenerator) return 0;
      
      const baseHeight = this.terrainGenerator.baseHeight;
      const heightScale = this.terrainGenerator.heightScale;
      
      return (height - baseHeight) / heightScale;
    },
    
    // Simple fractal Brownian motion for natural distribution
    fbm: function(x, y, octaves, seed) {
      let value = 0;
      let amplitude = 0.5;
      let frequency = 1;
      let maxValue = 0;
      
      for (let i = 0; i < octaves; i++) {
        value += amplitude * this.noise(x * frequency + seed, y * frequency + seed);
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }
      
      return value / maxValue;
    },
    
    // Simplex-like noise function
    noise: function(x, y) {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      
      x -= Math.floor(x);
      y -= Math.floor(y);
      
      const u = this.fade(x);
      const v = this.fade(y);
      
      // Simple hash function
      const a = (X + Y * 37) & 255;
      const b = (X + 1 + Y * 37) & 255;
      const c = (X + (Y + 1) * 37) & 255;
      const d = (X + 1 + (Y + 1) * 37) & 255;
      
      return this.lerp(v, 
        this.lerp(u, this.grad(a, x, y), this.grad(b, x-1, y)),
        this.lerp(u, this.grad(c, x, y-1), this.grad(d, x-1, y-1))
      );
    },
    
    fade: function(t) {
      return t * t * t * (t * (t * 6 - 15) + 10);
    },
    
    lerp: function(t, a, b) {
      return a + t * (b - a);
    },
    
    grad: function(hash, x, y) {
      const h = hash & 7;
      const u = h < 4 ? x : y;
      const v = h < 4 ? y : x;
      return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    },
    
    tick: function(time) {
      // Update only at the specified interval
      if (time - this.lastUpdateTime < this.data.updateInterval) return;
      this.lastUpdateTime = time;
      
      // Check if camera has moved significantly
      const subject = document.querySelector('#subject');
      if (subject && this.lastCameraPosition) {
        const currentPos = subject.object3D.position;
        const dx = currentPos.x - this.lastCameraPosition.x;
        const dy = currentPos.y - this.lastCameraPosition.y;
        const dz = currentPos.z - this.lastCameraPosition.z;
        const distMoved = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // Force matrix update on significant movement
        if (distMoved > 10) {
          for (const type of this.treeTypes) {
            if (this.treeMeshes[type].instanceMatrix) {
              this.treeMeshes[type].instanceMatrix.needsUpdate = true;
            }
          }
          
          // Update camera position
          this.lastCameraPosition = {
            x: currentPos.x,
            y: currentPos.y,
            z: currentPos.z
          };
        }
      } else if (subject) {
        // Initialize last camera position
        this.lastCameraPosition = {
          x: subject.object3D.position.x,
          y: subject.object3D.position.y,
          z: subject.object3D.position.z
        };
      }
    }
  });

  // Add BufferGeometryUtils manually since it's not part of the core THREE library
  const BufferGeometryUtils = {
    mergeBufferGeometries: function(geometries) {
      let vertexCount = 0;
      let indexCount = 0;
      
      // Count vertices and indices
      for (let i = 0; i < geometries.length; i++) {
        const geometry = geometries[i];
        vertexCount += geometry.getAttribute('position').count;
        if (geometry.index) {
          indexCount += geometry.index.count;
        }
      }
      
      // Create merged geometry
      const mergedGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(vertexCount * 3);
      const normals = new Float32Array(vertexCount * 3);
      
      // Merge attributes
      let vertexOffset = 0;
      
      for (let i = 0; i < geometries.length; i++) {
        const geometry = geometries[i];
        const positionAttribute = geometry.getAttribute('position');
        const normalAttribute = geometry.getAttribute('normal');
        
        // Copy positions
        for (let j = 0; j < positionAttribute.count; j++) {
          positions[(vertexOffset + j) * 3] = positionAttribute.getX(j);
          positions[(vertexOffset + j) * 3 + 1] = positionAttribute.getY(j);
          positions[(vertexOffset + j) * 3 + 2] = positionAttribute.getZ(j);
        }
        
        // Copy normals
        for (let j = 0; j < normalAttribute.count; j++) {
          normals[(vertexOffset + j) * 3] = normalAttribute.getX(j);
          normals[(vertexOffset + j) * 3 + 1] = normalAttribute.getY(j);
          normals[(vertexOffset + j) * 3 + 2] = normalAttribute.getZ(j);
        }
        
        vertexOffset += positionAttribute.count;
      }
      
      // Set attributes
      mergedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      mergedGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      
      return mergedGeometry;
    }
  };

  // Add forest-system to scene when loaded, with a slight delay
  const scene = document.querySelector('a-scene');
  if (scene) {
    if (scene.hasLoaded) {
      // Short delay to ensure terrain system is fully initialized
      setTimeout(addForestSystem, 1000);
    } else {
      scene.addEventListener('loaded', function() {
        // Short delay to ensure terrain system is fully initialized
        setTimeout(addForestSystem, 1000);
      });
    }
  }

  function addForestSystem() {
    // Create forest system entity
    const forestEntity = document.createElement('a-entity');
    forestEntity.setAttribute('forest-system', '');
    document.querySelector('a-scene').appendChild(forestEntity);
    console.log("Forest system component added to scene");
    
    // Dispatch custom event for chunkCreated
    // Extend the terrain chunk manager to emit events when chunks are created
    const originalLoadChunkAt = TerrainChunkManager.prototype.loadChunkAt;
    TerrainChunkManager.prototype.loadChunkAt = function(chunkX, chunkZ) {
      // Call the original method
      originalLoadChunkAt.call(this, chunkX, chunkZ);
      
      // Emit event that a new chunk was created
      const event = new CustomEvent('chunkCreated', {
        detail: {
          chunkKey: `${chunkX},${chunkZ}`,
          chunkX: chunkX,
          chunkZ: chunkZ
        }
      });
      document.dispatchEvent(event);
    };
  }
});