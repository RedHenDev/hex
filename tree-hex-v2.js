// tree-hex.js - Hexagon-based trees that match the terrain aesthetic
// This replaces the cylinder/cone tree models with hexagon geometry to match the terrain

AFRAME.registerComponent('tree-hex-manager', {
    schema: {
      // Pool and placement settings
      maxTrees: { type: 'number', default: 128 },
      poolSize: { type: 'number', default: 132 },
      
      // Distance settings
      loadDistance: { type: 'number', default: 760 },   // Distance to start loading trees
      unloadDistance: { type: 'number', default: 800 }, // Distance to unload trees
      minTreeDistance: { type: 'number', default: 128 }, // Minimum distance from player
      updateInterval: { type: 'number', default: 2000 }, // Milliseconds between updates
      
      // Noise settings
      noiseThreshold: { type: 'number', default: 0.56 },
      noiseScale: { type: 'number', default: 0.8 },
      noiseLacunarity: { type: 'number', default: 2.0 },
      noiseGain: { type: 'number', default: 0.5 },
      noiseOctaves: { type: 'number', default: 8 },
      
      // Tree settings
      baseTreeScale: { type: 'number', default: 64 },    // Base scale for trees
      minScaleFactor: { type: 'number', default: 0.1 },  // Minimum scale variation
      maxScaleFactor: { type: 'number', default: 3.0 },  // Maximum scale variation
      scaleNoiseScale: { type: 'number', default: 0.1 }, // Noise scale for tree size variation
      
      // Trunk settings
      trunkSegments: { type: 'number', default: 4 },
      trunkBaseRadius: { type: 'number', default: 0.8 },
      trunkTwistFactor: { type: 'number', default: 90 },
      trunkTaper: { type: 'number', default: 0.15 },
      
      // Foliage settings
      foliageHexCount: { type: 'number', default: 32 },
      foliageScale: { type: 'number', default: 0.4 },
      foliageHeight: { type: 'number', default: 1.1 },
      foliageRadius: { type: 'number', default: 5.0 },
      foliageTilt: { type: 'number', default: 0.25 },
      foliageOpacity: { type: 'number', default: 0.9 },
      
      // Branch settings (connecting trunk to foliage)
      enableBranches: { type: 'boolean', default: true },
      branchWidth: { type: 'number', default: 0.32 },
      
      // Material settings
      trunkEmissive: { type: 'number', default: 0.2 },
      foliageEmissive: { type: 'number', default: 0.4 },
      
      // Grid cell size for tracking tree placement
      gridCellSize: { type: 'number', default: 80 },
      
      // Debug
      debug: { type: 'boolean', default: false }
    },
    
    init: function () {
      // Initialize basics
      this.initializeNoise();
      this.pool = [];
      
      // Initialize tracking variables
      this.lastSubjectX = 0;
      this.lastSubjectZ = 0;
      this.placementGrid = new Map(); // Track where trees have been placed
      this.activeTreeCount = 0;
      
      // Create materials and pool
      this.trunkMaterial = this.createShaderMaterial('#00BABA', 0.8, 0.2);
      this.foliageMaterial = this.createShaderMaterial('#11BABA', 0.5, 0.4);
      this.branchMaterial = this.createShaderMaterial('#00BABA', 0.8, 0.2); // Same as trunk
      this.createTreePool();
      
      // Wait for terrain to be ready
      this.terrainGenerator = null;
      document.addEventListener('terrainReady', () => {
        this.setupTerrainAccess();
        // Place trees once terrain is ready
        this.placeInitialTrees();
      });
      
      // Set up throttled tick function for tree updates
      this.tick = AFRAME.utils.throttleTick(this.tick, this.data.updateInterval, this);

      // Optionally, set a base ambient intensity for reference (should match index.html ambient light intensity)
      this.baseAmbientIntensity = 0.5;
    },
  
    placeInitialTrees: function() {
      if (!this.terrainGenerator) {
        console.warn('Cannot place trees - terrain not ready');
        return;
      }
  
      const startTime = performance.now();
      
      // Get subject's initial position
      const subject = document.querySelector('#subject');
      if (!subject) {
        console.warn('Subject not found for initial tree placement');
        return;
      }
      
      const center = subject.object3D.position;
      
      // Initialize subject position tracking
      this.lastSubjectX = center.x;
      this.lastSubjectZ = center.z;
      
      console.log(`Starting initial tree placement around position (${center.x}, ${center.z})`);
      
      // Set up a grid of potential positions from center to unload distance
      const positions = [];
      const cellSize = this.data.gridCellSize;
      
      // Calculate grid bounds
      const minX = center.x - this.data.unloadDistance;
      const maxX = center.x + this.data.unloadDistance;
      const minZ = center.z - this.data.unloadDistance;
      const maxZ = center.z + this.data.unloadDistance;
      
      const attempts = this.data.maxTrees * 5; // Try 5x more positions than needed
      
      // Generate positions using deterministic approach
      for (let i = 0; i < attempts; i++) {
        // Use noise to generate position within boundaries
        const seedX = Math.sin(i * 0.1) * 1000;
        const seedZ = Math.cos(i * 0.1) * 1000;
        
        // Get a position within our bounds
        const x = minX + (this.perlin2D(seedX, i * 0.3) * 0.5 + 0.5) * (maxX - minX);
        const z = minZ + (this.perlin2D(seedZ, i * 0.3) * 0.5 + 0.5) * (maxZ - minZ);
        
        // Get grid key for this position
        const gridX = Math.floor(x / cellSize);
        const gridZ = Math.floor(z / cellSize);
        const gridKey = `${gridX},${gridZ}`;
        
        // Skip if we already have a tree in this grid cell
        if (this.placementGrid.has(gridKey)) continue;
        
        // Calculate distance from player
        const dx = x - center.x;
        const dz = z - center.z;
        const distanceToPlayer = Math.sqrt(dx * dx + dz * dz);
        
        // Skip if too close to player or beyond unload distance
        if (distanceToPlayer < this.data.minTreeDistance || distanceToPlayer > this.data.unloadDistance) {
          continue;
        }
        
        // Get noise value for this exact position
        const noiseValue = this.fbm(
          x * this.data.noiseScale, 
          z * this.data.noiseScale
        );
        
        // Check if noise value exceeds threshold
        if (noiseValue > this.data.noiseThreshold) {
          // Add deterministic jitter based on grid position
          const jitterX = this.perlin2D(gridX * 0.4, gridZ * 0.4) * (cellSize * 0.4);
          const jitterZ = this.perlin2D(gridX * 0.4, gridZ * 0.8) * (cellSize * 0.4);
          
          positions.push({
            x: x + jitterX,
            z: z + jitterZ,
            noise: noiseValue,
            gridKey: gridKey,
            distanceToPlayer: distanceToPlayer
          });
        }
      }
      
      // Sort by noise value to prioritize stronger matches
      positions.sort((a, b) => b.noise - a.noise);
      
      console.log(`Found ${positions.length} potential tree positions`);
      
      // Place trees up to max limit
      const treeCount = Math.min(positions.length, this.data.maxTrees);
      for (let i = 0; i < treeCount; i++) {
        const pos = positions[i];
        const treeObj = this.pool[i];
        if (!treeObj) continue;
        
        // Mark this grid cell as occupied
        this.placementGrid.set(pos.gridKey, true);
        
        const y = this.getTerrainHeight(pos.x, pos.z);
        
        // Calculate tree scale based on position
        const scaleFactor = this.getTreeScaleFactor(pos.x, pos.z);
        
        this.updateTree(treeObj, pos.x, y, pos.z, pos.noise, scaleFactor);
        treeObj.active = true;
        treeObj.worldPos = { x: pos.x, z: pos.z };
        treeObj.gridKey = pos.gridKey;
        treeObj.scaleFactor = scaleFactor;
      }
      
      this.activeTreeCount = treeCount;
      console.log(`Placed ${treeCount} initial trees in ${Math.round(performance.now() - startTime)}ms`);
    },
  
    // Add tick function for dynamic tree loading/unloading
    tick: function (time, delta) {
      if (!this.terrainGenerator) return;
      
      // Get subject's current position
      const subject = document.querySelector('#subject');
      if (!subject) return;
      
      const subjectPos = subject.object3D.position;
      
      // Check if subject has moved enough to warrant tree updates
      const distX = subjectPos.x - this.lastSubjectX;
      const distZ = subjectPos.z - this.lastSubjectZ;
      const distMoved = Math.sqrt(distX * distX + distZ * distZ);
      
      // Only update trees if player has moved significantly
      if (distMoved > 40) {
        this.lastSubjectX = subjectPos.x;
        this.lastSubjectZ = subjectPos.z;
        
        // Update trees based on distance
        this.updateTreesAroundSubject(subjectPos);
      }
    },
  
    // Update trees around the subject
    updateTreesAroundSubject: function(subjectPos) {
      const startTime = performance.now();
      
      // Find trees that need to be unloaded
      const treesToReposition = [];
      
      for (let i = 0; i < this.pool.length; i++) {
        const treeObj = this.pool[i];
        if (!treeObj.active) continue;
        
        // Calculate distance (x,z only)
        const dx = treeObj.worldPos.x - subjectPos.x;
        const dz = treeObj.worldPos.z - subjectPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist > this.data.unloadDistance) {
          // Mark for repositioning
          treesToReposition.push(treeObj);
          
          // Remove from placement grid
          if (treeObj.gridKey) {
            this.placementGrid.delete(treeObj.gridKey);
          }
          
          // Mark as inactive (until repositioned)
          treeObj.active = false;
        }
      }
      
      if (treesToReposition.length === 0) return;
      
      if (this.data.debug) {
        console.log(`Repositioning ${treesToReposition.length} trees that are beyond unload distance`);
      }
      
      // Generate new potential positions
      const cellSize = this.data.gridCellSize;
      const positions = [];
      
      // Calculate the annular ring where we want to place trees
      // (between loadDistance and unloadDistance)
      const ringWidth = this.data.unloadDistance - this.data.loadDistance;
      
      // Use multiple rings for placing trees
      const numRings = 3;
      const ringSizes = [
        this.data.loadDistance,                 // Inner edge
        this.data.loadDistance + ringWidth/3,   // First third
        this.data.loadDistance + 2*ringWidth/3, // Second third
        this.data.unloadDistance                // Outer edge
      ];
      
      // Get a noise seed based on player position to vary positions
      const noiseSeed = Math.floor(subjectPos.x * 0.01) + Math.floor(subjectPos.z * 0.01) * 1000;
      
      const attempts = treesToReposition.length * 5; // Try 5x more positions than needed
      
      for (let i = 0; i < attempts; i++) {
        // Determine which ring to use (weighted toward inner rings)
        const ringIndex = Math.floor(this.perlin2D(i * 0.17, noiseSeed * 0.13) * numRings);
        const innerRadius = ringSizes[ringIndex];
        const outerRadius = ringSizes[ringIndex + 1];
        
        // Generate angle and radius using noise
        const angle = this.perlin2D(i * 0.23, noiseSeed * 0.31) * Math.PI * 2;
        const radius = innerRadius + (this.perlin2D(i * 0.19, noiseSeed * 0.41) * 0.5 + 0.5) * (outerRadius - innerRadius);
        
        // Calculate position
        const x = subjectPos.x + Math.cos(angle) * radius;
        const z = subjectPos.z + Math.sin(angle) * radius;
        
        // Get grid key for this position
        const gridX = Math.floor(x / cellSize);
        const gridZ = Math.floor(z / cellSize);
        const gridKey = `${gridX},${gridZ}`;
        
        // Skip if we already have a tree in this grid cell
        if (this.placementGrid.has(gridKey)) continue;
        
        // Calculate distance from player (to enforce minimum distance)
        const distToPlayer = Math.sqrt(
          Math.pow(x - subjectPos.x, 2) + 
          Math.pow(z - subjectPos.z, 2)
        );
        
        // Skip if too close to player
        if (distToPlayer < this.data.minTreeDistance) continue;
        
        // Get noise value for this exact position
        const noiseValue = this.fbm(
          x * this.data.noiseScale, 
          z * this.data.noiseScale
        );
        
        // Check if noise value exceeds threshold (lowered threshold for dynamic updates)
        if (noiseValue > this.data.noiseThreshold * 0.8) {  // <-- MODIFIED CONDITION
          // Add deterministic jitter based on grid position
          const jitterX = this.perlin2D(gridX * 0.4, gridZ * 0.4) * (cellSize * 0.4);
          const jitterZ = this.perlin2D(gridX * 0.4, gridZ * 0.8) * (cellSize * 0.4);
          
          positions.push({
            x: x + jitterX,
            z: z + jitterZ,
            noise: noiseValue,
            gridKey: gridKey
          });
        }
      }
      
      // Sort by noise value to get best positions
      positions.sort((a, b) => b.noise - a.noise);
      
      // Reposition trees to new positions
      const treeCount = Math.min(positions.length, treesToReposition.length);
      for (let i = 0; i < treeCount; i++) {
        const pos = positions[i];
        const treeObj = treesToReposition[i];
        if (!treeObj) continue;
        
        // Mark this grid cell as occupied
        this.placementGrid.set(pos.gridKey, true);
        
        const y = this.getTerrainHeight(pos.x, pos.z);
        
        // Calculate tree scale based on position
        const scaleFactor = this.getTreeScaleFactor(pos.x, pos.z);
        
        this.updateTree(treeObj, pos.x, y, pos.z, pos.noise, scaleFactor);
        treeObj.active = true;
        treeObj.gridKey = pos.gridKey;
        treeObj.worldPos = { x: pos.x, z: pos.z };
        treeObj.scaleFactor = scaleFactor;
      }
      
      // Hide any trees we couldn't reposition
      for (let i = treeCount; i < treesToReposition.length; i++) {
        const treeObj = treesToReposition[i];
        if (!treeObj) continue;
        
        // Hide the tree by scaling to zero
        this.hideTree(treeObj);
      }
      
      if (this.data.debug) {
        console.log(`Repositioned ${treeCount} trees to new locations in ${Math.round(performance.now() - startTime)}ms`);
      }
    },
    
    // Get a deterministic scale factor for a tree based on its position
    getTreeScaleFactor: function(x, z) {
      // Use different noise frequencies to get a natural variation
      const baseNoise = this.perlin2D(x * this.data.scaleNoiseScale, z * this.data.scaleNoiseScale);
      
      // Map noise from [-1,1] to [minScale, maxScale]
      const normalizedNoise = (baseNoise + 1) * 0.5; // Map to [0,1]
      const scaleRange = this.data.maxScaleFactor - this.data.minScaleFactor;
      
      // Calculate scale factor with a slight curve (squared) to favor medium sizes
      const scaleFactor = this.data.minScaleFactor + (Math.pow(normalizedNoise, 1.5) * scaleRange);
      
      return scaleFactor;
    },
    
    // Hide a tree by scaling it to zero
    hideTree: function(treeObj) {
      const matrix = new THREE.Matrix4();
      matrix.makeScale(0, 0, 0); // Scale to zero
      
      for (let i = 0; i < this.data.trunkSegments; i++) {
        const trunkIndex = treeObj.trunkStart + i;
        this.trunkMesh.setMatrixAt(trunkIndex, matrix);
      }
      
      for (let i = 0; i < this.data.foliageHexCount; i++) {
        const foliageIndex = treeObj.foliageStart + i;
        this.foliageMesh.setMatrixAt(foliageIndex, matrix);
        
        if (this.data.enableBranches && this.branchMesh) {
          const branchIndex = treeObj.branchStart + i;
          this.branchMesh.setMatrixAt(branchIndex, matrix);
        }
      }
      
      this.trunkMesh.instanceMatrix.needsUpdate = true;
      this.foliageMesh.instanceMatrix.needsUpdate = true;
      if (this.data.enableBranches && this.branchMesh) {
        this.branchMesh.instanceMatrix.needsUpdate = true;
      }
    },
  
    // Update noise initialization to match terrain system
    initializeNoise: function() {
      const NOISE_SEED = 99;
      
      this.noise = {
        seed: NOISE_SEED,
        p: new Array(512),
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
        }
      };
  
      // Use same permutation setup as terrain
      const perm = new Array(256);
      for (let i = 0; i < 256; i++) perm[i] = i;
      for (let i = 255; i > 0; i--) {
        const seedMix = (NOISE_SEED ^ (NOISE_SEED >> 5) ^ (NOISE_SEED << 7) ^ (i * 13)) & 0xFFFFFFFF;
        const j = seedMix % (i + 1);
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      for (let i = 0; i < 512; i++) {
        this.noise.p[i] = perm[i & 255];
      }
    },
  
    // Create geometries for tree components
    createGeometries: function() {
      // Trunk cylinder geometry
      this.trunkGeometry = new THREE.CylinderGeometry(
        this.data.trunkBaseRadius, 
        this.data.trunkBaseRadius, 
        1.0, 
        6
      );
      
      // Foliage cylinder geometry (hexagonal prism)
      this.foliageGeometry = new THREE.CylinderGeometry(
        1.0, 
        1.0, 
        this.data.foliageHeight, 
        6
      );
      
      // Branch triangle geometry connecting trunk to foliage
      if (this.data.enableBranches) {
        this.branchGeometry = new THREE.BufferGeometry();
        
        // Triangle vertices - point at (0,1,0) will connect to foliage center
        const vertices = new Float32Array([
          -0.5, 0, 0,  // Left base at trunk
          0.5, 0, 0,   // Right base at trunk
          0, 1, 0      // Top point toward foliage
        ]);
        
        // Define normals
        const normals = new Float32Array([
          0, 0, 1,
          0, 0, 1,
          0, 0, 1
        ]);
        
        // Add attributes
        this.branchGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        this.branchGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        
        // Add back-facing triangles for double-sided rendering
        this.branchGeometry = BufferGeometryUtils.toTrianglesDrawMode(this.branchGeometry);
      }
    },
  
    // Add new method for tree pool creation
    createTreePool: function() {
      // Create geometries
      this.createGeometries();
  
      // Use standard materials for visibility
      this.trunkMaterial = new THREE.MeshStandardMaterial({
        color: 'brown',
        emissive: 'brown',
        emissiveIntensity: 0.2,
        metalness: 0.0,
        roughness: 0.8
      });
      
      this.foliageMaterial = new THREE.MeshStandardMaterial({
        color: 0x11baba,
        emissive: 0x11baba,
        emissiveIntensity: 0.4,
        metalness: 0.0,
        roughness: 0.5,
        transparent: true,
        opacity: this.data.foliageOpacity || 0.8
      });
      
      if (this.data.enableBranches) {
        this.branchMaterial = new THREE.MeshStandardMaterial({
          color: 'brown',
          emissive: 'brown',
          emissiveIntensity: 0.2,
          metalness: 0.0,
          roughness: 0.8,
          side: THREE.DoubleSide // Important for the triangles to be visible from both sides
        });
      }
  
      // Create instanced meshes
      this.trunkMesh = new THREE.InstancedMesh(
        this.trunkGeometry,
        this.trunkMaterial,
        this.data.poolSize * this.data.trunkSegments
      );
      
      this.foliageMesh = new THREE.InstancedMesh(
        this.foliageGeometry,
        this.foliageMaterial,
        this.data.poolSize * this.data.foliageHexCount
      );
      
      if (this.data.enableBranches) {
        this.branchMesh = new THREE.InstancedMesh(
          this.branchGeometry,
          this.branchMaterial,
          this.data.poolSize * this.data.foliageHexCount
        );
      }
      
      // Ensure visibility
      this.trunkMesh.frustumCulled = false;
      this.foliageMesh.frustumCulled = false;
      if (this.data.enableBranches) {
        this.branchMesh.frustumCulled = false;
      }
      
      // Add to scene
      const group = new THREE.Group();
      group.add(this.trunkMesh);
      group.add(this.foliageMesh);
      if (this.data.enableBranches) {
        group.add(this.branchMesh);
      }
      this.el.setObject3D('mesh', group);
      
      // Initialize pool
      for (let i = 0; i < this.data.poolSize; i++) {
        this.pool.push({
          active: false,
          worldPos: { x: 0, z: 0 },
          trunkStart: i * this.data.trunkSegments,
          foliageStart: i * this.data.foliageHexCount,
          branchStart: i * this.data.foliageHexCount, // Same count as foliage
          scaleFactor: 1.0 // Default scale factor
        });
      }
      
      console.log('Created tree meshes for pool of size', this.data.poolSize);
    },
    
    createShaderMaterial: function(color, roughness, emissiveIntensity) {
      // Get shader reference from hex-simple.js
      const hexShader = window.HexShaderLib || {};
      
      // Create material
      const material = new THREE.ShaderMaterial({
        vertexShader: hexShader.vertexShader || `
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
          }`,
        fragmentShader: hexShader.fragmentShader || `
          uniform vec3 color;
          uniform float emissiveIntensity;
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          
          void main() {
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            float dotProduct = abs(dot(viewDir, normal));
            gl_FragColor = vec4(color * (emissiveIntensity + 0.5 * dotProduct), 1.0);
          }`,
        uniforms: {
          color: { value: new THREE.Color(color) },
          emissiveIntensity: { value: emissiveIntensity },
          time: { value: 0 }
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true
      });
      
      return material;
    },
    
    // Update perlin2D to match terrain's implementation
    perlin2D: function(x, y) {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      x -= Math.floor(x);
      y -= Math.floor(y);
      const u = this.noise.fade(x);
      const v = this.noise.fade(y);
      const A = this.noise.p[X] + Y;
      const B = this.noise.p[X + 1] + Y;
      const AA = this.noise.p[A];
      const AB = this.noise.p[A + 1];
      const BA = this.noise.p[B];
      const BB = this.noise.p[B + 1];
      return this.noise.lerp(v, 
        this.noise.lerp(u, 
          this.noise.grad(this.noise.p[AA], x, y, 0),
          this.noise.grad(this.noise.p[BA], x-1, y, 0)
        ),
        this.noise.lerp(u,
          this.noise.grad(this.noise.p[AB], x, y-1, 0),
          this.noise.grad(this.noise.p[BB], x-1, y-1, 0)
        )
      );
    },
  
    // Modify fbm function to increase value range
    fbm: function(x, y) {
      let value = 0;
      let amplitude = 1.0;
      let frequency = 1.0;
      let maxValue = 0;
      
      for(let i = 0; i < this.data.noiseOctaves; i++) {
        // Add phase shift per octave for more variation
        const phaseX = x + (i * 17.31);  // Prime numbers for phase shift
        const phaseZ = y + (i * 23.67);
        
        const noiseVal = this.perlin2D(
          phaseX * this.data.noiseScale * frequency, 
          phaseZ * this.data.noiseScale * frequency
        );
        
        // Use different power curve per octave
        const normalizedNoise = Math.pow((noiseVal + 1) * 0.5, 1.0 + (i * 0.2));
        
        value += normalizedNoise * amplitude;
        maxValue += amplitude;
        amplitude *= this.data.noiseGain;
        frequency *= this.data.noiseLacunarity;
      }
      
      const finalValue = value / maxValue;
      
      // Add debug visualization if enabled
      if (this.data.debug && Math.random() < 0.001) {
        console.log('Noise value at', {x, y, value: finalValue, 
          threshold: this.data.noiseThreshold});
      }
      
      return finalValue;
    },
  
    setupTerrainAccess: function() {
      try {
        const scene = document.querySelector('a-scene');
        if (!scene) return;
        
        if (scene.hasAttribute('terrain-manager')) {
          const terrainManager = scene.components['terrain-manager'];
          if (terrainManager && terrainManager.chunkManager && terrainManager.chunkManager.terrainGenerator) {
            this.terrainGenerator = terrainManager.chunkManager.terrainGenerator;
            this.needsResampling = true;
            console.log('Tree manager: Successfully connected to terrain generator');
          }
        }
      } catch (err) {
        console.error('Tree hex manager: Error setting up terrain access:', err);
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
  
    // Update tree positioning with instanced mesh
    updateTree: function(treeObj, x, y, z, noiseValue, scaleFactor) {
      const matrix = new THREE.Matrix4();
      const baseScale = this.data.baseTreeScale * scaleFactor;
      const rotationMatrix = new THREE.Matrix4();
      
      // Calculate trunk top position (for branch connections)
      const trunkTopY = y + (this.data.trunkSegments * baseScale) + 2;
      const foliageLowering = 142 * scaleFactor; // Scale the foliage lowering
  
      // Update trunk segments with lift and scale variation
      for (let i = 0; i < this.data.trunkSegments; i++) {
        const trunkIndex = treeObj.trunkStart + i;
        // Use deterministic noise for twist
        const twist = this.perlin2D(x * 0.1 + i * 17.53, z * 0.1 + i * 31.17) * this.data.trunkTwistFactor;
        const radius = this.data.trunkBaseRadius * (1 - (i * this.data.trunkTaper));
        
        matrix.identity();
        matrix.makeScale(radius * baseScale, baseScale, radius * baseScale);
        rotationMatrix.makeRotationY(twist * Math.PI / 180);
        matrix.multiply(rotationMatrix);
        // Add 2 units to y position
        matrix.setPosition(x, y + (i * baseScale) + 2, z);
        
        this.trunkMesh.setMatrixAt(trunkIndex, matrix);
      }
      
      // Noise-based foliage with scale variation
      for (let i = 0; i < this.data.foliageHexCount; i++) {
        const foliageIndex = treeObj.foliageStart + i;
        
        // Use deterministic noise for angle and distance
        const angle = this.perlin2D(x + i * 73.31, z + i * 29.17) * Math.PI * 2;
        const dist = this.perlin2D(x - i * 41.43, z - i * 91.57) * (baseScale * this.data.foliageRadius);
        
        // Position using noise values
        const posX = x + Math.cos(angle) * dist;
        const posZ = z + Math.sin(angle) * dist;
        const heightOffset = (baseScale * this.data.foliageRadius - dist) * 0.5;
        // Add 2 units to match trunk lift, then lower foliage
        const posY = trunkTopY + heightOffset - foliageLowering;
        
        // Create tilted hexagons with deterministic twist
        matrix.identity();
        matrix.makeScale(
          baseScale * this.data.foliageScale, 
          baseScale * this.data.foliageHeight, 
          baseScale * this.data.foliageScale
        );
        
        // Tilt based on distance from trunk (deterministically)
        const tiltAngle = (dist / (baseScale * this.data.foliageRadius)) * this.data.foliageTilt * Math.PI;
        const tiltMatrix = new THREE.Matrix4().makeRotationX(tiltAngle);
        matrix.multiply(tiltMatrix);
        
        // Use deterministic noise for twist
        const twist = this.perlin2D(x * 0.05 + i * 59.83, z * 0.05 + i * 67.19) * Math.PI * 0.2;
        rotationMatrix.makeRotationY(angle + twist);
        matrix.multiply(rotationMatrix);
        
        matrix.setPosition(posX, posY, posZ);
        this.foliageMesh.setMatrixAt(foliageIndex, matrix);
        
        // Add branch connecting trunk top to foliage center
        if (this.data.enableBranches && this.branchMesh) {
          const branchIndex = treeObj.branchStart + i;
          // Determine which trunk section to use (avoiding the base section)
          const trunkSectionIndex = 1 + (i % (this.data.trunkSegments - 1));
          // Compute branch origin along the trunk (varying by trunkSectionIndex)
          const branchOrigin = new THREE.Vector3(x, y + trunkSectionIndex * baseScale + 2, z);
          // Foliage centre (target point of branch tip)
          const foliageCenter = new THREE.Vector3(posX, posY, posZ);
          // Compute branch direction and length.
          const branchDir = new THREE.Vector3().subVectors(foliageCenter, branchOrigin);
          const branchLength = branchDir.length();
          const branchWidth = baseScale * this.data.branchWidth;
          // Create a quaternion to rotate (0,1,0) to the branch direction.
          const quat = new THREE.Quaternion();
          quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), branchDir.clone().normalize());
          // Compose the transformation: translation then rotation and scaling.
          const branchMatrix = new THREE.Matrix4();
          branchMatrix.compose(branchOrigin, quat, new THREE.Vector3(branchWidth, branchLength, branchWidth));
          this.branchMesh.setMatrixAt(branchIndex, branchMatrix);
        }
      }
      
      this.trunkMesh.instanceMatrix.needsUpdate = true;
      this.foliageMesh.instanceMatrix.needsUpdate = true;
      if (this.data.enableBranches && this.branchMesh) {
        this.branchMesh.instanceMatrix.needsUpdate = true;
      }
    },
  
    // Add shader pulse control through uniforms
    setPulseState: function(enable) {
      if (this.trunkMaterial && this.trunkMaterial.uniforms) {
        this.trunkMaterial.uniforms.emissiveIntensity.value = enable ? 0.4 : 0.2;
      }
      if (this.foliageMaterial && this.foliageMaterial.uniforms) {
        this.foliageMaterial.uniforms.emissiveIntensity.value = enable ? 0.8 : 0.4;
      }
      if (this.branchMaterial && this.branchMaterial.uniforms) {
        this.branchMaterial.uniforms.emissiveIntensity.value = enable ? 0.4 : 0.2;
      }
    }
  });
  
  // BufferGeometryUtils for double-sided triangles
  const BufferGeometryUtils = {
    toTrianglesDrawMode: function(geometry) {
      // Create a double-sided version by duplicating with flipped normals
      if (geometry.index !== null) {
        console.warn("BufferGeometryUtils: toTrianglesDrawMode doesn't support indexed geometries yet.");
        return geometry;
      }
  
      const positions = geometry.attributes.position.array;
      const normals = geometry.attributes.normal.array;
      
      // Create duplicated arrays with flipped normals for backfaces
      const newPositions = new Float32Array(positions.length * 2);
      const newNormals = new Float32Array(normals.length * 2);
      
      // Copy frontface data
      newPositions.set(positions);
      newNormals.set(normals);
      
      // Copy backface data with reversed vertices (to flip winding) and normals
      for (let i = 0, j = 0; i < positions.length; i += 9, j += 9) {
        // Copy vertices in reverse order to flip winding
        newPositions[positions.length + j] = positions[i + 6];
        newPositions[positions.length + j + 1] = positions[i + 7];
        newPositions[positions.length + j + 2] = positions[i + 8];
        
        newPositions[positions.length + j + 3] = positions[i + 3];
        newPositions[positions.length + j + 4] = positions[i + 4];
        newPositions[positions.length + j + 5] = positions[i + 5];
        
        newPositions[positions.length + j + 6] = positions[i];
        newPositions[positions.length + j + 7] = positions[i + 1];
        newPositions[positions.length + j + 8] = positions[i + 2];
        
        // Copy normals with negative values
        for (let k = 0; k < 9; k++) {
          newNormals[normals.length + j + k] = -normals[j + k];
        }
      }
      
      // Create new geometry with double faces
      const result = new THREE.BufferGeometry();
      result.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
      result.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
      
      return result;
    }
  };
  
  // Connect to hex pulse system through shader uniforms
  const originalToggleHexPulse = window.toggleHexPulse;
  window.toggleHexPulse = function(enable) {
    if (originalToggleHexPulse) {
      originalToggleHexPulse(enable);
    }
    
    // Update tree materials through shader uniforms
    const treeManager = document.querySelector('[tree-hex-manager]');
    if (treeManager && treeManager.components['tree-hex-manager']) {
      treeManager.components['tree-hex-manager'].setPulseState(enable);
    }
  };
  
  console.log(`Tree Hex Manager initialized with ${window.TerrainConfig?.geometrySize || 4.4}u grid spacing`);