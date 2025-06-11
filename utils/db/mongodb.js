// db.js
const { MongoClient } = require('mongodb');
require('dotenv').config();
const config = require("../../config.js");
const colors = require('../../UI/colors/colors');

const mongoURI = process.env.mongodbUri || config.mongodbUri;
let client;
let db;
let playlistCollection;
let autoplayCollection;

async function connectToDatabase() {
    if (!mongoURI) {
        console.warn("\x1b[33m[ WARNING ]\x1b[0m MongoDB URI is not defined in the configuration.");
        return;
    }

    if (!client) client = new MongoClient(mongoURI);

    try {
        if (!client.topology || client.topology.isDestroyed()) {
            await client.connect();
        }

        db = client.db("PrimeMusicSSRR");
        playlistCollection = db.collection("SongPlayLists");
        autoplayCollection = db.collection("AutoplaySettings");

        console.log('\n' + '─'.repeat(40));
        console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE CONNECTION${colors.reset}`);
        console.log('─'.repeat(40));
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', '\x1b[32mConnected to MongoDB ✅\x1b[0m');
    } catch (err) {
        console.warn("\x1b[33m[ WARNING ]\x1b[0m Could not connect to MongoDB. Continuing without database functionality.");
        console.error(err.message);
    }
}

function getCollections() {
    if (!playlistCollection || !autoplayCollection) {
        throw new Error("❌ Collection not initialized. Did you forget to call connectToDatabase()?");
    }
    return { playlistCollection, autoplayCollection };
}

module.exports = {
    connectToDatabase,
    getCollections,
};