(function () {
	// Create and inject UI overlay
	function createUIOverlay() {
		const overlay = document.createElement('div');
		overlay.id = 'settings-overlay';
		overlay.style.position = 'fixed';
		overlay.style.top = '50%';
		overlay.style.left = '50%';
		overlay.style.transform = 'translate(-50%, -50%)';
		overlay.style.background = 'rgba(0, 0, 0, 0.8)';
		overlay.style.color = '#fff';
		overlay.style.padding = '20px';
		overlay.style.borderRadius = '10px';
		overlay.style.zIndex = '10000';
		overlay.style.minWidth = '300px';
		overlay.style.textAlign = 'center';
		overlay.style.display = 'none';
		overlay.innerHTML = `
			<h2>Terrain Settings</h2>
			<p>Adjust settings as needed.</p>
			<button id="toggle-run" tabindex="0" style="padding:10px 20px; margin:5px; border:none; background:#27ae60; color:#fff; border-radius:5px; cursor:pointer;">Toggle Run Mode</button>
			<button id="toggle-fly" tabindex="0" style="padding:10px 20px; margin:5px; border:none; background:#2980b9; color:#fff; border-radius:5px; cursor:pointer;">Toggle Fly Mode</button>
			<div id="subject-coords" style="margin-top:10px; color:#ccc; font-size:14px;"></div>
			<button id="close-settings" tabindex="0" style="padding:10px 20px; margin-top:10px; border:none; background:#e74c3c; color:#fff; border-radius:5px; cursor:pointer;">Close</button>
		`;
		document.body.appendChild(overlay);
		
		// Close button event listener
		document.getElementById('close-settings').addEventListener('click', function () {
			overlay.style.display = 'none';
		});
		
		// Toggle Run Mode button event listener
		document.getElementById('toggle-run').addEventListener('click', function () {
			const subject = document.querySelector('#subject');
			if (subject && subject.components && subject.components['subject-locomotion']) {
				const loco = subject.components['subject-locomotion'];
				loco.running = !loco.running;
				this.textContent = loco.running ? 'Run Mode: ON' : 'Run Mode: OFF';
			}
		});
		
		// Toggle Fly Mode button event listener
		document.getElementById('toggle-fly').addEventListener('click', function () {
			const subject = document.querySelector('#subject');
			if (subject && subject.components && subject.components['subject-locomotion']) {
				const loco = subject.components['subject-locomotion'];
				loco.flying = !loco.flying;
				this.textContent = loco.flying ? 'Fly Mode: ON' : 'Fly Mode: OFF';
			}
		});
		
		return overlay;
	}

	// Function to update coordinate display based on subject position
	function updateCoordinatesText() {
		const subject = document.querySelector('#subject');
		if (!subject) return;
		const pos = subject.object3D.position;
		let xLabel = pos.x < 0 ? 'West ' + Math.abs(pos.x).toFixed(2) : 'East ' + pos.x.toFixed(2);
		let zLabel = pos.z < 0 ? 'South ' + Math.abs(pos.z).toFixed(2) : 'North ' + pos.z.toFixed(2);
		const loco = subject.components && subject.components['subject-locomotion'];
		let altLabel = (loco && loco.flying) ? 'Altitude' : 'Elevation';
		const coordDiv = document.getElementById('subject-coords');
		if (coordDiv) {
			coordDiv.textContent = `Coordinates: ${xLabel}, ${pos.y.toFixed(2)} ${altLabel}, ${zLabel}`;
		}
	}

	// Create a button for non-VR users
	function createSettingsButton() {
		const btn = document.createElement('button');
		btn.id = 'settings-btn';
		btn.textContent = 'Settings';
		btn.style.position = 'fixed';
		btn.style.bottom = '20px';
		btn.style.right = '20px';
		btn.style.padding = '15px 20px';
		btn.style.backgroundColor = '#3498db';
		btn.style.border = 'none';
		btn.style.borderRadius = '5px';
		btn.style.color = '#fff';
		btn.style.zIndex = '10000';
		btn.style.cursor = 'pointer';
		document.body.appendChild(btn);
		btn.addEventListener('click', function () {
			overlay.style.display = 'block';
			lastTriggerTime = Date.now();
		});
	}

	// Define thresholds and cooldown time
	const ROLL_THRESHOLD = -0.35; // adjust based on experimentation
	const COOLDOWN = 3000; // 3 seconds between triggers

	let lastTriggerTime = 0;
	const overlay = createUIOverlay();
	
	// Only create button if scene is not in VR mode at start.
	const sceneEl = document.querySelector('a-scene');
	if (sceneEl && !sceneEl.is('vr-mode')) {
		createSettingsButton();
	}

	AFRAME.registerComponent('vr-ui', {
		schema: {},
		init: function () {
			this.cameraEl = this.el.sceneEl.camera.el;
		},
		tick: function () {
			const scene = this.el.sceneEl;
			const isVR = scene.is('vr-mode');
			if (isVR) {
				// Get camera roll from rotation (in radians)
				const roll = this.cameraEl.getAttribute('rotation').z;
				// Check if tilt to right is within threshold and cooldown passed
				if (roll < ROLL_THRESHOLD && Date.now() - lastTriggerTime > COOLDOWN) {
					overlay.style.display = 'block';
					lastTriggerTime = Date.now();
				}
			}
			// Always update the coordinate display whenever the overlay is visible
			if (overlay.style.display !== 'none') {
				updateCoordinatesText();
				// Listen for state changes from subject-locomotion and update button texts accordingly.
				const subject = document.querySelector('#subject');
				if (subject && subject.components && subject.components['subject-locomotion']) {
					const loco = subject.components['subject-locomotion'];
					const runBtn = document.getElementById('toggle-run');
					const flyBtn = document.getElementById('toggle-fly');
					if (runBtn) {
						runBtn.textContent = loco.running ? 'Run Mode: ON' : 'Run Mode: OFF';
					}
					if (flyBtn) {
						flyBtn.textContent = loco.flying ? 'Fly Mode: ON' : 'Fly Mode: OFF';
					}
				}
			}
		}
	});

	// Auto-attach the component to the scene using the already declared sceneEl
	if (sceneEl) {
		sceneEl.setAttribute('vr-ui', '');
	}
})();
