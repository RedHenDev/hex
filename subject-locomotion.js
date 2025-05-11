AFRAME.registerComponent('subject-locomotion', {
    schema: {
        // Define your schema here
    },

    init: function() {
        this.velocity = new THREE.Vector3();

        if (window.socket) {
            window.socket.addEventListener('message', (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'impact' && data.targetId === window.clientId) {
                    const force = new THREE.Vector3(data.force.x, data.force.y, data.force.z);
                    this.applyImpactForce(force);
                }
            });
        }
    },

    applyImpactForce: function(force) {
        // Add force to current velocity
        this.velocity.add(force);
    },

    tick: function(time, delta) {
        // Update position based on velocity
        const dt = delta * 0.001;
        const position = this.el.object3D.position;
        position.addScaledVector(this.velocity, dt);
    }
});