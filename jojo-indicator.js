// Show and rotate the indicator to point toward jojo from the subject's perspective.

(function() {
    const indicator = document.getElementById('jojo-indicator');
    // --- Fullscreen/VR event handlers to keep indicator visible ---
    function showIndicator() {
        if (indicator) indicator.style.display = '';
    }
    function hideIndicator() {
        if (indicator) indicator.style.display = 'none';
    }
    // Listen for fullscreen and VR mode changes
    document.addEventListener('fullscreenchange', showIndicator);
    document.addEventListener('webkitfullscreenchange', showIndicator);
    document.addEventListener('mozfullscreenchange', showIndicator);
    document.addEventListener('MSFullscreenChange', showIndicator);

    const sceneEl = document.querySelector('a-scene');
    if (sceneEl) {
        sceneEl.addEventListener('enter-vr', showIndicator);
        sceneEl.addEventListener('exit-vr', showIndicator);
    }

    function updateIndicator() {
        const subject = document.querySelector('#subject');
        const cam = document.querySelector('#cam');
        const jojo = document.querySelector('#bumpy');
        if (!subject || !cam || !jojo) {
            indicator.style.display = 'none';
            requestAnimationFrame(updateIndicator);
            return;
        }
        // Get world positions
        const subjectPos = subject.object3D.position;
        const jojoPos = jojo.object3D.position;
        // Direction vector from subject to jojo
        const dir = new THREE.Vector3().subVectors(jojoPos, subjectPos);
        // Camera forward vector
        const camObj = cam.object3D;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camObj.quaternion);
        // Project both onto XZ plane
        dir.y = 0;
        forward.y = 0;
        if (dir.lengthSq() < 1) {
            indicator.style.display = 'none';
        } else {
            indicator.style.display = '';
            dir.normalize();
            forward.normalize();
            // Angle between camera forward and direction to jojo
            let angle = Math.atan2(dir.x, dir.z) - Math.atan2(forward.x, forward.z);
            angle = -angle * 180 / Math.PI; // Convert to degrees
            // Rotate the indicator
            indicator.style.transform = `translate(0%,100%) rotate(${angle}deg)`;
        }
        requestAnimationFrame(updateIndicator);
    }
    updateIndicator();
})();
