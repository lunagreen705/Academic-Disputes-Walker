// utils/affectionManager.js
const fs = require('fs').promises; // 使用 fs.promises 進行非同步操作
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'user_affection.json');

let userAffectionData = {};
let saveTimeout = null; // 用於去抖的定時器
let isDataLoaded = false; // 追蹤資料是否已載入的狀態
let dataLoadingPromise = null; // 儲存資料載入的 Promise

// 保存資料的去抖函數
function debounceSaveAffectionData() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(async () => {
        try {
            await fs.writeFile(DATA_FILE, JSON.stringify(userAffectionData, null, 2), 'utf8');
            console.log(`[AffectionManager] Saved affection data to: ${DATA_FILE} at ${new Date().toISOString()}`);
        } catch (error) {
            console.error(`[AffectionManager] Error saving affection data to ${DATA_FILE}:`, error);
        } finally {
            saveTimeout = null;
        }
    }, 2000); // 2 秒的去抖延遲
}

/**
 * 載入用戶好感度資料到記憶體中。
 */
async function loadAffectionData() {
    if (dataLoadingPromise) {
        return dataLoadingPromise;
    }

    dataLoadingPromise = new Promise(async (resolve, reject) => {
        try {
            await fs.access(DATA_FILE);
            const data = await fs.readFile(DATA_FILE, 'utf8');
            userAffectionData = JSON.parse(data);
            console.log(`[AffectionManager] Loaded affection data from: ${DATA_FILE}`);
            isDataLoaded = true;
            resolve();
        } catch (error) {
            if (error.code === 'ENOENT') { // 如果檔案不存在
                userAffectionData = {};
                await fs.writeFile(DATA_FILE, '{}', 'utf8'); // 創建空檔案
                console.log(`[AffectionManager] Created new affection data file: ${DATA_FILE}`);
                isDataLoaded = true;
                resolve();
            } else {
                console.error(`[AffectionManager] Error loading affection data from ${DATA_FILE}:`, error);
                userAffectionData = {}; // 載入失敗時，將記憶體資料清空
                reject(error);
            }
        } finally {
            if (!isDataLoaded) {
                dataLoadingPromise = null;
            }
        }
    });
    return dataLoadingPromise;
}

/**
 * 獲取指定用戶的好感度。
 * @param {string} userId - 用戶的 Discord ID。
 * @returns {number} 該用戶的好感度，如果不存在則為 0。
 */
function getAffection(userId) {
    // 確保用戶數據結構存在，即使沒有好感度紀錄
    if (!userAffectionData[userId]) {
        userAffectionData[userId] = { affection: 0, lastGreetingTimestamp: 0 }; // 儲存時間戳
    }
    return userAffectionData[userId].affection;
}

/**
 * 獲取今天的午夜時間戳 (毫秒)。
 * 這樣比較時就能判斷是否跨越了日期。
 */
function getTodayMidnightTimestamp() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 將時間設為當天 00:00:00.000
    return today.getTime(); // 返回毫秒時間戳
}

/**
 * 檢查用戶今天是否已經觸發過問候語。
 * @param {string} userId - 用戶的 Discord ID。
 * @returns {boolean} 如果今天已經觸發過，則為 true，否則為 false。
 */
function hasGreetedToday(userId) {
    if (!userAffectionData[userId] || !userAffectionData[userId].lastGreetingTimestamp) {
        return false; // 如果沒有紀錄，當然就是還沒問候過
    }

    const lastTimestamp = userAffectionData[userId].lastGreetingTimestamp;
    const todayMidnight = getTodayMidnightTimestamp();

    // 如果上次問候的時間戳大於或等於今天的午夜時間戳，表示上次問候在今天
    return lastTimestamp >= todayMidnight;
}

/**
 * 增加指定用戶的好感度。
 * @param {string} userId - 用戶的 Discord ID。
 * @param {number} amount - 要增加的好感度數量 (預設為 1)。
 * @returns {Promise<number|false>} 更新後的好感度。如果今天已經觸發過，則返回 false。
 */
async function addAffection(userId, amount = 1) {
    if (!isDataLoaded) {
        console.log("[AffectionManager] Data not yet loaded. Waiting to add affection...");
        await loadAffectionData();
    }

    if (!userAffectionData[userId]) {
        userAffectionData[userId] = { affection: 0, lastGreetingTimestamp: 0 }; // 初始化為 0
    }

    if (hasGreetedToday(userId)) {
        console.log(`[AffectionManager] User ${userId} has already greeted today. Affection not added.`);
        return false; // 返回 false 表示今天已觸發過
    }

    userAffectionData[userId].affection += amount;
    userAffectionData[userId].lastGreetingTimestamp = Date.now(); // 儲存當前時間戳
    debounceSaveAffectionData();
    return userAffectionData[userId].affection;
}

// 模組初始化時，自動啟動資料載入過程
loadAffectionData().catch(err => {
    console.error("[AffectionManager] Initial data load failed at module start-up:", err);
});

module.exports = {
    getAffection,
    addAffection,
    hasGreetedToday, // 導出這個函數，讓 messageCreate.js 可以判斷
};
