// Game configuration.
const config = {
    websocketUrl: 'wss://hex-server.glitch.me/',
    playerColors: ['white', 'black'],
    playerModels: ['#mIndom']//, '#mShelby', '#mTrex', '#mBumpy'] // Available models for player avatars
};

// Create a billboard component that makes entities always face the camera
AFRAME.registerComponent('billboard', {
    init: function() {
        this.camera = document.querySelector('#cam').object3D;
    },
    
    tick: function() {
        if (!this.camera) return;
        
        // Get the camera position
        const cameraPosition = new THREE.Vector3();
        this.camera.getWorldPosition(cameraPosition);
        
        // Make this entity face the camera
        this.el.object3D.lookAt(cameraPosition);
        
        // Prevent X and Z rotation to keep text upright
        const rotation = this.el.object3D.rotation;
        rotation.x = 0;
        rotation.z = 0;
    }
});

// Name generation data
const forenames = [
    'Amber', 'Bronze', 'Chrome', 'Diamond', 'Emerald', 'Flint', 'Gold', 
    'Granite', 'Iron', 'Jade', 'Kevlar', 'Lithium', 'Marble', 'Neon', 
    'Obsidian', 'Onyx', 'Pearl', 'Platinum', 'Quartz', 'Ruby', 'Sapphire', 
    'Silver', 'Steel', 'Tanzanite', 'Titanium', 'Topaz', 'Tungsten', 'Uranium',
    'Velvet', 'Zinc'
];

const surnames = [
    'Tyrannosaurus', 'Velociraptor', 'Stegosaurus', 'Triceratops', 'Brachiosaurus',
    'Pterodactyl', 'Ankylosaurus', 'Diplodocus', 'Spinosaurus', 'Allosaurus',
    'Parasaurolophus', 'Carnotaurus', 'Megalosaurus', 'Utahraptor', 'Gallimimus',
    'Protoceratops', 'Brontosaurus', 'Iguanodon', 'Deinonychus', 'Pachycephalosaurus',
    'Archaeopteryx', 'Compsognathus', 'Dilophosaurus', 'Giganotosaurus', 'Oviraptor',
    'Therizinosaurus', 'Microraptor', 'Archaeornithomimus', 'Dreadnoughtus', 'Quetzalcoatlus'
];

// Game state - FIXED: Made socket and playerId global with window prefix
window.socket = null;
window.playerId = null;
window.playerName = null; // Store our player's name
let remotePlayers = {};

// Make player count globally accessible for a-loco.js
window.playerCount = 1;

// Initialize WebSocket connection
document.addEventListener('DOMContentLoaded', () => {
    // Connect to WebSocket server
    connectToServer();
    
    // Start sync loop
    setInterval(syncPlayerPosition, 100);
});

// Generate a unique mathematical name
function generateMathName() {
    const forename = forenames[Math.floor(Math.random() * forenames.length)];
    const surname = surnames[Math.floor(Math.random() * surnames.length)];
    return `${forename} ${surname}`;
}

