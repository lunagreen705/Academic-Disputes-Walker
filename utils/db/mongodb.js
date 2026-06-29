// mongodb.js
const { MongoClient } = require('mongodb');
require('dotenv').config(); // 確保你可以從 .env 檔案讀取環境變數
const config = require("../../config.js"); // 你的本地設定檔
const colors = require('../../UI/colors/colors');

const mongoURI = process.env.mongodbUri || config.mongodbUri; // 從環境變數或本地設定檔獲取 MongoDB URI
let client; // MongoDB 連線客戶端實例

// --- 音樂功能相關變數 ---
let musicDb;
let playlistCollection;
let autoplayCollection;
// ------------------------------------

// --- Telegram 訂閱者相關變數 ---
let telegramDb;
let tgSubscribersCollection;
// ------------------------------------

// --- TRPG CoC 跑團相關變數 ---
let trpgDb;
let cocCharacterCollection;
let trpgSessionLogCollection;
let trpgLogStateCollection; // <--- 新增這一行：用於儲存日誌狀態
// ------------------------------------

// --- Google OAuth2 Token 相關變數 ---
let googleDb;
let googleTokensCollection;
// ------------------------------------

/**
 * 連接到 MongoDB 資料庫，並初始化所有必要的集合。
 * 如果 MongoDB URI 未定義或連接失敗，將發出警告並允許應用程式繼續運行（不帶資料庫功能）。
 */
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

        // --- 初始化音樂功能資料庫和集合 ---
        musicDb = client.db("Academic-Disputes-music");
        playlistCollection = musicDb.collection("SongPlayLists");
        autoplayCollection = musicDb.collection("AutoplaySettings");

        // --- 初始化 TRPG CoC 跑團相關資料庫和集合 ---
        trpgDb = client.db("TRPG-CoC-Records");
        cocCharacterCollection = trpgDb.collection("CoCCharacters");
        trpgSessionLogCollection = trpgDb.collection("TRPGSessions");
        trpgLogStateCollection = trpgDb.collection("TRPGLogStates"); // <--- 新增這一行：初始化集合

        // --- 初始化 Google OAuth2 Token 相關資料庫和集合 ---
        googleDb = client.db("google");
        googleTokensCollection = googleDb.collection("token");

        // --- 初始化 Telegram 訂閱者相關資料庫和集合 ---
    telegramDb = client.db("Telegram-Bot");
    tgSubscribersCollection = telegramDb.collection("Subscribers");

        // --- 連線成功日誌 ---
        console.log('\n' + '─'.repeat(40));
        console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE CONNECTION${colors.reset}`);
        console.log('─'.repeat(40));
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', '\x1b[32mConnected to MongoDB ✅\x1b[0m');
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - Music DB: "${musicDb.databaseName}"`);
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - TRPG DB:  "${trpgDb.databaseName}"`);
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - Google Auth DB:  "${googleDb.databaseName}"`);
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - Telegram DB:  "${telegramDb.databaseName}"`);

    } catch (err) {
        console.warn("\x1b[33m[ WARNING ]\x1b[0m Could not connect to MongoDB. Continuing without database functionality.");
        console.error("MongoDB Connection Error:", err.message);
        client = null;
    }
}

/**
 * 取得所有已初始化的 MongoDB 集合。
 * 如果任何集合未初始化，將拋出錯誤。
 * @returns {Object} 包含所有集合的物件
 */
function getCollections() {
    if (!playlistCollection || !autoplayCollection || !cocCharacterCollection || !trpgSessionLogCollection || !googleTokensCollection || !trpgLogStateCollection) { // <--- 新增檢查
        throw new Error("❌ One or more collections not initialized. Did you forget to call connectToDatabase() or did the connection fail?");
    }
    return {
        // 匯出音樂相關集合
        playlistCollection,
        autoplayCollection,

        // 匯出 TRPG 相關集合
        cocCharacterCollection,
        trpgSessionLogCollection,
        trpgLogStateCollection, 
        // 匯出 TG 相關集合
        tgSubscribersCollection,
        // 匯出 Google 相關集合
        googleTokensCollection,
    };
}

module.exports = {
    connectToDatabase,
    getCollections,
};