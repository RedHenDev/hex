const fs = require('fs');
const path = require('path');

const shotsDir = path.join(__dirname, '../assets/shots');
const manifestPath = path.join(shotsDir, 'manifest.json');
const imageExtensions = ['.jpg', '.jpeg', '.png'];

fs.readdir(shotsDir, (err, files) => {
    if (err) {
        console.error('Error reading shots directory:', err);
        process.exit(1);
    }
    const images = files.filter(file =>
        imageExtensions.includes(path.extname(file).toLowerCase())
    );
    fs.writeFile(manifestPath, JSON.stringify(images, null, 2), err => {
        if (err) {
            console.error('Error writing manifest.json:', err);
            process.exit(1);
        }
        console.log(`Manifest generated with ${images.length} images.`);
    });
});
