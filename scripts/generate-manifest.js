/*
Steps to run:

Open a terminal
Navigate to the script's directory
Run the script using Node.js
generate-manifest.js
No changes needed to the file itself. Since this is a Node.js script, you can run it from the command line like this:

cd /Users/bnew/Documents/General_Dev/Cloned_gits/hex/scripts
node generate-manifest.js

When run successfully, it will:

Look for image files in the ../assets/shots directory
Create or update a manifest.json file in that same directory
Output a message showing how many images were found
Exit with an error if there are any file system issues
Make sure the assets/shots directory exists and contains some images before running the script.
*/

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
