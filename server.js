const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// Create HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server is running');
});

// Set the port based on environment or use 8080 as default
const PORT = process.env.PORT || 8080;

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected players
const players = {};

// Store used names to avoid duplicates
const usedNames = new Set();

// Name generation data for the server
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

// Generate a name that isn't already in use
function generateUniqueName(requestedName = null) {
    // If a name is requested and not already used, grant it
    if (requestedName && !usedNames.has(requestedName)) {
        usedNames.add(requestedName);
        return requestedName;
    }
    
    // Otherwise generate a unique name
    let attempts = 0;
    let name;
    
    do {
        const forename = forenames[Math.floor(Math.random() * forenames.length)];
        const surname = surnames[Math.floor(Math.random() * surnames.length)];
        name = `${forename} ${surname}`;
        attempts++;
        
        // If we've made too many attempts, add a number to ensure uniqueness
        if (attempts > 50) {
            name = `${name} ${Math.floor(Math.random() * 1000)}`;
        }
    } while (usedNames.has(name));
    
    usedNames.add(name);
    return name;
}

// Get the number of connected players
function getPlayerCount() {
    return Object.keys(players).length;
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    // Generate a unique ID for the player
    const playerId = uuidv4();
    let playerName = null;
    
    console.log(`New player connected: ${playerId}`);
    
    // Handle messages from clients
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // Add this log to see all incoming messages
            console.log('[server] Received message:', data);

            switch (data.type) {
                case 'join':
                    // Assign a unique name (either requested or generated)
                    playerName = generateUniqueName(data.name);
                    
                    // Add new player with all data, including score
                    players[playerId] = {
                        position: data.position,
                        rotation: data.rotation || { x: 0, y: 0, z: 0 },
                        color: data.color,
                        model: data.model,
                        name: playerName,
                        score: 0 // Initialize score to 0
                    };
                    
                    // Send the player ID and name
                    ws.send(JSON.stringify({
                        type: 'id',
                        id: playerId,
                        name: playerName,
                        playerCount: getPlayerCount()
                    }));
                    
                    // Broadcast join event with name
                    broadcastToAll({
                        type: 'join',
                        id: playerId,
                        name: playerName
                    });
                    
                    // Send current players to all players
                    broadcastToAll({
                        type: 'players',
                        players: players
                    });
                    
                    // Broadcast player count update
                    broadcastToAll({
                        type: 'playerCount',
                        count: getPlayerCount()
                    });
                    
                    console.log(`Player ${playerId} joined as "${playerName}"`);
                    break;
                    
                case 'update':
                    // Update player position and rotation
                    if (players[playerId]) {
                        players[playerId].position = data.position;
                        
                        // Update rotation if provided
                        if (data.rotation) {
                            players[playerId].rotation = data.rotation;
                        }
                        
                        // Broadcast updated players
                        broadcastToAll({
                            type: 'players',
                            players: players
                        });
                    }
                    break;
                
                case 'playerScore':
                    // Update player's score
                    if (players[playerId]) {
                        players[playerId].score = data.score;
                        
                        // Broadcast updated players with scores
                        broadcastToAll({
                            type: 'players',
                            players: players
                        });
                        
                        // Also send a specific score update message
                        broadcastToAll({
                            type: 'playerScore',
                            id: playerId,
                            name: players[playerId].name,
                            score: data.score
                        });
                    }
                    break;
                
                case 'projectile':
                    // Log when a projectile is received and relayed
                    console.log(`[server] Relaying projectile from ${playerId}:`, data);
                    broadcastToAll(data);
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });
    
    // Handle client disconnection
    ws.on('close', () => {
        console.log(`Player disconnected: ${playerId} (${players[playerId]?.name || 'Unknown'})`);
        
        // Free up the name when a player disconnects
        if (players[playerId] && players[playerId].name) {
            usedNames.delete(players[playerId].name);
        }
        
        // Remove player
        delete players[playerId];
        
        // Broadcast leave event
        broadcastToAll({
            type: 'leave',
            id: playerId,
            name: playerName
        });
        
        // Broadcast updated players list
        broadcastToAll({
            type: 'players',
            players: players
        });
        
        // Broadcast player count update
        broadcastToAll({
            type: 'playerCount',
            count: getPlayerCount() 
        });
    });
});

// Broadcast message to all connected clients
function broadcastToAll(message) {
    const messageStr = JSON.stringify(message);
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});