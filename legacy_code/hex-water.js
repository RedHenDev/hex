// Simplified water system for the hexagonal terrain

AFRAME.registerComponent('hex-water-system', {
  schema: {
    waterLevel: { type: 'number', default: -12 }, // Match to hex-terrain-generator waterLevel
    waterColor: { type: 'color', default: '#3B93D4' },
    size: { type: 'number', default: 1000 }
  },

  init: function() {
    this.player = document.querySelector('#player').object3D;
    this.createWaterPlane();
    
    // Listen for day/night cycle changes if implemented
    this.el.sceneEl.addEventListener('timeChange', this.updateWaterLighting.bind(this));
  },
  
  createWaterPlane: function() {
    // Create a large, flat plane for water
    const geometry = new THREE.PlaneGeometry(this.data.size, this.data.size, 1, 1);
    geometry.rotateX(-Math.PI / 2); // Rotate to be horizontal
    
    // Water material with transparency and reflectivity
    const material = new THREE.MeshStandardMaterial({
      color: this.data.waterColor,
      transparent: true,
      opacity: 0.75,
      roughness: 0.1,
      metalness: 0.6,
      flatShading: false
    });
    
    this.waterMesh = new THREE.Mesh(geometry, material);
    this.waterMesh.position.y = this.data.waterLevel;
    
    // Add to scene
    this.el.object3D.add(this.waterMesh);
  },
  
  updateWaterLighting: function(event) {
    // Respond to day/night cycle if implemented
    if (event && event.detail && event.detail.isNight) {
      // Darker water color at night
      this.waterMesh.material.color.set('#1A4978');
      this.waterMesh.material.opacity = 0.85;
    } else {
      // Default water color during day
      this.waterMesh.material.color.set(this.data.waterColor);
      this.waterMesh.material.opacity = 0.75;
    }
  },
  
  tick: function() {
    if (!this.player) return;
    
    // Keep water plane centered on player
    this.waterMesh.position.x = this.player.position.x;
    this.waterMesh.position.z = this.player.position.z;
    this.waterMesh.position.y = this.data.waterLevel;
    
    // Optional: Add subtle animation to water surface
    const time = Date.now() * 0.0002;
    this.waterMesh.material.opacity = 0.7 + Math.sin(time) * 0.05;
  }
});