// Connect to the WebSocket server
function connectToServer() {
    try {
        window.socket = new WebSocket(config.websocketUrl); // FIXED: Use window.socket
        
        window.socket.onopen = () => {
            // Generate a name for our player
            window.playerName = generateMathName(); // FIXED: Explicitly set window.playerName
            
            document.getElementById('connection-status').textContent = 'Connection status: Connecting...';
            
            // Wait a brief moment to ensure the player position is initialized
            setTimeout(() => {
                // Send initial player data with current position
                const playerEntity = document.querySelector('#subject');
                const position = playerEntity.getAttribute('position');
                const camera = document.querySelector('#cam');
                const rotation = camera.object3D.rotation;
                
                window.socket.send(JSON.stringify({
                    type: 'join',
                    position: {
                        x: position.x,
                        y: position.y,
                        z: position.z
                    },
                    rotation: {
                        x: rotation.x,
                        y: rotation.y,
                        z: rotation.z
                    },
                    color: getRandomColor(),
                    model: getRandomModel(),
                    name: window.playerName
                }));
            }, 1000);
        };
        
        window.socket.onmessage = (event) => {
            // Add this log:
            // console.log('[game.js] Received websocket message:', event.data);

            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'id':
                    window.playerId = message.id; // FIXED: Set global playerId
                    console.log(`Connected with ID: ${window.playerId}, Name: ${message.name}`);
                    
                    // If server assigned a different name, update our local name
                    if (message.name && message.name !== window.playerName) {
                        window.playerName = message.name;
                    }
                    
                    // Update connection status with player name
                    document.getElementById('connection-status').textContent = 
                        `Connected as: ${window.playerName} (${message.playerCount} player${message.playerCount !== 1 ? 's' : ''} online)`;
                    break;
                    
                case 'players':
                    updatePlayers(message.players);
                    break;
                    
                case 'join':
                    console.log(`Player joined: ${message.id} (${message.name})`);
                    break;
                    
                case 'leave':
                    console.log(`Player left: ${message.id} (${message.name || 'Unknown'})`);
                    removePlayer(message.id);
                    break;
                    
                case 'playerCount':
                    document.getElementById('connection-status').textContent = 
                        `Connected as: ${window.playerName} (${message.count} player${message.count !== 1 ? 's' : ''} online)`;
                    break;

                case 'impact':
                    // Only apply if this client is the target
                    if (window.playerId && message.targetId === window.playerId) {
                        const subject = document.querySelector('#subject');
                        if (subject && subject.components['subject-locomotion']) {
                            const force = new THREE.Vector3(
                                message.force.x,
                                message.force.y,
                                message.force.z
                            );
                            subject.components['subject-locomotion'].applyImpactForce(force);
                        }
                    }
                    break;
            }
        };
        
        window.socket.onclose = () => {
            document.getElementById('connection-status').textContent = 'Connection status: Disconnected';
            console.log('Connection closed');
            
            // Try to reconnect after 5 seconds
            setTimeout(connectToServer, 5000);
        };
        
        window.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.error('Failed to connect to server:', error);
    }
}

// Random helper functions
function getRandomColor() {
    return config.playerColors[Math.floor(Math.random() * config.playerColors.length)];
}

function getRandomModel() {
    return config.playerModels[Math.floor(Math.random() * config.playerModels.length)];
}

// Sync local player position with server
function syncPlayerPosition() {
    if (!window.socket || window.socket.readyState !== WebSocket.OPEN || !window.playerId) {
        return;
    }
    
    const playerEntity = document.querySelector('#subject');
    if (!playerEntity) return; // Prevent error if player entity is missing

    const position = playerEntity.getAttribute('position');
    
    // Get camera rotation
    const camera = document.querySelector('#cam');
    const rotation = camera.object3D.rotation;
    
    // Send updated position and rotation to server
    window.socket.send(JSON.stringify({
        type: 'update',
        position: {
            x: position.x,
            y: position.y,
            z: position.z
        },
        rotation: {
            x: -rotation.x,
            y: rotation.y+3.14, 
            z: rotation.z
        }
    }));
    
    // Update global player count
    window.playerCount = Object.keys(remotePlayers).length + 1;
    
    // Update nametags to face camera (as an additional fallback)
    for (const id in remotePlayers) {
        const playerEntity = document.getElementById(`player-${id}`);
        if (playerEntity) {
            const nameTag = playerEntity.querySelector('a-text');
            if (nameTag && !nameTag.hasAttribute('billboard')) {
                // If a nametag doesn't have the billboard component, add it
                nameTag.setAttribute('billboard', '');
            }
        }
    }
}

