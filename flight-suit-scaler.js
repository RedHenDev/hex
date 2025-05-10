AFRAME.registerComponent('flight-suit-scaler', {
    init: function() {
        // Check if device is mobile.
        const isMobile = AFRAME.utils.device.isMobile();
        
        if (isMobile) {
            // Scale down for mobile.
            this.el.setAttribute('scale', '0.25 0.7 0.7');
        } else {
            // Default scale for desktop.
            this.el.setAttribute('scale', '1 1 1');
        }
    }
});
