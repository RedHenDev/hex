// tree-hex.js - Hexagon-based trees that match the terrain aesthetic
// This replaces the cylinder/cone tree models with hexagon geometry to match the terrain

AFRAME.registerComponent('tree-hex-manager', {
    schema: {
      // Pool and placement settings
      maxTrees: { type: 'number', default: 128 },
      poolSize: { type: 'number', default: 512 },
      radius: { type: 'number', default: 760 },
      
      // Dynamic loading settings
      loadDistance: { type: 'number', default: 760 },
      unloadDistance: { type: 'number', default: 800 },
      updateInterval: { type: 'number', default: 2000 }, // Milliseconds between tree updates
      
      // Noise settings
      noiseThreshold: { type: 'number', default: 0.35 },
      noiseScale: { type: 'number', default: 5.0 },
      noiseLacunarity: { type: 'number', default: 2.0 },
      noiseGain: { type: 'number', default: 0.5 },
      noiseOctaves: { type: 'number', default: 4 },
      
      // Tree settings
      treeScale: { type: 'number', default: 64 },
      
      // Trunk settings
      trunkSegments: { type: 'number', default: 4 },
      trunkBaseRadius: { type: 'number', default: 0.8 },
      trunkTwistFactor: { type: 'number', default: 90 },
      trunkTaper: { type: 'number', default: 0.15 },
      
      // Foliage settings
      foliageHexCount: { type: 'number', default: 64 },
      foliageScale: { type: 'number', default: 0.4 },
      foliageHeight: { type: 'number', default: 0.6 },
      foliageRadius: { type: 'number', default: 3.0 },
      foliageTilt: { type: 'number', default: 0.45 },
      
      // Material settings
      trunkEmissive: { type: 'number', default: 0.2 },
      foliageEmissive: { type: 'number', default: 0.4 },
      
      // Grid settings for avoiding duplicate tree placement
      gridCellSize: { type: 'number', default: 100 },
      
      // Debug
      debug: { type: 'boolean', default: false }
    },
    
    init: function () {
      // Initialize basics
      this.initializeNoise();
      this.pool = [];
      
      // Initialize tracking variables for dynamic loading
      this.lastSubjectX = 0;
      this.lastSubjectZ = 0;
      this.lastUpdateTime = 0;
      this.placementGrid = new Map(); // Track where trees have been placed
      this.activeTreeCount = 0;
      
      // Create materials and pool
      this.trunkMaterial = this.createShaderMaterial('#00BABA', 0.8, 0.2);
      this.foliageMaterial = this.createShaderMaterial('#11BABA', 0.5, 0.4);
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
    },
  
    placeInitialTrees: function() {
      if (!this.terrainGenerator) {
          console.warn('Cannot place trees - terrain not ready');
          return;
      }
  
      const startTime = performance.now();
      const positions = [];
      
      // Get subject's initial position
      const subject = document.querySelector('#subject');
      const center = subject ? subject.object3D.position : { x: 0, z: 0 };
      const radius = this.data.radius;
      
      // Initialize subject position tracking
      this.lastSubjectX = center.x;
      this.lastSubjectZ = center.z;
      
      // Generate many potential positions using noise
      const attempts = this.data.maxTrees * 8; // Try 8x more positions than needed
      
      for (let i = 0; i < attempts; i++) {
          // Use noise to generate position within radius
          const angle = this.perlin2D(i * 0.3, i * 0.7) * Math.PI * 2;
          const dist = Math.sqrt(this.perlin2D(i * 0.7, i * 0.3) + 1) * radius;
          
          const x = center.x + Math.cos(angle) * dist;
          const z = center.z + Math.sin(angle) * dist;
          
          // Get grid key for this position
          const gridKey = `${Math.floor(x / this.data.gridCellSize)},${Math.floor(z / this.data.gridCellSize)}`;
          
          // Skip if we already have a tree in this grid cell
          if (this.placementGrid.has(gridKey)) continue;
          
          // Get noise value for this exact position
          const noiseValue = this.fbm(
              x * this.data.noiseScale, 
              z * this.data.noiseScale
          );
          
          // Check if noise value exceeds threshold
          if (noiseValue > this.data.noiseThreshold) {
              // Add small noise-based offset for natural feel
              const jitterX = this.perlin2D(x * 0.1, z * 0.1) * 16;
              const jitterZ = this.perlin2D(x * 0.1, z * 0.2) * 16;
              
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
      
      // Place trees up to max limit
      const treeCount = Math.min(positions.length, this.data.maxTrees);
      for (let i = 0; i < treeCount; i++) {
          const pos = positions[i];
          const treeObj = this.pool[i];
          if (!treeObj) continue;
          
          // Mark this grid cell as occupied
          this.placementGrid.set(pos.gridKey, true);
          
          const y = this.getTerrainHeight(pos.x, pos.z);
          this.updateTree(treeObj, pos.x, y, pos.z, pos.noise);
          treeObj.active = true;
          treeObj.worldPos = { x: pos.x, z: pos.z };
          treeObj.gridKey = pos.gridKey;
      }
      
      this.activeTreeCount = treeCount;
      console.log(`Found ${positions.length} valid positions, placed ${treeCount} trees in ${Math.round(performance.now() - startTime)}ms`);
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
        this.updateTreesAroundSubject(subjectPos, time);
      }
    },
  
    // Update trees around the subject
    updateTreesAroundSubject: function(subjectPos, time) {
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
      
      // Find new positions for trees
      const positions = [];
      const attempts = treesToReposition.length * 8; // Try 8x more positions than needed
      
      // Use time value to ensure different random positions each update
      const timeOffset = (time % 10000) * 0.0001;
      
      for (let i = 0; i < attempts; i++) {
        // Use noise to generate position within the load radius but outside a minimum distance
        const angle = this.perlin2D(i * 0.3 + timeOffset, i * 0.7) * Math.PI * 2;
        // Position trees between 100 and loadDistance units from the player
        const dist = 100 + (this.data.loadDistance - 100) * Math.sqrt(this.perlin2D(i * 0.7, i * 0.3 + timeOffset) * 0.5 + 0.5);
        
        const x = subjectPos.x + Math.cos(angle) * dist;
        const z = subjectPos.z + Math.sin(angle) * dist;
        
        // Skip if we already have a tree in this grid cell
        const gridKey = `${Math.floor(x / this.data.gridCellSize)},${Math.floor(z / this.data.gridCellSize)}`;
        if (this.placementGrid.has(gridKey)) continue;
        
        // Get noise value for this exact position
        const noiseValue = this.fbm(
          x * this.data.noiseScale, 
          z * this.data.noiseScale
        );
        
        // Check if noise value exceeds threshold
        if (noiseValue > this.data.noiseThreshold) {
          // Add small noise-based offset for natural feel
          const jitterX = this.perlin2D(x * 0.1, z * 0.1) * 16;
          const jitterZ = this.perlin2D(x * 0.1, z * 0.2) * 16;
          
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
        this.updateTree(treeObj, pos.x, y, pos.z, pos.noise);
        treeObj.active = true;
        treeObj.gridKey = pos.gridKey;
        treeObj.worldPos = { x: pos.x, z: pos.z };
      }
      
      // If there are more trees to reposition than valid positions,
      // hide the remaining trees
      for (let i = treeCount; i < treesToReposition.length; i++) {
        const treeObj = treesToReposition[i];
        if (!treeObj) continue;
        
        // Hide the tree by moving it far below the terrain
        this.hideTree(treeObj);
      }
      
      if (this.data.debug) {
        console.log(`Repositioned ${treeCount} trees to new locations`);
      }
    },
    
    // Hide a tree by moving it far below the terrain
    hideTree: function(treeObj) {
      const hiddenPos = new THREE.Vector3(999999, -999999, 999999);
      
      // Update matrices to hide trunk segments
      const matrix = new THREE.Matrix4();
      matrix.makeScale(0, 0, 0); // Scale to zero
      
      for (let i = 0; i < this.data.trunkSegments; i++) {
        const trunkIndex = treeObj.trunkStart + i;
        this.trunkMesh.setMatrixAt(trunkIndex, matrix);
      }
      
      for (let i = 0; i < this.data.foliageHexCount; i++) {
        const foliageIndex = treeObj.foliageStart + i;
        this.foliageMesh.setMatrixAt(foliageIndex, matrix);
      }
      
      this.trunkMesh.instanceMatrix.needsUpdate = true;
      this.foliageMesh.instanceMatrix.needsUpdate = true;
      
      treeObj.active = false;
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
  
    // Add new method for tree pool creation
    createTreePool: function() {
      // Create geometries using schema values
      const trunkGeometry = new THREE.CylinderGeometry(
          this.data.trunkBaseRadius, 
          this.data.trunkBaseRadius, 
          1.0, 
          6
      );
      
      const foliageGeometry = new THREE.CylinderGeometry(
          1.0, 
          1.0, 
          this.data.foliageHeight, 
          6
      );
  
      // Use standard materials first to verify visibility
      this.trunkMaterial = new THREE.MeshStandardMaterial({
          color: 'brown',  // Blueish color
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
          opacity: 0.6
      });
  
      // Create instanced meshes
      this.trunkMesh = new THREE.InstancedMesh(
          trunkGeometry,
          this.trunkMaterial,
          this.data.poolSize * this.data.trunkSegments
      );
      
      this.foliageMesh = new THREE.InstancedMesh(
          foliageGeometry,
          this.foliageMaterial,
          this.data.poolSize * this.data.foliageHexCount
      );
      
      // Ensure visibility
      this.trunkMesh.frustumCulled = false;
      this.foliageMesh.frustumCulled = false;
      
      // Add to scene
      const group = new THREE.Group();
      group.add(this.trunkMesh);
      group.add(this.foliageMesh);
      this.el.setObject3D('mesh', group);
      
      // Initialize pool
      for (let i = 0; i < this.data.poolSize; i++) {
          this.pool.push({
              active: false,
              worldPos: { x: 0, z: 0 },
              trunkStart: i * this.data.trunkSegments,
              foliageStart: i * this.data.foliageHexCount
          });
      }
      
      console.log('Created tree meshes:', {
          trunkMesh: this.trunkMesh,
          foliageMesh: this.foliageMesh
      });
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
    updateTree: function(treeObj, x, y, z, noiseValue) {
      const matrix = new THREE.Matrix4();
      const scale = this.data.treeScale;
      const rotationMatrix = new THREE.Matrix4();
      // Lower foliage by this offset (relative to trunk top)
      const foliageLowering = scale * 0.4; // adjust this value as needed
  
      // Update trunk segments with lift
      for (let i = 0; i < this.data.trunkSegments; i++) {
          const trunkIndex = treeObj.trunkStart + i;
          const twist = this.perlin2D(x * 0.1 + i, z * 0.1) * this.data.trunkTwistFactor;
          const radius = this.data.trunkBaseRadius * (1 - (i * this.data.trunkTaper));
          
          matrix.identity();
          matrix.makeScale(radius * scale, scale, radius * scale);
          rotationMatrix.makeRotationY(twist * Math.PI / 180);
          matrix.multiply(rotationMatrix);
          // Add 2 units to y position
          matrix.setPosition(x, y + (i * scale) + 2, z);
          
          this.trunkMesh.setMatrixAt(trunkIndex, matrix);
      }
      
      // Noise-based foliage
      for (let i = 0; i < this.data.foliageHexCount; i++) {
          const foliageIndex = treeObj.foliageStart + i;
          
          // Use noise for angle and distance
          const angle = this.perlin2D(x + i * 0.3, z + i * 0.3) * Math.PI * 2;
          const dist = this.perlin2D(x - i * 0.3, z - i * 0.3) * (scale * this.data.foliageRadius);
          
          // Position using noise values
          const posX = x + Math.cos(angle) * dist;
          const posZ = z + Math.sin(angle) * dist;
          const heightOffset = (scale * this.data.foliageRadius - dist) * 0.5;
          // Add 2 units to match trunk lift, then lower foliage
          const posY = y + (this.data.trunkSegments * scale) + heightOffset + 2 - foliageLowering;
          
          // Create tilted hexagons with deterministic twist
          matrix.identity();
          matrix.makeScale(
              scale * this.data.foliageScale, 
              scale * this.data.foliageHeight, 
              scale * this.data.foliageScale
          );
          
          // Tilt based on distance from trunk
          const tiltAngle = (dist / (scale * this.data.foliageRadius)) * this.data.foliageTilt * Math.PI;
          const tiltMatrix = new THREE.Matrix4().makeRotationX(tiltAngle);
          matrix.multiply(tiltMatrix);
          
          // Use noise for deterministic twist, sampling at different frequency
          const twist = this.perlin2D(x * 0.05 + i * 0.7, z * 0.05) * Math.PI * 0.2;
          rotationMatrix.makeRotationY(angle + twist);
          matrix.multiply(rotationMatrix);
          
          matrix.setPosition(posX, posY, posZ);
          
          this.foliageMesh.setMatrixAt(foliageIndex, matrix);
      }
      
      this.trunkMesh.instanceMatrix.needsUpdate = true;
      this.foliageMesh.instanceMatrix.needsUpdate = true;
      
      if (this.activeTreeCount === 0) {
          console.log(`Tree placed at: x=${x}, y=${y}, z=${z}, noise=${noiseValue}`);
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
    }
  });
  
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