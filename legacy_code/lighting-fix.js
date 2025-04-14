// Create a new script file named 'lighting-fix.js' with this content
// Add it to your HTML before any other scripts

console.log("Initializing THREE.js lighting configuration fix...");

// Wait for A-Frame to initialize
document.addEventListener('DOMContentLoaded', function() {
  // Function to override the WebGLRenderer settings
  const fixWebGLRenderer = () => {
    // Make sure A-Frame and THREE are available
    if (typeof AFRAME === 'undefined' || typeof THREE === 'undefined') {
      console.log("Waiting for A-Frame and THREE to be available...");
      setTimeout(fixWebGLRenderer, 100);
      return;
    }

    // Wait for the scene to be ready
    const scene = document.querySelector('a-scene');
    if (!scene || !scene.hasLoaded) {
      if (scene) {
        // Scene exists but hasn't loaded yet, wait for it
        scene.addEventListener('loaded', () => {
          console.log("A-Frame scene loaded, applying WebGLRenderer fix");
          applyFix(scene);
        });
      } else {
        // No scene yet, try again shortly
        console.log("Waiting for A-Frame scene...");
        setTimeout(fixWebGLRenderer, 100);
      }
      return;
    }

    // Scene is already loaded
    console.log("A-Frame scene is already loaded, applying WebGLRenderer fix");
    applyFix(scene);
  };

  // Apply the fix to the THREE.js renderer
  const applyFix = (scene) => {
    try {
      // Access the WebGLRenderer instance used by A-Frame
      const renderer = scene.renderer;
      if (!renderer) {
        console.warn("Could not find A-Frame's WebGLRenderer!");
        return;
      }

      // Modern THREE.js lighting configuration
      THREE.ColorManagement.enabled = true;
      
      // Some versions require this to be explicitly set to false
      if (renderer.useLegacyLights !== undefined) {
        renderer.useLegacyLights = false;
        console.log("Set renderer.useLegacyLights = false");
      }
      
      // In newer versions, this property might be renamed
      if (renderer.physicallyCorrectLights !== undefined) {
        renderer.physicallyCorrectLights = true;
        console.log("Set renderer.physicallyCorrectLights = true");
      }

      // Set output encoding for physically based rendering
      if (THREE.sRGBEncoding) {
        renderer.outputEncoding = THREE.sRGBEncoding;
        console.log("Set renderer output encoding to sRGBEncoding");
      } else if (THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        console.log("Set renderer output color space to SRGBColorSpace");
      }

      console.log("Successfully configured A-Frame's WebGLRenderer for modern lighting");
    } catch (error) {
      console.error("Error applying lighting fix:", error);
    }
  };

  // Start the process
  fixWebGLRenderer();
});
