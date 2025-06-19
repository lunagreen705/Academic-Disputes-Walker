const { MongoClient } = require('mongodb');
require('dotenv').config();
const config = require("../../config.js");
const colors = require('../../UI/colors/colors');

const mongoURI = process.env.mongodbUri || config.mongodbUri;
let client;

// --- 音樂功能相關變數 (保持不變) ---
let db; // 這個變數將繼續指向 "Academic-Disputes-music" 資料庫
let playlistCollection;
let autoplayCollection;
// ------------------------------------

// --- 新增 TRPG CoC 跑團相關變數 ---
let trpgDb; // 新增一個變數，用於指向 TRPG 的資料庫實例
let cocCharacterCollection; // 用於 CoC 角色卡集合
let trpgSessionLogCollection; // 用於跑團紀錄集合
// ------------------------------------

async function connectToDatabase() {
    if (!mongoURI) {
        console.warn("\x1b[33m[ WARNING ]\x1b[0m MongoDB URI is not defined in the configuration.");
        return;
    }

    if (!client) client = new MongoClient(mongoURI);

    try {
        if (!client.topology || client.topology.isDestroyed()) {
            await client.connect(); // 建立與 MongoDB 集群的單一連接
        }

        // --- 初始化音樂功能資料庫和集合 (保持不變) ---
        db = client.db("Academic-Disputes-music");
        playlistCollection = db.collection("SongPlayLists");
        autoplayCollection = db.collection("AutoplaySettings");
        // ------------------------------------------------

        // --- 初始化 TRPG CoC 跑團相關資料庫和集合 ---
        // 指向一個新的資料庫，名稱為 "TRPG-CoC-Records"
        trpgDb = client.db("TRPG-CoC-Records");
        cocCharacterCollection = trpgDb.collection("CoCCharacters"); // 儲存 CoC 角色卡
        trpgSessionLogCollection = trpgDb.collection("TRPGSessions"); // 儲存跑團紀錄
        // ------------------------------------------------

        console.log('\n' + '─'.repeat(40));
        console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE CONNECTION${colors.reset}`);
        console.log('─'.repeat(40));
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', '\x1b[32mConnected to MongoDB ✅\x1b[0m');
        // 新增日誌輸出，讓你知道連接了哪些資料庫
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - Music DB: "${db.databaseName}"`);
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - TRPG DB:  "${trpgDb.databaseName}"`);

    } catch (err) {
        console.warn("\x1b[33m[ WARNING ]\x1b[0m Could not connect to MongoDB. Continuing without database functionality.");
        console.error(err.message);
    }
}

function getCollections() {
    // 檢查所有需要的集合是否都已初始化
    if (!playlistCollection || !autoplayCollection || !cocCharacterCollection || !trpgSessionLogCollection) {
        throw new Error("❌ One or more collections not initialized. Did you forget to call connectToDatabase()?");
    }
    return {
        // --- 匯出音樂功能相關集合 (保持不變) ---
        playlistCollection,
        autoplayCollection,
        // ------------------------------------------

        // --- 匯出 TRPG CoC 跑團相關集合 ---
        cocCharacterCollection,
        trpgSessionLogCollection,
        // ------------------------------------
    };
}

module.exports = {
    connectToDatabase,
    getCollections,
};