// Update other player entities based on server data
function updatePlayers(playerData) {
    const playersContainer = document.getElementById('players');
    
    // Update existing players and add new ones
    for (const id in playerData) {
        // Skip our own player - we'll handle that separately
        if (id === window.playerId) continue;
        
        const data = playerData[id];
        
        if (!remotePlayers[id]) {
            // Create new player entity
            const playerEntity = document.createElement('a-entity');
            playerEntity.setAttribute('id', `player-${id}`);
            
            // --- Fallback logic for model ---
            let playerModel;
            const modelId = (data.model || config.playerModels[0]).replace('#', '');
            const modelAsset = document.getElementById(modelId);

            if (modelAsset) {
                // Model asset exists, use gltf-model
                playerModel = document.createElement('a-entity');
                playerModel.setAttribute('gltf-model', data.model || config.playerModels[0]);
                playerModel.setAttribute('scale', '8 8 8');
                playerModel.setAttribute('position', '0 -6 0');
                // Animation.
                if (data.model==='#mIndom'){
                    playerModel.setAttribute('animation-mixer', 'clip: Walk; loop: repeat; crossFadeDuration: 0.3');
                }
                // Add color to model if specified
                if (data.color) {
                    playerModel.setAttribute('material', `color: ${data.color}`);
                }
            } else {
                // Fallback: use a sphere with favicon texture
                playerModel = document.createElement('a-sphere');
                playerModel.setAttribute('radius', '6');
                playerModel.setAttribute('segments-width', '18');
                playerModel.setAttribute('segments-height', '12');
                playerModel.setAttribute('position', '0 6 0');
                playerModel.setAttribute('src', '#player-fallback');
                playerModel.setAttribute('material', 'shader: standard; transparent: true;');
            }
            // --- End fallback logic ---

            // Create name tag background panel
            // const nameBg = document.createElement('a-plane');
            // nameBg.setAttribute('width', '18');
            // nameBg.setAttribute('height', '4');
            // nameBg.setAttribute('position', '0 12.01 0'); // Slightly behind the text
            // if (data.color === 'white') nameBg.setAttribute('color', '#222'); // Contrasting dark background
            // else nameBg.setAttribute('color', '#fff'); // Default white background.
            // nameBg.setAttribute('opacity', '0.75');
            // nameBg.setAttribute('side', 'double');
            // nameBg.setAttribute('billboard', '');

            // Create name tag (floating text above player)
            const nameTag = document.createElement('a-text');
            nameTag.setAttribute('value', data.name || 'Unknown Player');
            nameTag.setAttribute('position', '0 12.05 0.01'); // Slightly in front of the panel
            nameTag.setAttribute('align', 'center');
            nameTag.setAttribute('scale', '8 8 8');
            nameTag.setAttribute('color', data.color || '#FFFFFF');
            nameTag.setAttribute('billboard', '');

            // Add model, background, and name tag to player entity
            playerEntity.appendChild(playerModel);
            // playerEntity.appendChild(nameBg);
            playerEntity.appendChild(nameTag);
            
            // Add player entity to the scene
            playersContainer.appendChild(playerEntity);
            
            console.log(`Created new remote player: ${data.name || 'Unknown'} with model ${data.model || 'default'}`);
            
            // Store player data
            remotePlayers[id] = data;
        }
        
        // Update player position
        const playerEntity = document.getElementById(`player-${id}`);
        if (playerEntity) {
            playerEntity.setAttribute('position', `${data.position.x} ${data.position.y} ${data.position.z}`);
            
            // Update player rotation if available
            if (data.rotation) {
                // Apply rotation to the model, not the parent entity (which contains the name tag)
                const playerModel = playerEntity.querySelector('[gltf-model]');
                if (playerModel) {
                    playerModel.setAttribute('rotation', {
                        x: data.rotation.x * (180/Math.PI), // Convert radians to degrees
                        y: data.rotation.y * (180/Math.PI),
                        z: data.rotation.z * (180/Math.PI)
                    });
                }
            }
        }
        
        // Update stored player data
        remotePlayers[id] = data;
    }
    
    // Remove players that are no longer in the data
    for (const id in remotePlayers) {
        if (!playerData[id]) {
            removePlayer(id);
        }
    }
}

// Remove a player who left the game
function removePlayer(id) {
    const playerEntity = document.getElementById(`player-${id}`);
    if (playerEntity) {
        playerEntity.parentNode.removeChild(playerEntity);
        console.log(`Removed player entity for ${remotePlayers[id]?.name || id}`);
    }
    
    delete remotePlayers[id];
}