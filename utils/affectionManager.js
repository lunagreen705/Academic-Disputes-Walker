// utils/affectionManager.js
const fs = require('fs');
const path = require('path');

// 定義好感度資料檔案的絕對路徑
// __dirname 指向當前檔案 (affectionManager.js) 的目錄
// '..' 向上一個目錄 (your-discord-bot/utils -> your-discord-bot/)
// 'data' 進入 data 目錄
const DATA_FILE = path.join(__dirname, '..', 'data', 'user_affection.json');

// 在模組啟動時就載入一次資料，並保持在記憶體中
// 這樣可以減少每次讀取檔案的I/O操作
let userAffectionData = {};

/**
 * 載入用戶好感度資料到記憶體中。
 * 如果檔案不存在，則會創建一個空的 JSON 檔案並初始化資料。
 */
function loadAffectionData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            // 如果檔案不存在，則創建一個空的 JSON 物件並寫入
            fs.writeFileSync(DATA_FILE, '{}', 'utf8');
            userAffectionData = {};
            console.log(`[AffectionManager] Created new affection data file: ${DATA_FILE}`);
            return;
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        userAffectionData = JSON.parse(data);
        console.log(`[AffectionManager] Loaded affection data from: ${DATA_FILE}`);
    } catch (error) {
        console.error(`[AffectionManager] Error loading affection data from ${DATA_FILE}:`, error);
        userAffectionData = {}; // 載入失敗時，將記憶體資料清空
    }
}

/**
 * 將記憶體中的好感度資料儲存到檔案。
 */
function saveAffectionData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(userAffectionData, null, 2), 'utf8');
        console.log(`[AffectionManager] Saved affection data to: ${DATA_FILE}`);
    } catch (error) {
        console.error(`[AffectionManager] Error saving affection data to ${DATA_FILE}:`, error);
    }
}

/**
 * 獲取指定用戶的好感度。
 * @param {string} userId - 用戶的 Discord ID。
 * @returns {number} 該用戶的好感度，如果不存在則為 0。
 */
function getAffection(userId) {
    return userAffectionData[userId] || 0;
}

/**
 * 增加指定用戶的好感度。
 * @param {string} userId - 用戶的 Discord ID。
 * @param {number} amount - 要增加的好感度數量 (預設為 1)。
 * @returns {number} 更新後的好感度。
 */
function addAffection(userId, amount = 1) {
    if (!userAffectionData[userId]) {
        userAffectionData[userId] = 0;
    }
    userAffectionData[userId] += amount;
    saveAffectionData(); // 每次更新後都儲存
    return userAffectionData[userId];
}

// 模組初始化時，自動載入資料
loadAffectionData();

module.exports = {
    getAffection,
    addAffection,
    // 如果需要，也可以導出 load/save 方法，但通常不需要外部直接呼叫
    // loadAffectionData,
    // saveAffectionData,
};
