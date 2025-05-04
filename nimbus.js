// Optimized Cloud System for Eigenlite Vibe
// Uses instancing and billboarding for dramatically improved performance

document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.addEventListener('loaded', () => {
        const cloudSystemEntity = document.createElement('a-entity');
        cloudSystemEntity.setAttribute('id', 'nimbus');
        cloudSystemEntity.setAttribute('nimbus', '');
        scene.appendChild(cloudSystemEntity);
        console.log('Optimized cloud system initialized');
      });
    }
  });
  
  AFRAME.registerComponent('nimbus', {
    schema: {
      enabled: { default: true },
      // Cloud distribution
      totalClouds: { type: 'number', default: 81 }, // Total cloud instances.
      skyRadius: { type: 'number', default: 820 }, // 720.
      cloudBaseHeight: { type: 'number', default: 2142 }, //2100.
      heightRange: { type: 'number', default: 32 },
      // Visual properties
      cloudColor: { type: 'color', default: '#DDDDDD' },
      // Optimization settings
      useInstancing: { type: 'boolean', default: true },
      useBillboards: { type: 'boolean', default: false },
      maxVisibleDistance: { type: 'number', default: 8000 },
      updateFrequency: { type: 'number', default: 1 } // Update every N frames
    },
  
    init: function() {
      this.player = document.querySelector('#subject').object3D;
      this.clouds = [];
      this.frameCounter = 0;
      
      // Create the cloud container
      this.cloudContainer = new THREE.Group();
      this.el.setObject3D('cloudGroup', this.cloudContainer);
      
      // Create our cloud systems
      if (this.data.useInstancing) {
        this.initInstancedClouds();
      } else if (this.data.useBillboards) {
        this.initBillboardClouds();
      } else {
        this.initSimpleClouds();
      }
    },
    
    initInstancedClouds: function() {
      // Create a simple puff geometry that will be instanced
      const puffGeometry = new THREE.SphereGeometry(1, 8, 6); // Reduced poly count
      
      // Create a material with custom shader for soft edges
      const cloudMaterial = new THREE.MeshBasicMaterial({
        color: this.data.cloudColor,
        transparent: true,  // Enable transparency if you want soft edges
        opacity: 0.6,       // Slightly transparent for softer look
        side: THREE.DoubleSide,  // Visible from both sides
        depthWrite: false    // Prevents z-fighting between overlapping clouds
    });
      
      // Create instanced mesh for small clouds (more numerous, smaller)
      const smallCloudCount = Math.floor(this.data.totalClouds * 0.7);
      this.smallCloudMesh = new THREE.InstancedMesh(
        puffGeometry,
        cloudMaterial,
        smallCloudCount
      );
      
      // Create instanced mesh for medium clouds
      const mediumCloudCount = Math.floor(this.data.totalClouds * 0.2);
      this.mediumCloudMesh = new THREE.InstancedMesh(
        puffGeometry,
        cloudMaterial.clone(),
        mediumCloudCount
      );
      
      // Create instanced mesh for large clouds (fewer, larger)
      const largeCloudCount = Math.floor(this.data.totalClouds * 0.1);
      this.largeCloudMesh = new THREE.InstancedMesh(
        puffGeometry,
        cloudMaterial.clone(),
        largeCloudCount
      );
      
      // Add meshes to scene
      this.cloudContainer.add(this.smallCloudMesh);
      this.cloudContainer.add(this.mediumCloudMesh);
      this.cloudContainer.add(this.largeCloudMesh);
      
      // Set up cloud instances.
      this.setupCloudInstances(this.smallCloudMesh, 20, 40, 0.5);
      this.setupCloudInstances(this.mediumCloudMesh, 60, 90, 1.0);
      // min = 120, max 160.
      this.setupCloudInstances(this.largeCloudMesh, 220, 260, 2.0);
      
      console.log(`Created cloud system with ${this.data.totalClouds} instanced clouds`);
    },
    
    setupCloudInstances: function(instancedMesh, minSize, maxSize, heightFactor) {
      const count = instancedMesh.count;
      const dummy = new THREE.Object3D();
      const skyRadius = this.data.skyRadius;
      
      // Store cloud data for animation
      const cloudData = [];
      
      for (let i = 0; i < count; i++) {
        // Generate random position in hemisphere
        const theta = Math.random() * Math.PI * 2;
        const distance = skyRadius * (0.2 + Math.random() * 0.8);
        const height = this.data.cloudBaseHeight + 
                     (Math.random() * this.data.heightRange * heightFactor);
        
        const x = Math.cos(theta) * distance;
        const y = height;
        const z = Math.sin(theta) * distance;
        
        // Random size
        const size = minSize + Math.random() * (maxSize - minSize);
        const scaleX = size * (0.8 + Math.random() * 0.4);
        const scaleY = size * (0.4 + Math.random() * 0.3);
        const scaleZ = size * (0.8 + Math.random() * 0.4);
        
        // Set position and scale
        dummy.position.set(x, y, z);
        dummy.scale.set(scaleX, scaleY, scaleZ);
        dummy.rotation.set(
          Math.random() * 0.2 - 0.1,
          Math.random() * Math.PI * 2,
          Math.random() * 0.2 - 0.1
        );
        
        // Apply to instanced mesh
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        
        // Store cloud data for animation
        cloudData.push({
          index: i,
          basePosition: new THREE.Vector3(x, y, z),
          speed: 0.1 + Math.random() * 0.2,
          phase: Math.random() * Math.PI * 2,
          amplitude: 2 + Math.random() * 4
        });
      }
      
      instancedMesh.instanceMatrix.needsUpdate = true;
      
      // Store for animation updates
      this.clouds.push({
        mesh: instancedMesh,
        cloudData: cloudData
      });
    },
    
    initBillboardClouds: function() {
      // Create a cloud texture atlas (would normally load this)
      // Here we create a simple procedural texture for clouds
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      
      // Draw a simple cloud shape
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(64, 64, 32, 0, Math.PI * 2);
      ctx.fill();
      
      // Create a softer edge with radial gradient
      const gradient = ctx.createRadialGradient(64, 64, 16, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      
      // Create billboard material with the texture
      const billboardMaterial = new THREE.SpriteMaterial({
        map: texture,
        color: this.data.cloudColor,
        transparent: true,
        opacity: 0.7,
        depthWrite: false
      });
      
      // Create sprites and position them around sky
      for (let i = 0; i < this.data.totalClouds; i++) {
        // Create sprite
        const sprite = new THREE.Sprite(billboardMaterial.clone());
        
        // Random position in sky hemisphere
        const theta = Math.random() * Math.PI * 2;
        const distance = this.data.skyRadius * (0.3 + Math.random() * 0.7);
        const height = this.data.cloudBaseHeight + (Math.random() * this.data.heightRange);
        
        sprite.position.x = Math.cos(theta) * distance;
        sprite.position.y = height;
        sprite.position.z = Math.sin(theta) * distance;
        
        // Random size based on distance
        const size = 30 + Math.random() * 120;
        sprite.scale.set(size, size * 0.6, 1);
        
        // Add to container
        this.cloudContainer.add(sprite);
        
        // Store cloud data for animation
        this.clouds.push({
          sprite: sprite,
          basePosition: sprite.position.clone(),
          speed: 0.1 + Math.random() * 0.2,
          phase: Math.random() * Math.PI * 2,
          amplitude: 2 + Math.random() * 4
        });
      }
      
      console.log(`Created cloud system with ${this.data.totalClouds} billboard clouds`);
    },
    
    initSimpleClouds: function() {
      // Fallback method that creates simplified clouds
      const cloudGeometry = new THREE.SphereGeometry(1, 8, 6);
      const cloudMaterial = new THREE.MeshStandardMaterial({
        color: this.data.cloudColor,
        transparent: true,
        opacity: 0.7,
        roughness: 0.8,
        metalness: 0.1
      });
      
      for (let i = 0; i < this.data.totalClouds; i++) {
        // Create mesh
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial.clone());
        
        // Random position in sky hemisphere
        const theta = Math.random() * Math.PI * 2;
        const distance = this.data.skyRadius * (0.3 + Math.random() * 0.7);
        const height = this.data.cloudBaseHeight + (Math.random() * this.data.heightRange);
        
        cloud.position.x = Math.cos(theta) * distance;
        cloud.position.y = height;
        cloud.position.z = Math.sin(theta) * distance;
        
        // Random size
        const size = 30 + Math.random() * 70;
        cloud.scale.set(size, size * 0.5, size);
        
        // Add to container
        this.cloudContainer.add(cloud);
        
        // Store cloud data for animation
        this.clouds.push({
          mesh: cloud,
          basePosition: cloud.position.clone(),
          speed: 0.1 + Math.random() * 0.2,
          phase: Math.random() * Math.PI * 2,
          amplitude: 2 + Math.random() * 4
        });
      }
    },
    
    tick: function(time, delta) {
      if (!this.data.enabled || !delta) return;
      
      // Update only on certain frames for performance
      this.frameCounter = (this.frameCounter + 1) % this.data.updateFrequency;
      if (this.frameCounter !== 0) return;
      
      // Time factor for animation
      const t = time * 0.0005;
      
      // Update based on implementation type
      if (this.data.useInstancing) {
        this.updateInstancedClouds(t);
      } else if (this.data.useBillboards || !this.data.useInstancing) {
        this.updateRegularClouds(t);
      }
      
      // Optional: reposition cloud system to follow player for infinite sky effect
      if (this.player) {
        this.cloudContainer.position.x = this.player.position.x;
        this.cloudContainer.position.z = this.player.position.z;
      }
    },
    
    updateInstancedClouds: function(time) {
      const dummy = new THREE.Object3D();
      
      this.clouds.forEach(cloudGroup => {
        const mesh = cloudGroup.mesh;
        const cloudData = cloudGroup.cloudData;
        let needsUpdate = false;
        
        cloudData.forEach(cloud => {
          // Get existing transform
          mesh.getMatrixAt(cloud.index, dummy.matrix);
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
          
          // Add gentle drifting motion
          const xOffset = Math.sin(time * cloud.speed + cloud.phase) * cloud.amplitude;
          const zOffset = Math.cos(time * cloud.speed + cloud.phase * 0.7) * cloud.amplitude;
          
          // Update position
          dummy.position.x = cloud.basePosition.x + xOffset;
          dummy.position.z = cloud.basePosition.z + zOffset;
          
          // Apply transform
          dummy.updateMatrix();
          mesh.setMatrixAt(cloud.index, dummy.matrix);
          needsUpdate = true;
        });
        
        if (needsUpdate) {
          mesh.instanceMatrix.needsUpdate = true;
        }
      });
    },
    
    updateRegularClouds: function(time) {
      // Update individually created clouds (billboards or regular meshes)
      this.clouds.forEach(cloud => {
        const obj = cloud.sprite || cloud.mesh;
        if (!obj) return;
        
        // Apply simple drifting motion
        obj.position.x = cloud.basePosition.x + 
                        Math.sin(time * cloud.speed + cloud.phase) * cloud.amplitude;
        obj.position.z = cloud.basePosition.z + 
                        Math.cos(time * cloud.speed + cloud.phase * 0.7) * cloud.amplitude;
                        
        // If it's a sprite, always face camera
        if (cloud.sprite) {
          // Billboard rotation happens automatically with sprites
        }
      });
    },
    
    remove: function() {
      // Clean up resources
      if (this.cloudContainer) {
        // Remove all cloud meshes
        while(this.cloudContainer.children.length > 0) { 
          const child = this.cloudContainer.children[0];
          this.cloudContainer.remove(child);
          
          // Properly dispose of geometries and materials
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
        
        // Remove container
        this.el.removeObject3D('cloudGroup');
      }
    }
  });