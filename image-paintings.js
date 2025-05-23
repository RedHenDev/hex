(async function () {
    console.log("Initializing image paintings...");

    let terrainGenerator = null;

    function getTerrainHeightAt(x, z) {
        // Lazy load terrain generator reference
        if (!terrainGenerator) {
            try {
                const scene = document.querySelector('a-scene');
                if (scene && scene.hasAttribute('terrain-manager')) {
                    const terrainManager = scene.components['terrain-manager'];
                    if (terrainManager && terrainManager.chunkManager && terrainManager.chunkManager.terrainGenerator) {
                        terrainGenerator = terrainManager.chunkManager.terrainGenerator;
                        //console.log('Image paintings: Terrain generator initialized.');
                    }
                }
            } catch (err) {
                console.error('Image paintings: Error accessing terrain generator:', err);
                return 0;
            }
        }

        // Generate terrain height
        try {
            if (terrainGenerator) {
                return terrainGenerator.generateTerrainHeight(x, z);
            }
            return 0;
        } catch (error) {
            console.warn("Image paintings: Error getting terrain height:", error);
            return 0;
        }
    }

    const imageDirectory = 'assets/shots';
    const manifestUrl = './assets/shots/manifest.json';
    const imageExtensions = ['jpg', 'jpeg', 'png'];
    const loader = new THREE.TextureLoader();

    // Wait for the A-Frame scene to load
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
        console.error("A-Frame scene not found.");
        return;
    }
    await new Promise(resolve => {
        if (sceneEl.hasLoaded) {
            resolve();
        } else {
            sceneEl.addEventListener('loaded', resolve);
        }
    });

    const scene = sceneEl.object3D; // Get the A-Frame scene object3D

    // Helper to fetch image files from the manifest
    async function fetchImageFiles() {
        try {
            const response = await fetch(manifestUrl);
            if (!response.ok) throw new Error("Manifest not found");
            const files = await response.json();
            return files.map(filename => `${imageDirectory}/${filename}`);
        } catch (error) {
            console.error("Error fetching image manifest:", error);
            return [];
        }
    }

    // Helper to extract timestamp from image filename (assumes format: "timestamp_filename.ext")
    function extractTimestamp(filename) {
        const match = filename.match(/(\d+)_/);
        return match ? parseInt(match[1], 10) : Date.now();
    }

    // Load images and create planes
    async function createImagePlanes() {
        const imageFiles = await fetchImageFiles();
        if (imageFiles.length === 0) {
            console.warn("No images found in the directory.");
            return;
        }

        // Sort images by timestamp (oldest first)
        imageFiles.sort((a, b) => extractTimestamp(a) - extractTimestamp(b));

        const startDistance = 42; // Distance for the oldest image.
        const distanceStep = 12; // Step distance between images.
        const planeSize = { width: 32, height: 32*0.618 }; // Size of each plane.

        // Let's get the subject's position as origin.
        const subjectPosition = document.querySelector('#subject').object3D.position;

        for (let i = 0; i < imageFiles.length; i++) {
            const imageUrl = imageFiles[i];
            const distance = startDistance + i * distanceStep;

            // Calculate position.
            const angle = (i / imageFiles.length) * Math.PI * 2; // Spread around in a circle
            const x = subjectPosition.x + Math.cos(angle) * distance;
            const z = subjectPosition.z + Math.sin(angle) * distance;
            const y = 200 + getTerrainHeightAt(x, z)+(planeSize.width*0.5) || 800; // Use getTerrainHeightAt

            // Load texture and create plane
            loader.load(imageUrl, texture => {
                const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
                const geometry = new THREE.PlaneGeometry(planeSize.width, planeSize.height);
                const plane = new THREE.Mesh(geometry, material);

                plane.position.set(x, y + planeSize.height * 0.5, z); // Position above terrain
                plane.lookAt(0, y, 0); // Face the center of the terrain
                scene.add(plane);
                //console.log(`Added image plane: ${imageUrl} at (${x}, ${y}, ${z})`);
            });
        }
    }

    await createImagePlanes();
    //console.log("Image paintings initialized.");
})();
