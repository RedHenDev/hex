// tree-hex.js - Hexagon-based trees that match the terrain aesthetic
// This replaces the cylinder/cone tree models with hexagon geometry to match the terrain

AFRAME.registerComponent('tree-hex-manager', {
  schema: {
    // Pool and placement settings
    maxTrees: { type: 'number', default: 128 },
    poolSize: { type: 'number', default: 512 },
    radius: { type: 'number', default: 800 },
    
    // Noise settings - updated defaults
    noiseThreshold: { type: 'number', default: 0.3 }, // Higher value = fewer trees
    noiseScale: { type: 'number', default: 0.01 }, // Smaller value = more spread out
    
    // Tree overall settings
    // treeHeight seems to be redundant. Remove it?
    treeHeight: { type: 'number', default: 1.0},
    treeScale: { type: 'number', default: 64 },
    
    // Trunk settings
    trunkSegments: { type: 'number', default: 4 },
    trunkBaseRadius: { type: 'number', default: 0.8 },
    trunkTwistFactor: { type: 'number', default: 90 },
    trunkTaper: { type: 'number', default: 0.15 }, // How much trunk narrows per segment
    
    // Foliage settings
    foliageHexCount: { type: 'number', default: 64 },
    foliageScale: { type: 'number', default: 0.4 }, // Scale relative to treeScale
    foliageHeight: { type: 'number', default: 0.6 }, // Height of prisms
    foliageRadius: { type: 'number', default: 3.0 }, // Max distance from trunk
    foliageTilt: { type: 'number', default: 0.45 }, // Max tilt in radians
    
    // Material settings
    trunkEmissive: { type: 'number', default: 0.2 },
    foliageEmissive: { type: 'number', default: 0.4 },
    
    // Debug
    debug: { type: 'boolean', default: false }
  },
  
  init: function () {
    console.log(`Initializing Tree Hex Manager with poolSize: ${this.data.poolSize}, maxTrees: ${this.data.maxTrees}`);
    // Initialize noise first
    this.initializeNoise();
    
    // Then initialize the rest
    this.pool = [];
    this.lastSampledPosition = { x: 0, z: 0 };
    this.needsResampling = true;
    
    // Create shader materials using hex-simple shader
    this.trunkMaterial = this.createShaderMaterial('#00BABA', 0.8, 0.2);
    this.foliageMaterial = this.createShaderMaterial('#11BABA', 0.5, 0.4);
    
    console.log('Materials created:', {
        trunkMaterial: this.trunkMaterial,
        foliageMaterial: this.foliageMaterial
    });
    
    // Create tree pool
    this.createTreePool();
    console.log(`Created tree pool with ${this.data.poolSize * this.data.trunkSegments} trunk instances and ${this.data.poolSize * this.data.foliageHexCount} foliage instances`);
    
    // Debug sphere at origin
    /*
    const debugSphere = document.createElement('a-sphere');
    debugSphere.setAttribute('position', '0 0 0');
    debugSphere.setAttribute('radius', '5');
    debugSphere.setAttribute('color', '#ff0000');
    this.el.sceneEl.appendChild(debugSphere);
    */
    
    /*
    // Modified debug volume with valid color
    const debugVolume = document.createElement('a-box');
    debugVolume.setAttribute('position', '0 0 0');
    debugVolume.setAttribute('width', this.data.radius * 2);
    debugVolume.setAttribute('depth', this.data.radius * 2);
    debugVolume.setAttribute('height', '1');
    debugVolume.setAttribute('color', '#ff0000');
    debugVolume.setAttribute('material', {
        color: '#ff0000',
        opacity: 0.2,
        transparent: true
    });
    this.el.sceneEl.appendChild(debugVolume);
    */
    
    // Setup other components
    this.terrainGenerator = null;
    this.setupTerrainAccess();
    
    document.addEventListener('terrainReady', () => {
      this.setupTerrainAccess();
    });
    
    this.debugTimestamp = 0;
    this.activeTreeCount = 0;
  },

  // Add new method for noise initialization
  initializeNoise: function() {
    this.noise = {
        seed: 99,
        lerp: function(a, b, t) { 
            return a + t * (b - a); 
        },
        grad: function(hash, x, y) {
            const h = hash & 15;
            const grad_x = 1 + (h & 7);
            const grad_y = grad_x & 1 ? 1 : -1;
            return grad_x * x + grad_y * y;
        },
        fade: function(t) { 
            return t * t * t * (t * (t * 6 - 15) + 10); 
        },
        p: new Array(512)
    };
    
    // Initialize permutation table
    const permutation = new Array(256);
    for (let i = 0; i < 256; i++) {
        permutation[i] = i;
    }
    
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
    
    // Resample when moved 5% of radius distance
    return distance > (this.data.radius * 0.05);
  },
  
  tick: function () {
    const subject = document.querySelector('#subject');
    if (!subject || !this.terrainGenerator) return;
    
    const subjectPos = subject.object3D.position;
    
    // Check if we need to resample tree positions
    if (this.needsResampling || this.checkNeedsResampling(subjectPos)) {
        this.sampleTreePositions(subjectPos);
        this.lastSampledPosition = { 
            x: subjectPos.x, 
            z: subjectPos.z 
        };
        this.needsResampling = false;
    }
},

  sampleTreePositions: function(subjectPos) {
    const startTime = performance.now();
    
    // Reset all trees to inactive first
    this.pool.forEach(treeObj => {
        treeObj.active = false;
        
        // Clear matrices for inactive trees by moving them far away
        for (let i = 0; i < this.data.trunkSegments; i++) {
            const matrix = new THREE.Matrix4();
            matrix.setPosition(0, -99999, 0);
            this.trunkMesh.setMatrixAt(treeObj.trunkStart + i, matrix);
        }
        for (let i = 0; i < this.data.foliageHexCount; i++) {
            const matrix = new THREE.Matrix4();
            matrix.setPosition(0, -99999, 0);
            this.foliageMesh.setMatrixAt(treeObj.foliageStart + i, matrix);
        }
    });
    
    // Update matrices after clearing
    this.trunkMesh.instanceMatrix.needsUpdate = true;
    this.foliageMesh.instanceMatrix.needsUpdate = true;
    
    // Reset active count
    this.activeTreeCount = 0;
    
    // Calculate sampling area
    const radius = this.data.radius;
    const gridStep = window.TerrainConfig ? window.TerrainConfig.geometrySize : 4.4;
    
    // Sample positions
    const positions = [];
    let sampledCount = 0;
    
    const minX = Math.floor((subjectPos.x - radius) / gridStep) * gridStep;
    const maxX = Math.floor((subjectPos.x + radius) / gridStep) * gridStep;
    const minZ = Math.floor((subjectPos.z - radius) / gridStep) * gridStep;
    const maxZ = Math.floor((subjectPos.z + radius) / gridStep) * gridStep;
    
    // Sample valid positions with modified noise check
    for (let x = minX; x <= maxX; x += gridStep) {
        for (let z = minZ; z <= maxZ; z += gridStep) {
            const dx = x - subjectPos.x;
            const dz = z - subjectPos.z;
            const distSq = dx * dx + dz * dz;
            
            if (distSq <= radius * radius) {
                sampledCount++;
                const noiseValue = this.perlin2D(x * this.data.noiseScale, z * this.data.noiseScale);
                // Changed comparison: noiseValue must be ABOVE threshold to place tree
                if (noiseValue > this.data.noiseThreshold) {
                    positions.push({ x, z, noise: noiseValue });
                }
            }
        }
    }
    
    // Sort by noise value in DESCENDING order (higher values first)
    positions.sort((a, b) => b.noise - a.noise);
    
    // Sort by noise value and limit to maxTrees
    const selectedPositions = positions.slice(0, this.data.maxTrees);
    
    // Place trees at selected positions
    for (const pos of selectedPositions) {
        const treeObj = this.pool.find(t => !t.active);
        if (!treeObj) continue;
        
        const terrainHeight = this.getTerrainHeight(pos.x, pos.z);
        const y = terrainHeight + (this.data.treeHeight * 0.1);
        
        this.updateTree(treeObj, pos.x, y, pos.z, pos.noise);
        treeObj.active = true;
        treeObj.worldPos = { x: pos.x, z: pos.z };
        this.activeTreeCount++;
    }
    
    console.log(`Placed ${this.activeTreeCount} trees in ${Math.round(performance.now() - startTime)}ms`);
  },

  createTrunkSegments: function(parentEntity, noiseValue, x, z) {
    const segmentHeight = 4;
    const baseRadius = 0.4;
    
    for (let i = 0; i < this.data.trunkSegments; i++) {
        const segment = document.createElement('a-entity');
        
        // Use noise value to determine twist (deterministic)
        const twist = this.perlin2D(x * 0.1 + i, z * 0.1) * this.data.trunkTwistFactor;
        
        segment.setAttribute('geometry', {
            primitive: 'cylinder',
            height: segmentHeight,
            radius: baseRadius * (1 - (i * 0.15)), // Gradually decrease radius
            segmentsRadial: 6
        });
        
        segment.setAttribute('material', this.trunkMaterial);
        segment.setAttribute('position', { x: 0, y: i * segmentHeight, z: 0 });
        segment.setAttribute('rotation', { x: 0, y: twist, z: 0 });
        
        parentEntity.appendChild(segment);
    }
  },

  createFoliageHexagons: function(parentEntity, noiseValue, x, z) {
    const radius = 6;
    const hexSize = 2;
    
    // Create hexagonal pattern positions using noise
    for (let i = 0; i < this.data.foliageHexCount; i++) {
        // Use noise to determine position within foliage area
        const angle = this.perlin2D(x + i * 0.3, z + i * 0.3) * Math.PI * 2;
        const dist = this.perlin2D(x - i * 0.3, z - i * 0.3) * radius;
        
        const hex = document.createElement('a-entity');
        hex.setAttribute('geometry', {
            primitive: 'cylinder',
            height: 0.5,
            radius: hexSize,
            segmentsRadial: 6
        });
        
        // Position hexagon using polar coordinates
        const posX = Math.cos(angle) * dist;
        const posZ = Math.sin(angle) * dist;
        const posY = (radius - dist) * 0.5; // Higher near center
        
        hex.setAttribute('position', { x: posX, y: posY, z: posZ });
        hex.setAttribute('material', this.foliageMaterial);
        
        parentEntity.appendChild(hex);
    }
  },

  // Update tree positioning with instanced mesh
  updateTree: function(treeObj, x, y, z, noiseValue) {
    const matrix = new THREE.Matrix4();
    const scale = this.data.treeScale;
    const rotationMatrix = new THREE.Matrix4();
    
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
        // Add 2 units to match trunk lift
        const posY = y + (this.data.trunkSegments * scale) + heightOffset + 2;
        
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
