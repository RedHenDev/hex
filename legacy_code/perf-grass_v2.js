// Hi mom.

AFRAME.registerComponent('grass-system', {
    schema: {
      chunkSize: { type: 'number', default: 64 },           // Size of each grass chunk
      renderDistance: { type: 'number', default: 96 },      // Distance from player to render grass
      instancesPerChunk: { type: 'number', default: 4000 },// Number of grass blades per chunk
      updateThreshold: { type: 'number', default: 32 },     // Distance threshold for chunk updates
      minHeight: { type: 'number', default: 0.8 },          // Minimum height of grass blades
      maxHeight: { type: 'number', default: 1.5 },          // Maximum height of grass blades
      dayColor: { type: 'color', default: '#00C200' },      // Daytime grass color (bright green)
      nightColor: { type: 'color', default: '#16161D' },    // Nighttime grass color (dark)
      baseColor: { type: 'color', default: '#00C200' },     // Base color, updated by day/night mode
      chunksPerFrame: { type: 'number', default: 2 },       // Number of chunks to process per frame
      colorVariation: { type: 'number', default: 0.1 },    // Small color variation for realism
      isNightMode: { type: 'boolean', default: false }      // Toggle for night mode
    },
  
    init: function () {
      this.chunks = new Map(); // Store active grass chunks
      this.lastUpdatePosition = new THREE.Vector3(); // Last position for update checks
      this.chunkQueue = []; // Queue for chunk generation
      this.isProcessingQueue = false; // Flag for queue processing
  
      // Define single triangle geometry for grass blades
      this.geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        -0.15, 0, 0,  // Bottom left
        0.15, 0, 0,   // Bottom right
        0, 0.8, 0     // Top center
      ]);
      this.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  
      // Set initial base color based on day/night mode
      this.data.baseColor = this.data.isNightMode ? this.data.nightColor : this.data.dayColor;
      this.material = new THREE.MeshBasicMaterial({
        color: this.data.baseColor,
        side: THREE.DoubleSide // Render both sides of the triangle
      });
      this.baseColorVector = new THREE.Color(this.data.baseColor);
  
      // External dependencies
      this.getHeight = getTerrainHeight; // Assumes a global terrain height function
      this.player = this.el.sceneEl.querySelector('#player').object3D; // Player object
      window.grassSystem = this; // Expose component globally for debugging
  
      // Initialize chunks if player exists
      if (this.player) {
        this.queueInitialChunks();
        this.lastUpdatePosition.copy(this.player.position);
      }
    },
  
    // **Toggle Day/Night Mode**
    setNightMode: function () {
      this.data.isNightMode = true;
      this.data.baseColor = this.data.nightColor;
      this.updateExistingGrassColors();
    },
  
    setDayMode: function () {
      this.data.isNightMode = false;
      this.data.baseColor = this.data.dayColor;
      this.updateExistingGrassColors();
    },
  
    updateExistingGrassColors: function () {
      this.chunks.forEach(chunk => {
        chunk.instancedMesh.material.color.set(this.data.baseColor);
      });
    },
  
    // **Chunk Management**
    queueInitialChunks: function () {
      const chunkSize = this.data.chunkSize;
      const renderDistance = this.data.renderDistance;
      const playerX = this.player.position.x;
      const playerZ = this.player.position.z;
      const chunkX = Math.floor(playerX / chunkSize);
      const chunkZ = Math.floor(playerZ / chunkSize);
      const chunkRadius = Math.ceil(renderDistance / chunkSize);
  
      for (let i = chunkX - chunkRadius; i <= chunkX + chunkRadius; i++) {
        for (let j = chunkZ - chunkRadius; j <= chunkZ + chunkRadius; j++) {
          this.chunkQueue.push({ i, j });
        }
      }
      this.startQueueProcessing();
    },
  
    startQueueProcessing: function () {
      if (!this.isProcessingQueue) {
        this.isProcessingQueue = true;
        this.processChunkQueue();
      }
    },
  
    processChunkQueue: function () {
      if (this.chunkQueue.length === 0) {
        this.isProcessingQueue = false;
        return;
      }
  
      const chunksThisFrame = Math.min(this.data.chunksPerFrame, this.chunkQueue.length);
      for (let k = 0; k < chunksThisFrame; k++) {
        const { i, j } = this.chunkQueue.shift();
        if (!this.chunks.has(`${i},${j}`)) {
          this.generateChunk(i, j);
        }
      }
      requestAnimationFrame(() => this.processChunkQueue());
    },
  
    // **Update Loop**
    tick: function () {
      if (!this.player) return;
      this.updateChunks();
    },
  
    updateChunks: function () {
      const chunkSize = this.data.chunkSize;
      const renderDistance = this.data.renderDistance;
      const playerPos = this.player.position;
  
      if (playerPos.distanceTo(this.lastUpdatePosition) < this.data.updateThreshold) return;
  
      const chunkX = Math.floor(playerPos.x / chunkSize);
      const chunkZ = Math.floor(playerPos.z / chunkSize);
      const chunkRadius = Math.ceil(renderDistance / chunkSize);
  
      const newChunks = new Set();
      for (let i = chunkX - chunkRadius; i <= chunkX + chunkRadius; i++) {
        for (let j = chunkZ - chunkRadius; j <= chunkZ + chunkRadius; j++) {
          const key = `${i},${j}`;
          newChunks.add(key);
          if (!this.chunks.has(key)) {
            this.chunkQueue.push({ i, j });
          }
        }
      }
  
      this.chunks.forEach((_, key) => {
        if (!newChunks.has(key)) {
          this.removeChunk(key);
        }
      });
  
      this.lastUpdatePosition.copy(playerPos);
      this.startQueueProcessing();
    },
  
    // **Chunk Generation**
    generateChunk: function (i, j) {
      const chunkSize = this.data.chunkSize;
      const chunkCenter = new THREE.Vector3((i + 0.5) * chunkSize, 0, (j + 0.5) * chunkSize);
      const distance = this.player.position.distanceTo(chunkCenter);
      const lodFactor = distance < 64 ? 1 : 0.5; // LOD: Reduce instances for distant chunks
      const instances = Math.floor(this.data.instancesPerChunk * lodFactor);
      const positions = [];
      const rotations = [];
      const scales = [];
      const colors = [];
      const normal = new THREE.Vector3();
      const delta = 0.1; // For normal approximation
  
      // Generate grass blade instances
      for (let k = 0; k < instances; k++) {
        const x = (i + Math.random()) * chunkSize;
        const z = (j + Math.random()) * chunkSize;
        const y = this.getHeight(x, z);
        if (y < -11 || (x > 128 && x < 256)) continue; // Skip invalid terrain areas
  
        /*
        // Calculate terrain normal using finite differences
        const h0 = y;
        const h1 = this.getHeight(x + delta, z);
        const h2 = this.getHeight(x, z + delta);
        normal.set((h0 - h1) / delta, 1, (h0 - h2) / delta).normalize();
        */

        positions.push(new THREE.Vector3(x, y, z));
        rotations.push(Math.random() * Math.PI * 2); // Random rotation around Y-axis
        const heightScale = this.data.minHeight + Math.random() * (this.data.maxHeight - this.data.minHeight);
        const widthScale = 0.4 + Math.random() * 0.2;
        scales.push(new THREE.Vector3(widthScale, heightScale, 1));
  
        // Simplified color variation
        const tempColor = new THREE.Color(this.data.baseColor);
        const variation = (Math.random() - 0.5) * this.data.colorVariation;
        tempColor.r += variation;
        tempColor.g += variation;
        tempColor.b += variation;
        colors.push(tempColor);
      }
  
      if (positions.length === 0) return;
  
      // Create instanced mesh
      const chunkMaterial = new THREE.MeshBasicMaterial({
        color: this.data.baseColor,
        side: THREE.DoubleSide
      });
      const instancedMesh = new THREE.InstancedMesh(this.geometry, chunkMaterial, positions.length);
      const matrix = new THREE.Matrix4();
      const dummy = new THREE.Object3D();
  
      // Set per-instance colors
      if (typeof instancedMesh.setColorAt === 'function') {
        for (let k = 0; k < positions.length; k++) {
          instancedMesh.setColorAt(k, colors[k]);
        }
      } else {
        const colorArray = new Float32Array(positions.length * 3);
        for (let k = 0; k < positions.length; k++) {
          const color = colors[k];
          colorArray[k * 3] = color.r;
          colorArray[k * 3 + 1] = color.g;
          colorArray[k * 3 + 2] = color.b;
        }
        const colorAttribute = new THREE.InstancedBufferAttribute(colorArray, 3);
        instancedMesh.geometry.setAttribute('color', colorAttribute);
        chunkMaterial.vertexColors = true;
      }
  
      // Set per-instance transforms with terrain alignment
      positions.forEach((pos, index) => {
        dummy.position.copy(pos);
        dummy.lookAt(dummy.position.clone().add(normal)); // Align to terrain normal
        dummy.scale.copy(scales[index]);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(index, dummy.matrix);
      });
  
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
  
      // Enable frustum culling
      instancedMesh.frustumCulled = true;
      instancedMesh.geometry.computeBoundingSphere();
  
      // Add to scene and store in chunks map
      this.el.sceneEl.object3D.add(instancedMesh);
      this.chunks.set(`${i},${j}`, {
        instancedMesh,
        positions,
        rotations,
        scales,
        colors
      });
    },
  
    // **Chunk Removal**
    removeChunk: function (key) {
      const chunk = this.chunks.get(key);
      if (!chunk) return;
  
      const instancedMesh = chunk.instancedMesh;
      this.el.sceneEl.object3D.remove(instancedMesh);
      instancedMesh.geometry.dispose();
      instancedMesh.material.dispose();
      this.chunks.delete(key);
    },
  
    // **Cleanup**
    remove: function () {
      this.chunks.forEach((chunk) => {
        this.el.sceneEl.object3D.remove(chunk.instancedMesh);
        chunk.instancedMesh.geometry.dispose();
        chunk.instancedMesh.material.dispose();
      });
      this.chunks.clear();
      this.geometry.dispose();
      this.material.dispose();
    }
  });