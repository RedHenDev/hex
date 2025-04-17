// terrain-utils.js - Utility functions for terrain system

// Create our own namespace to avoid conflicts with the original function
window.TerrainUtils = {
  // Height generator instance
  _generator: null,
  
  // Function to get terrain height at any world position
  getTerrainHeight: function(x, z) {
    // If we don't have a terrain generator, create one
    if (!this._generator) {
      console.log("Creating terrain height generator");
      
      // Create a temporary generator with the same seed as the main terrain system
      const scene = document.querySelector('a-scene');
      let seed = 0;
      
      if (scene && scene.components['terrain-manager']) {
        seed = scene.components['terrain-manager'].data.seed;
      } else {
        seed = Math.floor(Math.random() * 1000000);
      }
      
      // Make sure ImprovedNoise is available
      if (typeof ImprovedNoise === 'undefined') {
        console.error('ImprovedNoise is not defined. Make sure improved-noise.js is loaded.');
        return 0;
      }
      
      // Create simplified version of generator just for height sampling
      this._generator = {
        seed: seed,
        noise: ImprovedNoise,
        heightScale: 12.0,
        noiseScale: 0.1,
        baseHeight: 0.2,
        initialized: false,
        
        generateHeight: function(x, z) {
          // Initialize noise if needed
          if (!this.initialized) {
            this.noise.seed(this.seed);
            this.initialized = true;
          }
          
          // Base continent noise
          const continentScale = this.noiseScale * 0.3;
          const baseNoise = this.noise.fbm(x * continentScale, z * continentScale, 6);
          
          // Scale to height range
          let height = this.baseHeight + ((baseNoise + 1) / 2) * this.heightScale;
          
          // Add mountain ranges where applicable
          height = this.applyMountainRanges(x, z, height);
          
          // Add medium-scale features
          const mediumScale = this.noiseScale * 2;
          const mediumNoise = this.noise.perlin2(x * mediumScale, z * mediumScale);
          height += mediumNoise * this.heightScale * 0.3;
          
          // Add small-scale features
          const smallScale = this.noiseScale * 4;
          const smallNoise = this.noise.perlin2(x * smallScale, z * smallScale);
          height += smallNoise * this.heightScale * 0.1;
          
          return height;
        },
        
        // Apply mountain ranges for more varied terrain
        applyMountainRanges: function(x, z, currentHeight) {
          // Define a few mountain ranges
          const ranges = [
            { centerX: 100, centerZ: 100, radius: 300, angle: Math.PI/4, intensity: 0.7 },
            { centerX: -200, centerZ: 50, radius: 400, angle: Math.PI/2, intensity: 0.8 },
            { centerX: 50, centerZ: -300, radius: 350, angle: 0, intensity: 0.6 }
          ];
          
          let height = currentHeight;
          
          // Check each mountain range
          for (const range of ranges) {
            const dx = x - range.centerX;
            const dz = z - range.centerZ;
            
            // Rotate coordinates to align with mountain range
            const angle = range.angle;
            const cosAngle = Math.cos(angle);
            const sinAngle = Math.sin(angle);
            
            const rotatedX = dx * cosAngle - dz * sinAngle;
            const rotatedZ = dx * sinAngle + dz * cosAngle;
            
            // Use elliptical distance for elongated ranges
            const distanceAlongRange = Math.abs(rotatedX / (range.radius * 2));
            const distanceAcrossRange = Math.abs(rotatedZ / (range.radius * 0.5));
            const ellipticalDistance = Math.sqrt(distanceAlongRange * distanceAlongRange + 
                                              distanceAcrossRange * distanceAcrossRange);
            
            // Calculate influence weight
            const weight = Math.max(0, 1 - ellipticalDistance);
            
            if (weight > 0) {
              // Add mountain height
              const ridgeNoise = this.noise.ridgedMulti(
                x * this.noiseScale * 1.5, 
                z * this.noiseScale * 1.5, 
                4
              );
              
              const mountainHeight = ridgeNoise * this.heightScale * range.intensity;
              height += mountainHeight * weight;
            }
          }
          
          return height;
        }
      };
      
      // Initialize the noise
      this._generator.noise.seed(this._generator.seed);
      this._generator.initialized = true;
    }
    
    // Use the generator to get height at this position
    return this._generator.generateHeight(x, z);
  }
};

// Create a global function that's used in the terrain-manager component
window.generateTerrainHeight = function(x, z) {
  return window.TerrainUtils.getTerrainHeight(x, z);
};