// Create this as a new file named "hexagon-direct.js"
// This approach directly creates the geometry classes in the proper scope

console.log("Starting direct hexagon geometry registration with THREE...");

// First, verify that THREE is available
if (typeof THREE === 'undefined') {
    console.error("THREE is not available! Cannot register hexagon geometry classes.");
} else {
    console.log("THREE object is available, proceeding with registration...");
    
    // Define the geometry classes directly as properties of THREE
    THREE.HexagonBufferGeometry = class HexagonBufferGeometry extends THREE.BufferGeometry {
        constructor(size = 1, height = 1, flatTop = false) {
            super();
            
            console.log("Creating HexagonBufferGeometry instance with size:", size, "height:", height);
            
            // Store construction parameters
            this.type = 'HexagonBufferGeometry';
            this.parameters = {
                size: size,
                height: height,
                flatTop: flatTop
            };
            
            // Generate vertices for a flat hexagon
            const vertices = [];
            const indices = [];
            const uvs = [];
            const normals = [];
            
            // Center vertex for top and bottom face
            const centerTop = new THREE.Vector3(0, height, 0);
            const centerBottom = new THREE.Vector3(0, 0, 0);
            
            // Hexagon corner points (for top face)
            const topPoints = [];
            const bottomPoints = [];
            
            // Determine the angle based on orientation (flat-top or pointy-top)
            const startAngle = flatTop ? 0 : Math.PI / 6;
            
            // Create the 6 corner vertices for top and bottom
            for (let i = 0; i < 6; i++) {
                const angle = startAngle + (i * Math.PI / 3);
                const x = size * Math.cos(angle);
                const z = size * Math.sin(angle);
                
                topPoints.push(new THREE.Vector3(x, height, z));
                bottomPoints.push(new THREE.Vector3(x, 0, z));
            }
            
            // Add all vertices to the array
            // First add center vertices
            vertices.push(centerTop.x, centerTop.y, centerTop.z); // 0: top center
            vertices.push(centerBottom.x, centerBottom.y, centerBottom.z); // 1: bottom center
            
            // Then add the corner vertices (top, then bottom)
            for (let i = 0; i < 6; i++) {
                vertices.push(topPoints[i].x, topPoints[i].y, topPoints[i].z); // 2-7: top corners
            }
            for (let i = 0; i < 6; i++) {
                vertices.push(bottomPoints[i].x, bottomPoints[i].y, bottomPoints[i].z); // 8-13: bottom corners
            }
            
            // Create top face (6 triangles from center)
            for (let i = 0; i < 6; i++) {
                const nextI = (i + 1) % 6;
                indices.push(0, i + 2, nextI + 2);
            }
            
            // Create bottom face (6 triangles from center)
            for (let i = 0; i < 6; i++) {
                const nextI = (i + 1) % 6;
                indices.push(1, nextI + 8, i + 8); // Note: reversed winding order for bottom face
            }
            
            // Create side faces (2 triangles per side)
            for (let i = 0; i < 6; i++) {
                const nextI = (i + 1) % 6;
                indices.push(i + 2, i + 8, nextI + 8); // First triangle
                indices.push(i + 2, nextI + 8, nextI + 2); // Second triangle
            }
            
            // Calculate normals (simplified approach)
            // Top face normal
            for (let i = 0; i < 7; i++) { // For center and 6 corners
                normals.push(0, 1, 0);
            }
            
            // Bottom face normal
            for (let i = 0; i < 7; i++) { // For center and 6 corners
                normals.push(0, -1, 0);
            }
            
            // Generate UV coordinates (simplified for now)
            // This creates a radial UV mapping for top/bottom faces and
            // a vertical strip mapping for sides
            const uvCenter = new THREE.Vector2(0.5, 0.5);
            
            // UV for center points
            uvs.push(uvCenter.x, uvCenter.y); // top center
            uvs.push(uvCenter.x, uvCenter.y); // bottom center
            
            // UVs for corner points (top face)
            for (let i = 0; i < 6; i++) {
                const angle = startAngle + (i * Math.PI / 3);
                const u = 0.5 + (Math.cos(angle) * 0.5);
                const v = 0.5 + (Math.sin(angle) * 0.5);
                uvs.push(u, v);
            }
            
            // UVs for corner points (bottom face)
            for (let i = 0; i < 6; i++) {
                const angle = startAngle + (i * Math.PI / 3);
                const u = 0.5 + (Math.cos(angle) * 0.5);
                const v = 0.5 + (Math.sin(angle) * 0.5);
                uvs.push(u, v);
            }
            
            // Set attributes
            this.setIndex(indices);
            this.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            this.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            this.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            
            // Compute correct normals for all faces
            this.computeVertexNormals();
        }
    };
    
    THREE.HexagonGeometry = class HexagonGeometry extends THREE.BufferGeometry {
        constructor(size = 1, height = 1, flatTop = false) {
            super();
            
            this.type = 'HexagonGeometry';
            
            // Parameters
            this.parameters = {
                size: size,
                height: height,
                flatTop: flatTop
            };
            
            // Create geometry using the buffer geometry
            this.copy(new THREE.HexagonBufferGeometry(size, height, flatTop));
        }
    };
    
    // Define the shader variables globally
    window.hexVertexShader = `
      // Instance attributes
      attribute vec3 instancePosition;
      attribute float instanceHeight;
      attribute vec3 instanceColor;
      
      // A-Frame specific uniforms
      uniform vec3 ambientLightColor;
      uniform vec3 directionalLightColor[5];
      uniform vec3 directionalLightDirection[5];
      
      varying vec3 vColor;
      varying float vHeight;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      
      // Add UV coordinates for border calculation
      varying vec2 vUv;
      
      void main() {
          // Pass variables to fragment shader
          vColor = instanceColor;
          vHeight = instanceHeight;
          vUv = uv;
          
          // Apply instance position and scale height
          vec3 transformed = position;
          
          // Only scale the Y coordinate by the instanceHeight
          if (transformed.y > 0.0) {
              transformed.y *= instanceHeight;
          }
          
          // Save original normal for lighting calculations
          vNormal = normalMatrix * normal;
          
          // Calculate world position
          vec3 worldPos = transformed + instancePosition;
          vWorldPosition = worldPos;
          
          // Final position calculation
          vec4 worldPosition = modelMatrix * vec4(worldPos, 1.0);
          vec4 viewPosition = viewMatrix * worldPosition;
          vViewPosition = viewPosition.xyz;
          
          gl_Position = projectionMatrix * viewPosition;
      }
    `;
    
    window.hexFragmentShader = `
      // A-Frame specific uniforms
      uniform vec3 ambientLightColor;
      uniform vec3 directionalLightColor[5];
      uniform vec3 directionalLightDirection[5];
      
      varying vec3 vColor;
      varying float vHeight;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      
      // Define border properties
      const float borderWidth = 0.1;    // Thicker border for better visibility
      const float edgeThreshold = 0.95; // Distance from center where border starts
      
      void main() {
          // Ensure normal is normalized
          vec3 normal = normalize(vNormal);
          
          // Calculate lighting
          vec3 lighting = ambientLightColor;
          
          // Add directional light contribution
          for (int i = 0; i < 5; i++) {
              if (length(directionalLightColor[i]) > 0.0) {
                  vec3 directionalVector = normalize(directionalLightDirection[i]);
                  float directional = max(dot(normal, directionalVector), 0.0);
                  lighting += directionalLightColor[i] * directional;
              }
          }
          
          // Start with the base color * lighting (with minimum brightness)
          vec3 finalColor = vColor * max(lighting, vec3(0.5));
          
          // Simple border detection for top/bottom faces
          bool isBorder = false;
          
          // For top and bottom faces (horizontal surfaces)
          if (abs(normal.y) > 0.9) {
              // Distance from center in UV space
              vec2 centeredUv = 2.0 * vUv - vec2(1.0, 1.0);
              float distFromCenter = length(centeredUv);
              
              // Border at the edge of the hexagon
              if (distFromCenter > edgeThreshold) {
                  isBorder = true;
              }
          }
          // For side faces (vertical surfaces)
          else {
              // If we're near the top or bottom edge of the hexagon side
              float yPos = vWorldPosition.y / max(0.1, vHeight);
              if (yPos < 0.05 || yPos > 0.95) {
                  isBorder = true;
              }
              
              // Check if we're at the edge (hexagon corners)
              float angle = atan(vWorldPosition.z, vWorldPosition.x);
              float normalizedAngle = mod(angle, 0.5236); // 30 degrees = pi/6 radians
              if (normalizedAngle < 0.09 || normalizedAngle > 0.43) {
                  isBorder = true;
              }
          }
          
          // Apply border (solid black)
          if (isBorder) {
              finalColor = vec3(0.0, 0.0, 0.0);
          }
          
          gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
    
    // Set a global flag indicating the geometries are ready
    window.hexagonGeometriesReady = true;
    
    console.log("HexagonGeometry registration complete!");
    console.log("HexagonGeometry defined:", typeof THREE.HexagonGeometry === 'function');
    console.log("HexagonBufferGeometry defined:", typeof THREE.HexagonBufferGeometry === 'function');
}