// utils/affectionManager.js
const fs = require('fs').promises; // 使用 fs.promises 進行非同步操作
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'user_affection.json');

let userAffectionData = {};
let saveTimeout = null; // 用於去抖的定時器
let isDataLoaded = false; // 新增：追蹤資料是否已載入的狀態
let dataLoadingPromise = null; // 新增：儲存資料載入的 Promise

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
            // 這裡可以加入更複雜的錯誤處理，例如發送通知給管理員
        } finally {
            saveTimeout = null; // 清除定時器
        }
    }, 2000); // 2 秒的去抖延遲，可以根據需要調整
}

/**
 * 載入用戶好感度資料到記憶體中。
 * 這個函數現在會返回一個 Promise，表示載入狀態。
 */
async function loadAffectionData() {
    if (dataLoadingPromise) {
        return dataLoadingPromise; // 如果正在載入，返回現有的 Promise
    }

    dataLoadingPromise = new Promise(async (resolve, reject) => {
        try {
            await fs.access(DATA_FILE); // 檢查檔案是否存在
            const data = await fs.readFile(DATA_FILE, 'utf8');
            userAffectionData = JSON.parse(data);
            console.log(`[AffectionManager] Loaded affection data from: ${DATA_FILE}`);
            isDataLoaded = true; // 標記資料已載入
            resolve();
        } catch (error) {
            if (error.code === 'ENOENT') { // 如果檔案不存在
                userAffectionData = {};
                await fs.writeFile(DATA_FILE, '{}', 'utf8'); // 創建空檔案
                console.log(`[AffectionManager] Created new affection data file: ${DATA_FILE}`);
                isDataLoaded = true; // 標記資料已載入
                resolve();
            } else {
                console.error(`[AffectionManager] Error loading affection data from ${DATA_FILE}:`, error);
                userAffectionData = {}; // 載入失敗時，將記憶體資料清空
                reject(error); // 拒絕 Promise
            }
        } finally {
            // 無論成功或失敗，在載入過程結束後，清除 dataLoadingPromise
            // 這樣下次呼叫時會重新開始載入，或如果發生錯誤，下次有機會重試
            // 但如果資料載入失敗，isDataLoaded 應該保持為 false，避免後續操作出錯
            if (!isDataLoaded) { // 只有在確定載入成功才設為 true
                dataLoadingPromise = null; // 失敗時允許再次嘗試載入
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
    // 即使數據尚未完全載入，理論上也可以獲取，但返回的可能是舊數據或 0
    return userAffectionData[userId] || 0;
}

/**
 * 增加指定用戶的好感度。
 * @param {string} userId - 用戶的 Discord ID。
 * @param {number} amount - 要增加的好感度數量 (預設為 1)。
 * @returns {Promise<number>} 更新後的好感度。因為可能需要等待資料載入。
 */
async function addAffection(userId, amount = 1) {
    if (!isDataLoaded) {
        // 如果資料還沒載入，就等待載入完成
        console.log("[AffectionManager] Data not yet loaded. Waiting to add affection...");
        await loadAffectionData(); // 等待載入完成
    }

    if (!userAffectionData[userId]) {
        userAffectionData[userId] = 0;
    }
    userAffectionData[userId] += amount;
    debounceSaveAffectionData(); // 使用去抖函數儲存
    return userAffectionData[userId];
}

// 模組初始化時，自動啟動資料載入過程
// 這個 Promise 會在第一次被 require 時啟動
// 雖然 bot.js 不會直接 await 它，但 addAffection 會等待
loadAffectionData().catch(err => {
    console.error("[AffectionManager] Initial data load failed at module start-up:", err);
    // 在這裡可以考慮更多錯誤處理，例如：
    // 如果資料載入失敗，機器人是否應該退出？還是繼續運行但不處理好感度？
    // 目前的設計是，即使載入失敗，isDataLoaded 仍為 false，addAffection 會重試載入。
});

module.exports = {
    getAffection,
    addAffection,
    // 不再導出 loadAffectionData，因為我們不想外部呼叫它，
    // 或者如果需要用於特殊情況（例如測試），可以導出但明確說明其用途。
};
