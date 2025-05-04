// Portal System for Eigengrau Light [Hex Terrain] with Wavy Stars Portal Effect
// Allows travel between games in the Vibeverse webring with a Quake-inspired portal design

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      const portalSystemEntity = document.createElement('a-entity');
      portalSystemEntity.setAttribute('id', 'portal-system');
      portalSystemEntity.setAttribute('portal-system', '');
      scene.appendChild(portalSystemEntity);
      console.log('Portal system initialized');
    });
  }
});

// Main portal system component
AFRAME.registerComponent('portal-system', {
  init: function() {
    // Register custom shader for wavy starfield effect
    AFRAME.registerShader('wave-distortion', {
      schema: {
        time: {type: 'time', is: 'uniform'},
        map: {type: 'map', is: 'uniform'},
        color: {type: 'color', is: 'uniform', default: 'white'}
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform sampler2D map;
        uniform vec3 color;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          uv.x += sin(uv.y * 10.0 + time * 0.001) * 0.05;
          uv.y += sin(uv.x * 10.0 + time * 0.001) * 0.05;
          vec4 texColor = texture2D(map, uv);
          gl_FragColor = texColor * vec4(color, 1.0);
        }
      `
    });

    // Check if we should create a start portal (coming from another game)
    const urlParams = new URLSearchParams(window.location.search);
    const fromPortal = urlParams.get('portal') === 'true';
    const refUrl = urlParams.get('ref');
    
    // Always create exit portal
    this.createExitPortal();
    
    // Create start portal if coming from another game
    if (fromPortal && refUrl) {
      this.createStartPortal(refUrl, urlParams);
    }
    
    // Get player reference for collision detection
    this.playerEl = document.querySelector('#subject');
    
    // Set up interval to check for portal collisions
    this.checkInterval = setInterval(() => {
      this.checkPortalCollisions();
    }, 500); // Check every 500ms
  },
  
  createExitPortal: function() {
    // Create exit portal entity
    const exitPortal = document.createElement('a-entity');
    exitPortal.setAttribute('id', 'exit-portal');
    //exitPortal.setAttribute('position', '-95 55 -19');
    exitPortal.setAttribute('position', '9999 1800 7900');
    
    // Create animated portal ring (torus)
    const portalRing = document.createElement('a-torus');
    portalRing.setAttribute('color', '#00ff00');
    portalRing.setAttribute('radius', '15');
    portalRing.setAttribute('radius-tubular', '2');
    portalRing.setAttribute('segments-tubular', '32');
    portalRing.setAttribute('segments-radial', '16');
    portalRing.setAttribute('material', 'emissive: #00ff00; emissiveIntensity: 0.5; transparent: true; opacity: 0.8');
    // Add rotation animation
    // portalRing.setAttribute('animation', {
    //   property: 'rotation',
    //   to: '0 360 0',
    //   loop: true,
    //   dur: 10000,
    //   easing: 'linear'
    // });
    // Add pulsing scale animation
    portalRing.setAttribute('animation__scale', {
      property: 'scale',
      to: '1.1 1.1 1.1',
      dir: 'alternate',
      loop: true,
      dur: 2000,
      easing: 'easeInOutQuad'
    });
    exitPortal.appendChild(portalRing);
    
    // Create portal inner surface with wavy starfield effect
    const portalInner = document.createElement('a-circle');
    portalInner.setAttribute('radius', '13');
    portalInner.setAttribute('material', {
      shader: 'wave-distortion',
      map: './assets/starfield.png', // Replace with actual starfield texture URL
      color: '#00ff00',
      transparent: true,
      side: 'double'
    });
    exitPortal.appendChild(portalInner);
    
    // Add portal label
    const portalLabel = document.createElement('a-text');
    portalLabel.setAttribute('value', 'VIBEVERSE PORTAL');
    portalLabel.setAttribute('position', '0 20 0');
    portalLabel.setAttribute('color', '#000000');
    portalLabel.setAttribute('align', 'center');
    portalLabel.setAttribute('scale', '10 10 10');
    portalLabel.setAttribute('side', 'double');
    exitPortal.appendChild(portalLabel);
    
    // Add glowing point light
    const portalLight = document.createElement('a-light');
    portalLight.setAttribute('type', 'point');
    portalLight.setAttribute('color', '#00ff00');
    portalLight.setAttribute('intensity', '1');
    portalLight.setAttribute('distance', '50');
    exitPortal.appendChild(portalLight);
    
    // Add to scene
    this.el.appendChild(exitPortal);
    
    // Store for collision detection
    this.exitPortal = exitPortal;
  },
  
  createStartPortal: function(refUrl, urlParams) {
    // Create start portal entity
    const startPortal = document.createElement('a-entity');
    startPortal.setAttribute('id', 'start-portal');
    startPortal.setAttribute('position', '9999 1800 7900');
    
    // Create animated portal ring (torus)
    const portalRing = document.createElement('a-torus');
    portalRing.setAttribute('color', '#ff0000');
    portalRing.setAttribute('radius', '15');
    portalRing.setAttribute('radius-tubular', '2');
    portalRing.setAttribute('segments-tubular', '32');
    portalRing.setAttribute('segments-radial', '16');
    portalRing.setAttribute('material', 'emissive: #ff0000; emissiveIntensity: 0.5; transparent: true; opacity: 0.8');
    // Add rotation animation
    // portalRing.setAttribute('animation', {
    //   property: 'rotation',
    //   to: '0 360 0',
    //   loop: true,
    //   dur: 10000,
    //   easing: 'linear'
    // });
    // Add pulsing scale animation
    // portalRing.setAttribute('animation__scale', {
    //   property: 'scale',
    //   to: '1.1 1.1 1.1',
    //   dir: 'alternate',
    //   loop: true,
    //   dur: 2000,
    //   easing: 'easeInOutQuad'
    // });
    startPortal.appendChild(portalRing);
    
    // Create portal inner surface with wavy starfield effect
    const portalInner = document.createElement('a-circle');
    portalInner.setAttribute('radius', '13');
    portalInner.setAttribute('material', {
      shader: 'wave-distortion',
      map: './assets/starfield.png', // Replace with actual starfield texture URL
      color: '#ff0000',
      transparent: true,
      side: 'double'
    });
    startPortal.appendChild(portalInner);
    
    // Add portal label - extract domain from refUrl for display
    let domain = refUrl;
    if (domain.startsWith('http://')) domain = domain.substring(7);
    if (domain.startsWith('https://')) domain = domain.substring(8);
    if (domain.startsWith('www.')) domain = domain.substring(4);
    
    const portalLabel = document.createElement('a-text');
    portalLabel.setAttribute('value', `RETURN TO ${domain.toUpperCase()}`);
    portalLabel.setAttribute('position', '0 20 0');
    portalLabel.setAttribute('color', '#ff0000');
    portalLabel.setAttribute('align', 'center');
    portalLabel.setAttribute('scale', '10 10 10');
    portalLabel.setAttribute('side', 'double');
    startPortal.appendChild(portalLabel);
    
    // Add glowing point light
    const portalLight = document.createElement('a-light');
    portalLight.setAttribute('type', 'point');
    portalLight.setAttribute('color', '#ff0000');
    portalLight.setAttribute('intensity', '1');
    portalLight.setAttribute('distance', '50');
    startPortal.appendChild(portalLight);
    
    // Store original URL for return journey
    startPortal.setAttribute('data-ref-url', refUrl);
    
    // Add all URL parameters to data attributes
    for (const [key, value] of urlParams.entries()) {
      startPortal.setAttribute(`data-param-${key}`, value);
    }
    
    // Add to scene
    this.el.appendChild(startPortal);
    
    // Store for collision detection
    this.startPortal = startPortal;
    
    // Set player position near start portal
    if (this.playerEl) {
      const portalPos = startPortal.getAttribute('position');
      this.playerEl.setAttribute('position', `${portalPos.x} ${portalPos.y} ${portalPos.z + 20}`);
    }
  },
  
  checkPortalCollisions: function() {
    if (!this.playerEl) return;
    
    const playerPos = this.playerEl.getAttribute('position');
    
    // Check exit portal collision
    if (this.exitPortal) {
      const exitPortalPos = this.exitPortal.getAttribute('position');
      const distanceToExit = this.calculateDistance(playerPos, exitPortalPos);
      if (distanceToExit < 15) {
        this.enterExitPortal();
      }
    }
    
    // Check start portal collision
    if (this.startPortal) {
      const startPortalPos = this.startPortal.getAttribute('position');
      const distanceToStart = this.calculateDistance(playerPos, startPortalPos);
      if (distanceToStart < 15) {
        this.enterStartPortal();
      }
    }
  },
  
  calculateDistance: function(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  },
  
  enterExitPortal: function() {
    if (this.transitioning) return;
    this.transitioning = true;
    
    const params = new URLSearchParams();
    params.append('portal', 'true');
    const playerName = window.playerName || 'Eigengrau';
    params.append('username', playerName);
    params.append('color', 'white');
    
    let speed = 5;
    if (this.playerEl.components['terrain-movement']) {
      const tmc = this.playerEl.components['terrain-movement'];
      speed = tmc.running ? 10 : 5;
    }
    params.append('speed', speed);
    params.append('ref', window.location.href.split('?')[0]);
    
    const playerPos = this.playerEl.getAttribute('position');
    if (document.querySelector('#cam')){
    const cameraRotation = document.querySelector('#cam').getAttribute('rotation');
    params.append('speed_x', 0);
    params.append('speed_y', 0);
    params.append('speed_z', speed);
    params.append('rotation_x', cameraRotation.x);
    params.append('rotation_y', cameraRotation.y);
    params.append('rotation_z', cameraRotation.z);
    }
    
    const portalUrl = `https://portal.pieter.com/?${params.toString()}`;
    setTimeout(() => {
      window.location.href = portalUrl;
    }, 500);
  },
  
  enterStartPortal: function() {
    if (this.transitioning) return;
    this.transitioning = true;
    
    let returnUrl = this.startPortal.getAttribute('data-ref-url');
    if (!returnUrl.startsWith('http://') && !returnUrl.startsWith('https://')) {
      returnUrl = 'https://' + returnUrl;
    }
    
    const params = new URLSearchParams();
    params.append('portal', 'true');
    
    const allAttributes = this.startPortal.getAttributeNames();
    for (const attr of allAttributes) {
      if (attr.startsWith('data-param-') && attr !== 'data-param-ref' && attr !== 'data-param-portal') {
        const paramName = attr.substring('data-param-'.length);
        const paramValue = this.startPortal.getAttribute(attr);
        params.append(paramName, paramValue);
      }
    }
    
    params.append('ref', window.location.href.split('?')[0]);
    
    const playerPos = this.playerEl.getAttribute('position');
    const cameraRotation = document.querySelector('#cam').getAttribute('rotation');
    params.append('speed_x', 0);
    params.append('speed_y', 0);
    params.append('speed_z', 5);
    params.append('rotation_x', cameraRotation.x);
    params.append('rotation_y', cameraRotation.y);
    params.append('rotation_z', cameraRotation.z);
    
    const returnPortalUrl = `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}${params.toString()}`;
    setTimeout(() => {
      window.location.href = returnPortalUrl;
    }, 500);
  },
  
  remove: function() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
});