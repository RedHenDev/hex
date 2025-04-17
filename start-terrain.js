// Simplified start-terrain.js - just handles loading screen
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded - waiting for A-Frame to initialize");
});

// Hide loading screen when terrain is ready
document.addEventListener('terrainReady', function() {
    console.log("Terrain ready event received");
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }, 1000);
});