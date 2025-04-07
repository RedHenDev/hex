AFRAME.registerComponent('free-controls', {
    schema: {
      enabled: { default: true },
      sensitivity: { default: 2.0 },
      mobileSensitivity: { default: 1.0 }, // Separate sensitivity for touch devices
      bannerText: { default: 'Press ESC to exit mouse look, F to toggle fullscreen' },
      showFullscreenTip: { default: true },
      showMobileMovementButton: { default: true }, // Whether to show movement button on mobile
      moveButtonPosition: { default: 'bottom-center' } // Position for move button
    },
  
    init: function() {
      this.canvasEl = document.querySelector('canvas');
      this.pointerLocked = false;
  
      // Check if we're on a mobile device
      this.isMobile = AFRAME.utils.device.isMobile();
      console.log("Device detected as mobile:", this.isMobile);
  
      // Get the correct camera reference
      this.cameraEl = this.el;
      this.camera = this.el.object3D;
  
      // Get reference to player entity with terrain-movement
      this.playerEl = document.querySelector('#player');
      if (!this.playerEl) {
        console.warn("Could not find player element with id 'player'");
      } else {
        console.log("Found player element:", this.playerEl);
      }
  
      // Log for debugging
      console.log("Camera element:", this.cameraEl);
      console.log("Camera object3D:", this.camera);
  
      // Touch state tracking
      this.touchActive = false;
      this.lastTouchX = 0;
      this.lastTouchY = 0;
  
      // Movement state
      this.isMoving = false;
  
      // Bind methods
      this.onMouseDown = this.onMouseDown.bind(this);
      this.onPointerLockChange = this.onPointerLockChange.bind(this);
      this.onPointerLockError = this.onPointerLockError.bind(this);
      this.onMouseMove = this.onMouseMove.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onFullscreenChange = this.onFullscreenChange.bind(this);
      this.onTouchStart = this.onTouchStart.bind(this);
      this.onTouchMove = this.onTouchMove.bind(this);
      this.onTouchEnd = this.onTouchEnd.bind(this);
      this.toggleMovement = this.toggleMovement.bind(this);
  
      // Setup event listeners based on device type
      if (this.isMobile) {
        this.setupTouchControls();
      } else {
        this.setupMouseControls();
      }
  
      // Track fullscreen state
      this.isFullscreen = !!(document.fullscreenElement ||
                            document.webkitFullscreenElement ||
                            document.mozFullScreenElement ||
                            document.msFullscreenElement);
  
      document.addEventListener('fullscreenchange', this.onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
      document.addEventListener('mozfullscreenchange', this.onFullscreenChange);
      document.addEventListener('MSFullscreenChange', this.onFullscreenChange);
  
      console.log("Free controls initialized for", this.isMobile ? "mobile" : "desktop");
    },
  
    setupMouseControls: function() {
      if (this.cameraEl.getAttribute('look-controls') !== null) {
        this.cameraEl.setAttribute('look-controls', 'enabled', false);
        console.log("Disabled A-Frame's default look controls");
      }
  
      this.canvasEl.addEventListener('click', this.onMouseDown);
  
      document.addEventListener('pointerlockchange', this.onPointerLockChange);
      document.addEventListener('mozpointerlockchange', this.onPointerLockChange);
      document.addEventListener('webkitpointerlockchange', this.onPointerLockChange);
  
      document.addEventListener('pointerlockerror', this.onPointerLockError);
      document.addEventListener('mozpointerlockerror', this.onPointerLockError);
      document.addEventListener('webkitpointerlockerror', this.onPointerLockError);
  
      document.addEventListener('keydown', this.onKeyDown);
    },
  
    setupTouchControls: function() {
      console.log("Setting up touch controls for mobile");
  
      if (this.cameraEl.getAttribute('look-controls') !== null) {
        this.cameraEl.setAttribute('look-controls', 'enabled', false);
        console.log("Disabled A-Frame's default look controls on mobile");
      }
  
      this.canvasEl.addEventListener('touchstart', this.onTouchStart, false);
      this.canvasEl.addEventListener('touchmove', this.onTouchMove, false);
      this.canvasEl.addEventListener('touchend', this.onTouchEnd, false);
  
      this.canvasEl.style.touchAction = 'none';
      document.body.style.touchAction = 'none';
  
      this.createTouchIndicator();
  
      if (this.data.showMobileMovementButton) {
        this.createMovementButton();
      }
    },
  
    showNotification: function(message) {
      const notificationEl = document.createElement('div');
      notificationEl.style.position = 'absolute';
      notificationEl.style.bottom = '100px';
      notificationEl.style.left = '50%';
      notificationEl.style.transform = 'translateX(-50%)';
      notificationEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      notificationEl.style.color = 'white';
      notificationEl.style.padding = '8px 16px';
      notificationEl.style.borderRadius = '20px';
      notificationEl.style.fontSize = this.isMobile ? '16px' : '14px';
      notificationEl.style.fontFamily = 'Arial, sans-serif';
      notificationEl.style.zIndex = '1000';
      notificationEl.style.transition = 'opacity 0.5s ease-in-out';
      notificationEl.style.pointerEvents = 'none';
      notificationEl.textContent = message;
  
      document.body.appendChild(notificationEl);
  
      const fadeOut = function() {
        notificationEl.style.opacity = '0';
  
        const removeElement = function() {
          if (notificationEl.parentNode) {
            notificationEl.parentNode.removeChild(notificationEl);
          }
        };
  
        setTimeout(removeElement, 500);
      };
  
      setTimeout(fadeOut, 1500);
    },
  
    toggleMovement: function(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
  
      if (!this.playerEl) {
        console.warn("Cannot toggle movement: player element not found");
        return;
      }
  
      const terrainMovementComponent = this.playerEl.components['terrain-movement'];
  
      if (!terrainMovementComponent) {
        console.warn("Cannot toggle movement: terrain-movement component not found");
        return;
      }
  
      this.isMoving = !this.isMoving;
      terrainMovementComponent.moveZ = this.isMoving ? 1 : 0;
  
      console.log("Movement toggled:", this.isMoving ? "ON" : "OFF");
  
      if (this.moveButton) {
        this.moveButton.textContent = this.isMoving ? 'walk: ON' : 'walk: OFF';
        if (this.isMoving) {
          this.moveButton.style.backgroundColor = 'rgba(76, 175, 80, 0.7)';
          this.moveButton.classList.add('active');
        } else {
          this.moveButton.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
          this.moveButton.classList.remove('active');
        }
      }
  
      //this.showNotification(this.isMoving ? "Movement enabled" : "Movement disabled");
    },
  
    createMovementButton: function() {
      this.moveButton = document.createElement('button');
      this.moveButton.className = 'move-toggle-btn';
      this.moveButton.textContent = 'walk: OFF';
  
      this.moveButton.style.position = 'fixed';
      this.moveButton.style.padding = '15px 25px';
      this.moveButton.style.border = 'none';
      this.moveButton.style.borderRadius = '30px';
      this.moveButton.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
      this.moveButton.style.color = 'white';
      this.moveButton.style.fontFamily = 'Arial, sans-serif';
      this.moveButton.style.fontSize = '18px';
      this.moveButton.style.fontWeight = 'bold';
      this.moveButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
      this.moveButton.style.zIndex = '1000';
      this.moveButton.style.transition = 'background-color 0.3s, transform 0.1s';
  
      switch (this.data.moveButtonPosition) {
        case 'bottom-left':
          this.moveButton.style.bottom = '30px';
          this.moveButton.style.left = '30px';
          break;
        case 'bottom-right':
          this.moveButton.style.bottom = '30px';
          this.moveButton.style.right = '30px';
          break;
        case 'bottom-center':
        default:
          this.moveButton.style.bottom = '30px';
          this.moveButton.style.left = '50%';
          this.moveButton.style.transform = 'translateX(-50%)';
      }
  
      const touchStartHandler = function() {
        this.style.transform = this.style.transform.includes('translateX')
          ? 'translateX(-50%) scale(0.95)'
          : 'scale(0.95)';
        this.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      };
  
      const touchEndHandler = function() {
        this.style.transform = this.style.transform.includes('translateX')
          ? 'translateX(-50%)'
          : '';
        this.style.backgroundColor = this.classList.contains('active')
          ? 'rgba(76, 175, 80, 0.7)'
          : 'rgba(0, 0, 0, 0.6)';
      };
  
      this.moveButton.addEventListener('touchstart', touchStartHandler);
      this.moveButton.addEventListener('touchend', touchEndHandler);
  
      this.moveButton.addEventListener('click', this.toggleMovement);
  
      document.body.appendChild(this.moveButton);
    },
  
    createTouchIndicator: function() {
      const indicator = document.createElement('div');
      indicator.style.position = 'fixed';
      indicator.style.bottom = '10px';
      indicator.style.right = '10px';
      indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      indicator.style.color = 'white';
      indicator.style.padding = '5px 8px';
      indicator.style.borderRadius = '4px';
      indicator.style.fontSize = '12px';
      indicator.style.fontFamily = 'Arial, sans-serif';
      indicator.style.zIndex = '999';
      indicator.style.opacity = '0.7';
      indicator.textContent = 'Drag to look';
  
      document.body.appendChild(indicator);
  
      setTimeout(function() {
        indicator.style.transition = 'opacity 1s ease-out';
        indicator.style.opacity = '0';
        setTimeout(function() {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 1000);
      }, 5000);
  
      this.touchIndicator = indicator;
    },
  
    onMouseDown: function(event) {
      if (event.target.closest('.a-enter-vr') ||
          event.target.closest('.a-orientation-modal') ||
          event.target.closest('.look-toggle-btn')) {
        return;
      }
  
      if (!this.pointerLocked) {
        this.canvasEl.requestPointerLock = this.canvasEl.requestPointerLock ||
                                           this.canvasEl.mozRequestPointerLock ||
                                           this.canvasEl.webkitRequestPointerLock;
        this.canvasEl.requestPointerLock();
      }
    },
  
    onTouchStart: function(event) {
      if (!this.data.enabled) return;
  
      event.preventDefault();
  
      if (event.touches.length === 1) {
        this.touchActive = true;
        this.lastTouchX = event.touches[0].clientX;
        this.lastTouchY = event.touches[0].clientY;
        console.log("Touch start at:", this.lastTouchX, this.lastTouchY);
      }
    },
  
    onTouchMove: function(event) {
      if (!this.touchActive || !this.data.enabled) return;
  
      event.preventDefault();
  
      if (event.touches.length === 1) {
        const touchX = event.touches[0].clientX;
        const touchY = event.touches[0].clientY;
  
        const movementX = touchX - this.lastTouchX;
        const movementY = touchY - this.lastTouchY;
  
        if (this.touchDebugCount === undefined) {
          this.touchDebugCount = 0;
        }
  
        // if (this.touchDebugCount < 5) {
        //   console.log("Touch movement:", movementX, movementY);
        //   this.touchDebugCount++;
        // }
  
        const sensitivity = this.data.mobileSensitivity / 200;
  
        this.camera.rotation.y -= movementX * sensitivity;
  
        const currentPitch = this.camera.rotation.x;
        const newPitch = currentPitch - movementY * sensitivity;
        this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, newPitch));
  
        this.lastTouchX = touchX;
        this.lastTouchY = touchY;
      }
    },
  
    onTouchEnd: function(event) {
      this.touchActive = false;
    },
  
    onPointerLockChange: function() {
      if (document.pointerLockElement === this.canvasEl ||
          document.mozPointerLockElement === this.canvasEl ||
          document.webkitPointerLockElement === this.canvasEl) {
        this.pointerLocked = true;
        document.addEventListener('mousemove', this.onMouseMove, false);
        //console.log('Pointer locked');
      } else {
        this.pointerLocked = false;
        document.removeEventListener('mousemove', this.onMouseMove, false);
        //console.log('Pointer unlocked');
        if (this.isFullscreen && this.data.showFullscreenTip) {
          this.showFullscreenReminder();
        }
      }
    },
  
    onPointerLockError: function() {
      console.error('Error obtaining pointer lock');
    },
  
    onMouseMove: function(event) {
      if (!this.pointerLocked || !this.data.enabled) return;
  
      const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
  
      const sensitivity = this.data.sensitivity / 1000;
  
      if (this.debugCount === undefined) {
        this.debugCount = 0;
      }
  
    //   if (this.debugCount < 5) {
    //     console.log("Mouse movement:", movementX, movementY);
    //     console.log("Current camera rotation:", this.camera.rotation);
    //     this.debugCount++;
    //   }
  
      this.camera.rotation.y -= movementX * sensitivity;
  
      const currentPitch = this.camera.rotation.x;
      const newPitch = currentPitch - movementY * sensitivity;
      this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, newPitch));
    },
  
    onKeyDown: function(event) {
      if (event.key === 'f' || event.key === 'F') {
        this.toggleFullscreen();
      }
    },
  
    onFullscreenChange: function() {
      this.isFullscreen = !!(document.fullscreenElement ||
                            document.webkitFullscreenElement ||
                            document.mozFullScreenElement ||
                            document.msFullscreenElement);
    },
  
    toggleFullscreen: function() {
      if (!this.isFullscreen) {
        const element = document.documentElement;
        if (element.requestFullscreen) {
          element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
          element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
          element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          element.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    },
  
    showFullscreenReminder: function() {
      const reminder = document.createElement('div');
      reminder.style.position = 'fixed';
      reminder.style.bottom = '50px';
      reminder.style.left = '50%';
      reminder.style.transform = 'translateX(-50%)';
      reminder.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      reminder.style.color = 'white';
      reminder.style.padding = '10px 15px';
      reminder.style.borderRadius = '5px';
      reminder.style.fontSize = '16px';
      reminder.style.fontFamily = 'Arial, sans-serif';
      reminder.style.zIndex = '9999';
      reminder.style.transition = 'opacity 0.5s ease-in-out';
      reminder.textContent = 'Press F to toggle fullscreen mode';
  
      document.body.appendChild(reminder);
  
      const fadeOutReminder = function() {
        reminder.style.opacity = '0';
        const removeReminder = function() {
          if (reminder.parentNode) {
            reminder.parentNode.removeChild(reminder);
          }
        };
        setTimeout(removeReminder, 500);
      };
  
      setTimeout(fadeOutReminder, 3000);
    },
  
    remove: function() {
      this.canvasEl.removeEventListener('click', this.onMouseDown);
  
      document.removeEventListener('pointerlockchange', this.onPointerLockChange);
      document.removeEventListener('mozpointerlockchange', this.onPointerLockChange);
      document.removeEventListener('webkitpointerlockchange', this.onPointerLockChange);
  
      document.removeEventListener('pointerlockerror', this.onPointerLockError);
      document.removeEventListener('mozpointerlockerror', this.onPointerLockError);
      document.removeEventListener('webkitpointerlockerror', this.onPointerLockError);
  
      document.removeEventListener('mousemove', this.onMouseMove);
  
      this.canvasEl.removeEventListener('touchstart', this.onTouchStart);
      this.canvasEl.removeEventListener('touchmove', this.onTouchMove);
      this.canvasEl.removeEventListener('touchend', this.onTouchEnd);
  
      document.removeEventListener('keydown', this.onKeyDown);
      document.removeEventListener('fullscreenchange', this.onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', this.onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', this.onFullscreenChange);
  
      if (this.touchIndicator && this.touchIndicator.parentNode) {
        this.touchIndicator.parentNode.removeChild(this.touchIndicator);
      }
  
      if (this.moveButton && this.moveButton.parentNode) {
        this.moveButton.removeEventListener('click', this.toggleMovement);
        this.moveButton.parentNode.removeChild(this.moveButton);
      }
    }
  });