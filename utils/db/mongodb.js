// mongodb.js
const { MongoClient } = require('mongodb');
require('dotenv').config();
const config = require("../../config.js");
const colors = require('../../UI/colors/colors');

const mongoURI = process.env.mongodbUri || config.mongodbUri;
let client;

let musicDb;
let playlistCollection;
let autoplayCollection;

let telegramDb;
let tgSubscribersCollection;

let trpgDb;
let cocCharacterCollection;
let trpgSessionLogCollection;
let trpgLogStateCollection;

let googleDb;
let googleTokensCollection;

async function connectToDatabase() {
    if (!mongoURI) {
        console.warn("\x1b[33m[ WARNING ]\x1b[0m MongoDB URI is not defined in the configuration. Please set 'mongodbUri' in your .env file or config.js.");
        return;
    }

    if (!client) {
        client = new MongoClient(mongoURI);
    }

    try {
        if (!client.topology || client.topology.isDestroyed()) {
            await client.connect();
        }

        musicDb = client.db("Academic-Disputes-music");
        playlistCollection = musicDb.collection("SongPlayLists");
        autoplayCollection = musicDb.collection("AutoplaySettings");

        trpgDb = client.db("TRPG-CoC-Records");
        cocCharacterCollection = trpgDb.collection("CoCCharacters");
        trpgSessionLogCollection = trpgDb.collection("TRPGSessions");
        trpgLogStateCollection = trpgDb.collection("TRPGLogStates");

        googleDb = client.db("google");
        googleTokensCollection = googleDb.collection("token");

        telegramDb = client.db("Telegram-Bot");
        tgSubscribersCollection = telegramDb.collection("Subscribers");

        console.log('\n' + '─'.repeat(40));
        console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE CONNECTION${colors.reset}`);
        console.log('─'.repeat(40));
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', '\x1b[32mConnected to MongoDB ✅\x1b[0m');
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - Music DB: "${musicDb.databaseName}"`);
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - TRPG DB:  "${trpgDb.databaseName}"`);
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - Google Auth DB:  "${googleDb.databaseName}"`);
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - Telegram DB:  "${telegramDb.databaseName}"`);

        // 個別檢查每個集合，方便定位是哪個沒成功
        if (!tgSubscribersCollection) {
            console.warn(`${colors.yellow}[ WARNING ]${colors.reset} ⚠️ tgSubscribersCollection 初始化失敗`);
        }

    } catch (err) {
        console.warn("\x1b[33m[ WARNING ]\x1b[0m Could not connect to MongoDB. Continuing without database functionality.");
        console.error("MongoDB Connection Error:", err.message);
        client = null;
    }
}

function getCollections() {
    if (!playlistCollection || !autoplayCollection || !cocCharacterCollection || !trpgSessionLogCollection || !googleTokensCollection || !trpgLogStateCollection || !tgSubscribersCollection) {
        // 列出哪些集合是 undefined，方便排查
        const missing = [];
        if (!playlistCollection) missing.push('playlistCollection');
        if (!autoplayCollection) missing.push('autoplayCollection');
        if (!cocCharacterCollection) missing.push('cocCharacterCollection');
        if (!trpgSessionLogCollection) missing.push('trpgSessionLogCollection');
        if (!trpgLogStateCollection) missing.push('trpgLogStateCollection');
        if (!googleTokensCollection) missing.push('googleTokensCollection');
        if (!tgSubscribersCollection) missing.push('tgSubscribersCollection');

        throw new Error(`❌ Collections not initialized: [${missing.join(', ')}]. Did you forget to call connectToDatabase() or did the connection fail?`);
    }
    return {
        playlistCollection,
        autoplayCollection,
        cocCharacterCollection,
        trpgSessionLogCollection,
        trpgLogStateCollection,
        tgSubscribersCollection,
        googleTokensCollection,
    };
}

module.exports = {
    connectToDatabase,
    getCollections,
};