// Day-night cycle system for hexagonal world

AFRAME.registerComponent('hex-day-night-cycle', {
  schema: {
    cycleLength: { type: 'number', default: 300 }, // Cycle length in seconds
    dayColor: { type: 'color', default: '#A2DDFF' }, // Sky color during day
    nightColor: { type: 'color', default: '#01111F' }, // Sky color during night
    sunIntensity: { type: 'number', default: 1.0 }, // Intensity of sunlight
    moonIntensity: { type: 'number', default: 0.3 }, // Intensity of moonlight
    transitionTime: { type: 'number', default: 15 } // Transition duration in seconds
  },

  init: function() {
    // Get references to elements we need to modify
    this.sky = document.querySelector('a-sky');
    this.scene = document.querySelector('a-scene');
    this.sunLight = document.querySelector('#hamlet');
    
    // If sunLight doesn't exist, create it
    if (!this.sunLight) {
      this.sunLight = document.createElement('a-entity');
      this.sunLight.id = 'hamlet';
      this.sunLight.setAttribute('light', {
        type: 'directional',
        color: '#FFEEDD',
        intensity: this.data.sunIntensity,
        castShadow: true
      });
      this.sunLight.setAttribute('position', '0 100 0');
      this.scene.appendChild(this.sunLight);
    }
    
    // Create ambient light for night
    this.ambientLight = document.createElement('a-entity');
    this.ambientLight.setAttribute('light', {
      type: 'ambient',
      color: '#445E7F',
      intensity: 0.2
    });
    this.scene.appendChild(this.ambientLight);
    
    // Initialize state
    this.time = 0; // Starts at dawn
    this.dayState = 'day'; // 'day', 'dusk', 'night', 'dawn'
    this.isNight = false;
    
    // Convert colors to THREE.Color objects for interpolation
    this.dayColorObj = new THREE.Color(this.data.dayColor);
    this.nightColorObj = new THREE.Color(this.data.nightColor);
    this.currentColor = this.dayColorObj.clone();
    
    // Apply initial settings
    this.updateEnvironment();
  },
  
  tick: function(time, deltaTime) {
    // Update cycle time (in seconds)
    this.time = (this.time + (deltaTime / 1000)) % this.data.cycleLength;
    
    // Calculate cycle progress (0 to 1)
    const cycleProgress = this.time / this.data.cycleLength;
    
    // Determine day state
    const transitionFraction = this.data.transitionTime / this.data.cycleLength;
    
    if (cycleProgress < 0.25 - transitionFraction/2) {
      // Full day
      if (this.dayState !== 'day') {
        this.dayState = 'day';
        this.isNight = false;
        // Emit event for other components
        this.el.emit('timeChange', { state: 'day', isNight: false });
      }
    } else if (cycleProgress < 0.25 + transitionFraction/2) {
      // Dusk transition
      if (this.dayState !== 'dusk') {
        this.dayState = 'dusk';
        // Emit event for other components
        this.el.emit('timeChange', { state: 'dusk', isNight: false });
      }
      
      // Calculate transition progress
      const duskProgress = (cycleProgress - (0.25 - transitionFraction/2)) / transitionFraction;
      this.updateTransition(duskProgress, false);
      
    } else if (cycleProgress < 0.75 - transitionFraction/2) {
      // Full night
      if (this.dayState !== 'night') {
        this.dayState = 'night';
        this.isNight = true;
        // Emit event for other components
        this.el.emit('timeChange', { state: 'night', isNight: true });
      }
    } else if (cycleProgress < 0.75 + transitionFraction/2) {
      // Dawn transition
      if (this.dayState !== 'dawn') {
        this.dayState = 'dawn';
        // Emit event for other components
        this.el.emit('timeChange', { state: 'dawn', isNight: true });
      }
      
      // Calculate transition progress
      const dawnProgress = (cycleProgress - (0.75 - transitionFraction/2)) / transitionFraction;
      this.updateTransition(dawnProgress, true);
      
    } else {
      // Back to full day
      if (this.dayState !== 'day') {
        this.dayState = 'day';
        this.isNight = false;
        // Emit event for other components
        this.el.emit('timeChange', { state: 'day', isNight: false });
      }
    }
    
    // Update light position based on time (sun circles the scene)
    const lightAngle = cycleProgress * Math.PI * 2;
    const radius = 200;
    const height = 100 * Math.sin(lightAngle);
    const xPos = radius * Math.cos(lightAngle);
    const zPos = radius * Math.sin(lightAngle);
    
    // Update light position
    if (this.sunLight && this.sunLight.object3D) {
      this.sunLight.setAttribute('position', `${xPos} ${Math.max(10, height)} ${zPos}`);
    }
    
    // Update environment based on current state
    this.updateEnvironment();
  },
  
  updateTransition: function(progress, isDawn) {
    // Interpolate between day and night
    if (isDawn) {
      // Dawn: night to day
      this.currentColor.copy(this.nightColorObj).lerp(this.dayColorObj, progress);
      
      // Update light intensity
      if (this.sunLight) {
        const intensity = this.data.moonIntensity + (this.data.sunIntensity - this.data.moonIntensity) * progress;
        this.sunLight.setAttribute('light', 'intensity', intensity);
      }
      
      // Update ambient light
      if (this.ambientLight) {
        const ambientIntensity = 0.2 - 0.1 * progress;
        this.ambientLight.setAttribute('light', 'intensity', ambientIntensity);
      }
      
    } else {
      // Dusk: day to night
      this.currentColor.copy(this.dayColorObj).lerp(this.nightColorObj, progress);
      
      // Update light intensity
      if (this.sunLight) {
        const intensity = this.data.sunIntensity - (this.data.sunIntensity - this.data.moonIntensity) * progress;
        this.sunLight.setAttribute('light', 'intensity', intensity);
      }
      
      // Update ambient light
      if (this.ambientLight) {
        const ambientIntensity = 0.1 + 0.1 * progress;
        this.ambientLight.setAttribute('light', 'intensity', ambientIntensity);
      }
    }
  },
  
  updateEnvironment: function() {
    // Update sky color
    if (this.sky) {
      this.sky.setAttribute('color', '#' + this.currentColor.getHexString());
    }
    
    // Update fog color
    if (this.scene) {
      this.scene.setAttribute('fog', {
        type: 'exponential',
        color: '#' + this.currentColor.getHexString(),
        density: this.isNight ? 0.012 : 0.007
      });
    }
    
    // Update light color
    if (this.sunLight) {
      const lightColor = this.isNight ? '#445E7F' : '#FFEEDD';
      this.sunLight.setAttribute('light', 'color', lightColor);
    }
  }
});
