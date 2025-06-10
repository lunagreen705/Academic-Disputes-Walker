// 引入 MongoDB 官方模組
const { MongoClient } = require('mongodb');

// 引入自定義的 UI 顏色樣式（用於 console 輸出好看）
const colors = require('./UI/colors/colors');

// 引入設定檔，這裡的 config.js 預期包含 mongodbUri 等設定
const config = require("../../config.js");

// 載入 .env 檔案的環境變數
require('dotenv').config();

let client; // MongoDB 客戶端實例容器

// 檢查 config 裡是否有設定 URI，如果有就用來建立 client
if (config.mongodbUri) {
    const uri = config.mongodbUri;
    client = new MongoClient(uri);
} else {
    // 如果沒有設定，給使用者黃色警告
    console.warn("\x1b[33m[ WARNING ]\x1b[0m MongoDB URI is not defined in the configuration.");
}

// 非同步函式：負責實際與 MongoDB 建立連線
async function connectToDatabase() {
    if (!client) {
        // 若沒設 URI 則跳過連線
        console.warn("\x1b[33m[ WARNING ]\x1b[0m Skipping MongoDB connection as URI is not provided.");
        return;
    }

    try {
        // 連接資料庫
        await client.connect();
        console.log('\n' + '─'.repeat(40));
        console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE CONNECTION${colors.reset}`);
        console.log('─'.repeat(40));
        console.log('\x1b[36m[ DATABASE ]\x1b[0m', '\x1b[32mConnected to MongoDB ✅\x1b[0m');
    } catch (err) {
        // 如果出錯，顯示錯誤訊息
        console.warn("\x1b[33m[ WARNING ]\x1b[0m Could not connect to MongoDB. Continuing without database functionality.");
        console.error(err.message); // 顯示錯誤訊息
    }
}

// 如果 client 存在，就指定資料庫與其兩個 collection
const db = client ? client.db("PrimeMusicSSRR") : null;
const playlistCollection = db ? db.collection("SongPlayLists") : null;
const autoplayCollection = db ? db.collection("AutoplaySettings") : null;

// 匯出模組函式與集合物件供外部使用
module.exports = {
    connectToDatabase,
    playlistCollection,
    autoplayCollection,
};
