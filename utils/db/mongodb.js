const { MongoClient } = require('mongodb');
require('dotenv').config(); // 確保你可以從 .env 檔案讀取環境變數
const config = require("../../config.js"); // 你的本地設定檔
const colors = require('../../UI/colors/colors'); // 用於控制台顏色輸出

const mongoURI = process.env.mongodbUri || config.mongodbUri; // 從環境變數或本地設定檔獲取 MongoDB URI
let client; // MongoDB 連線客戶端實例

// --- 音樂功能相關變數 ---
let musicDb; // 指向 "Academic-Disputes-music" 資料庫
let playlistCollection; // "SongPlayLists" 集合
let autoplayCollection; // "AutoplaySettings" 集合
// ------------------------------------

// --- TRPG CoC 跑團相關變數 ---
let trpgDb; // 指向 "TRPG-CoC-Records" 資料庫
let cocCharacterCollection; // "CoCCharacters" 集合
let trpgSessionLogCollection; // "TRPGSessions" 集合
// ------------------------------------

// --- Google OAuth2 Token 相關變數 ---
let googleDb; // 指向 'google' 資料庫
let googleTokensCollection; // 指向 'token' 集合
// ------------------------------------

/**
 * 連接到 MongoDB 資料庫，並初始化所有必要的集合。
 * 如果 MongoDB URI 未定義或連接失敗，將發出警告並允許應用程式繼續運行（不帶資料庫功能）。
 */
async function connectToDatabase() {
    if (!mongoURI) {
        console.warn("\x1b[33m[ WARNING ]\x1b[0m MongoDB URI is not defined in the configuration. Please set 'mongodbUri' in your .env file or config.js.");
        return; // 如果沒有 URI，則不嘗試連接
    }

    // 如果客戶端實例不存在，則創建一個新的
    if (!client) {
        client = new MongoClient(mongoURI);
    }

    try {
        // 只有當客戶端尚未連接或連接已被銷毀時才重新連接
        if (!client.topology || client.topology.isDestroyed()) {
            await client.connect(); // 建立與 MongoDB 集群的單一連接
        }

        // --- 初始化音樂功能資料庫和集合 ---
        musicDb = client.db("Academic-Disputes-music");
        playlistCollection = musicDb.collection("SongPlayLists");
        autoplayCollection = musicDb.collection("AutoplaySettings");

        // --- 初始化 TRPG CoC 跑團相關資料庫和集合 ---
        trpgDb = client.db("TRPG-CoC-Records");
        cocCharacterCollection = trpgDb.collection("CoCCharacters");
        trpgSessionLogCollection = trpgDb.collection("TRPGSessions");

        // --- 初始化 Google OAuth2 Token 相關資料庫和集合 ---
        // *** 根據你的實際截圖修正資料庫和集合名稱 ***
        googleDb = client.db("google"); // 使用你實際的資料庫名稱 'google'
        googleTokensCollection = googleDb.collection("token"); // 使用你實際的集合名稱 'token'

        // --- 連線成功日誌 ---
        console.log('\n' + '─'.repeat(40));
        console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE CONNECTION${colors.reset}`);
        console.log('─'.repeat(40));
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', '\x1b[32mConnected to MongoDB ✅\x1b[0m');
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - Music DB: "${musicDb.databaseName}"`);
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - TRPG DB:  "${trpgDb.databaseName}"`);
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', `  - Google Auth DB:  "${googleDb.databaseName}"`); // 更新這裡的日誌顯示

    } catch (err) {
        // --- 連線失敗日誌 ---
        console.warn("\x1b[33m[ WARNING ]\x1b[0m Could not connect to MongoDB. Continuing without database functionality.");
        console.error("MongoDB Connection Error:", err.message); // 輸出更詳細的錯誤訊息
        // 將客戶端設為 null，確保下次調用 connectToDatabase 會重新嘗試連接
        client = null;
    }
}

/**
 * 取得所有已初始化的 MongoDB 集合。
 * 如果任何集合未初始化，將拋出錯誤。
 * @returns {Object} 包含所有集合的物件
 */
function getCollections() {
    // 檢查所有必要的集合是否都已成功初始化
    if (!playlistCollection || !autoplayCollection || !cocCharacterCollection || !trpgSessionLogCollection || !googleTokensCollection) {
        // 如果有任何一個集合是 undefined 或 null，則表示 connectToDatabase 未成功完成
        throw new Error("❌ One or more collections not initialized. Did you forget to call connectToDatabase() or did the connection fail?");
    }
    return {
        // 匯出音樂功能相關集合
        playlistCollection,
        autoplayCollection,

        // 匯出 TRPG CoC 跑團相關集合
        cocCharacterCollection,
        trpgSessionLogCollection,

        // 匯出 Google OAuth2 Token 相關集合
        googleTokensCollection,
    };
}

module.exports = {
    connectToDatabase,
    getCollections,
};