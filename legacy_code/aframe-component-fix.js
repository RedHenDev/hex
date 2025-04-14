// renderer-fix.js - An A-Frame component to fix the lighting warnings

// Register this component as a system that runs before other components
AFRAME.registerSystem('renderer-fix', {
  // This runs once when the scene is initialized
  init: function() {
    console.log('Renderer fix system initializing');
    
    // Fix the warning by monkey-patching THREE.WebGLRenderer
    const originalWGLRendererConstructor = THREE.WebGLRenderer;
    
    // Replace the constructor with our patched version
    THREE.WebGLRenderer = function(parameters) {
      // Call the original constructor
      const renderer = new originalWGLRendererConstructor(parameters);
      
      // Explicitly configure modern lighting settings
      if (renderer.useLegacyLights !== undefined) {
        // The mere act of accessing this property causes the warning,
        // so we'll do it only once and then delete the property
        const value = renderer.useLegacyLights;
        delete renderer.useLegacyLights;
        
        // Define a non-enumerable property that won't trigger the warning
        Object.defineProperty(renderer, 'useLegacyLights', {
          get: function() { return false; },
          set: function() { /* do nothing */ },
          configurable: true
        });
      }
      
      // Handle newer THREE.js versions
      if (renderer.physicallyCorrectLights !== undefined) {
        renderer.physicallyCorrectLights = true;
      }
      
      return renderer;
    };
    
    // Copy all static properties from the original constructor
    for (const prop in originalWGLRendererConstructor) {
      if (originalWGLRendererConstructor.hasOwnProperty(prop)) {
        THREE.WebGLRenderer[prop] = originalWGLRendererConstructor[prop];
      }
    }
    
    // Copy the prototype properties
    THREE.WebGLRenderer.prototype = originalWGLRendererConstructor.prototype;
    
    // Fix the constructor property
    THREE.WebGLRenderer.prototype.constructor = THREE.WebGLRenderer;
    
    console.log('WebGLRenderer patched to suppress useLegacyLights warning');
  }
});

// Register a scene component to fix any existing renderer
AFRAME.registerComponent('renderer-fix', {
  // This is the minimal component to add to a-scene
  init: function() {
    // Do nothing here - the system handles everything
  }
});
