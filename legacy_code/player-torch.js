// Player Torch Light System
// Adds a red torch light to the player during night time

document.addEventListener('DOMContentLoaded', () => {
  // Wait for the scene to load
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      // Create torch light system
      const torchEntity = document.createElement('a-entity');
      torchEntity.setAttribute('id', 'player-torch-system');
      torchEntity.setAttribute('player-torch', '');
      scene.appendChild(torchEntity);
      console.log('Player torch system initialized');
    });
  }
});

AFRAME.registerComponent('player-torch', {
  schema: {
    enabled: { type: 'boolean', default: true },
    color: { type: 'color', default: '#FF3333' },
    intensity: { type: 'number', default: 8.0 },
    distance: { type: 'number', default: 15 },
    angle: { type: 'number', default: 70 },
    penumbra: { type: 'number', default: 0.4 },
    decay: { type: 'number', default: 1.5 },
    castShadow: { type: 'boolean', default: true },
    position: { type: 'vec3', default: { x: 0, y: -0.5, z: -0.5 } },
    flickerSpeed: { type: 'number', default: 8 },
    flickerIntensity: { type: 'number', default: 0.2 }
  },
  
  init: function() {
    // Create torch light entity
    this.torchLight = document.createElement('a-entity');
    this.torchLight.setAttribute('id', 'player-torch-light');
    this.torchLight.setAttribute('light', {
      type: 'spot',
      color: this.data.color,
      intensity: this.data.intensity,
      distance: this.data.distance,
      angle: this.data.angle,
      penumbra: this.data.penumbra,
      decay: this.data.decay,
      castShadow: this.data.castShadow
    });
    
    // Position the light for torch-like appearance
    this.torchLight.setAttribute('position', this.data.position);
    
    // Find the camera to attach the torch to
    this.camera = document.querySelector('#cam');
    if (!this.camera) {
      console.warn('Player torch: Could not find camera with id #cam');
      return;
    }
    
    // Attach to camera so it moves with player view
    this.camera.appendChild(this.torchLight);
    
    // Hide torch initially (assuming we start in day mode)
    this.torchLight.setAttribute('visible', false);
    this.torchLight.setAttribute('light', 'intensity', 0);
    
    // Add this system to the global scope so day-night-cycle can access it
    window.torchSystem = this;
    
    // Connect to day-night cycle if it exists
    this.connectToDayNightCycle();
    
    // Start flickering effect
    this.lastFlickerTime = 0;
    this.baseIntensity = this.data.intensity;
    this.isActive = false;
    
    console.log('Player torch ready');
  },
  
  connectToDayNightCycle: function() {
    // Find the day-night-cycle component
    const dayNightCycle = document.querySelector('#day-night-cycle');
    
    if (dayNightCycle && dayNightCycle.components['day-night-cycle']) {
      console.log('Player torch connected to day-night cycle');
      
      // If the day-night cycle is already initialized, check its current state
      const cycleComponent = dayNightCycle.components['day-night-cycle'];
      if (cycleComponent.isNight) {
        this.activate();
      }
      
      // Add this torch component to the original day-night-cycle methods
      const originalCompleteNight = cycleComponent.completeNightTransition;
      cycleComponent.completeNightTransition = function() {
        originalCompleteNight.call(this);
        if (window.torchSystem) {
          window.torchSystem.activate();
        }
      };
      
      const originalCompleteDay = cycleComponent.completeDayTransition;
      cycleComponent.completeDayTransition = function() {
        originalCompleteDay.call(this);
        if (window.torchSystem) {
          window.torchSystem.deactivate();
        }
      };
      
      // Also hook into the transition functions to gradually show/hide torch
      const originalNightTransition = cycleComponent.transitionToNight;
      cycleComponent.transitionToNight = function(progress) {
        originalNightTransition.call(this, progress);
        if (window.torchSystem) {
          window.torchSystem.updateTransition(progress, true);
        }
      };
      
      const originalDayTransition = cycleComponent.transitionToDay;
      cycleComponent.transitionToDay = function(progress) {
        originalDayTransition.call(this, progress);
        if (window.torchSystem) {
          window.torchSystem.updateTransition(progress, false);
        }
      };
    } else {
      // If day-night cycle doesn't exist yet, try again in a moment
      setTimeout(() => this.connectToDayNightCycle(), 1000);
    }
  },
  
  activate: function() {
    // Show torch light
    this.torchLight.setAttribute('visible', true);
    this.torchLight.setAttribute('light', 'intensity', this.baseIntensity);
    this.isActive = true;
    console.log('Torch activated');
  },
  
  deactivate: function() {
    // Hide torch light
    this.torchLight.setAttribute('visible', false);
    this.torchLight.setAttribute('light', 'intensity', 0);
    this.isActive = false;
    console.log('Torch deactivated');
  },
  
  updateTransition: function(progress, toNight) {
    if (toNight) {
      // Gradually increase intensity during transition to night
      const intensity = progress * this.baseIntensity;
      this.torchLight.setAttribute('light', 'intensity', intensity);
      if (progress > 0.1) {
        this.torchLight.setAttribute('visible', true);
      }
    } else {
      // Gradually decrease intensity during transition to day
      const intensity = (1 - progress) * this.baseIntensity;
      this.torchLight.setAttribute('light', 'intensity', intensity);
      if (progress > 0.9) {
        this.torchLight.setAttribute('visible', false);
      }
    }
  },
  
  tick: function(time, delta) {
    // Skip if torch is not active or delta is not available
    if (!this.isActive || !delta || !this.data.enabled) return;
    
    // Add flickering effect to make the torch feel more realistic
    const flickerTime = time * 0.001 * this.data.flickerSpeed;
    const flicker = Math.sin(flickerTime) * this.data.flickerIntensity;
    const noise = (Math.random() - 0.5) * 0.1; // Small random variation
    
    const newIntensity = this.baseIntensity + flicker + noise;
    this.torchLight.setAttribute('light', 'intensity', Math.max(0.5, newIntensity));
  },
  
  remove: function() {
    // Clean up
    if (this.torchLight && this.torchLight.parentNode) {
      this.torchLight.parentNode.removeChild(this.torchLight);
    }
    
    // Remove global reference
    delete window.torchSystem;
  }
});
