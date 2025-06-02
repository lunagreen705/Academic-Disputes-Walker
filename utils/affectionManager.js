const fs = require('fs'); // 使用同步檔案系統模組
const path = require('path');

// --- 檔案路徑定義 ---
// 好感度資料路徑
// 假設這個檔案在 ./data/user_affection.json
// 在 Render 等部署環境中，你可能需要考慮 /tmp 路徑的可寫入性
// 如果你希望數據在服務重啟後也能保留，且不考慮 GitHub 同步，你可能需要Render的持久化磁碟 (Persistent Disks) 功能。
// 這裡保留你原始的相對路徑設定，但請注意部署環境的寫入權限。
const dataPath = path.join(__dirname, '../data/user_affection.json');
// 回應語句資料路徑
const responsePath = path.join(__dirname, '../data/affection/affectionResponses.json');

// --- 數據容器與載入 ---
let data = {}; // 載入好感度數據的容器
let affectionResponses = {}; // 載入回應語句數據的容器

// 在模組載入時就嘗試載入回應語句，避免重複讀取
try {
    // 檢查 responsePath 的父目錄是否存在，如果不存在則 require 會失敗
    const responseDir = path.dirname(responsePath);
    if (!fs.existsSync(responseDir)) {
        console.warn(`[AffectionManager] Warning: Response directory "${responseDir}" not found. Cannot load responses.`);
        // 可以在此處創建目錄或讓後續的 require 失敗
    }
    affectionResponses = require(responsePath);
    console.log(`[AffectionManager] Loaded response data from: ${responsePath}`);
} catch (error) {
    console.error(`[AffectionManager] Error loading affection responses from ${responsePath}:`, error.message);
    affectionResponses = {}; // 確保即使載入失敗，物件也存在
}


// --- 核心功能函式 ---

/**
 * 載入好感度資料。
 * 如果檔案不存在，則會建立一個空的 JSON 檔案。
 * 如果父目錄不存在，也會嘗試創建。
 */
function loadData() {
    const dataDir = path.dirname(dataPath);
    try {
        // 確保資料目錄存在，如果不存在則創建
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`[AffectionManager] Created data directory: ${dataDir}`);
        }

        if (fs.existsSync(dataPath)) {
            const raw = fs.readFileSync(dataPath, 'utf8');
            data = JSON.parse(raw);
            console.log(`[AffectionManager] Loaded affection data from: ${dataPath}`);
        } else {
            // 如果檔案不存在，建立一個空的 JSON 檔案
            data = {};
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
            console.log(`[AffectionManager] Created new empty affection data file: ${dataPath}`);
        }
    } catch (error) {
        console.error(`[AffectionManager] Error loading or creating affection data:`, error.message);
        data = {}; // 確保即使載入失敗，數據物件也存在
    }
}

/**
 * 儲存好感度資料到本地檔案。
 */
function saveData() {
    try {
        // 確保 data 變數是一個有效的物件
        if (typeof data !== 'object' || data === null) {
            console.error('[AffectionManager] Data is not a valid object, cannot save.');
            return;
        }
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[AffectionManager] Saved affection data to: ${dataPath} at ${new Date().toISOString()}`);
    } catch (error) {
        console.error(`[AffectionManager] Error saving affection data to ${dataPath}:`, error.message);
    }
}

/**
 * 取得今天的日期字串，格式為 YYYY-MM-DD。
 * @returns {string} 當前日期字串。
 */
function getTodayDateStr() {
    return new Date().toISOString().split('T')[0];
}

/**
 * 確保使用者資料結構存在，並在是新的一天時重置每日問候計數。
 * 此函式在內部會呼叫 saveData()。
 * @param {string} userId 使用者的 ID。
 */
function ensureUserData(userId) {
    const today = getTodayDateStr();
    let updated = false; // 追蹤是否有數據更新

    if (!data[userId]) {
        data[userId] = {
            affection: 0,
            lastGreetDate: today,
            greetCountToday: 0
        };
        updated = true;
    }

    // 如果日期不同，重置今日問候次數
    if (data[userId].lastGreetDate !== today) {
        data[userId].lastGreetDate = today;
        data[userId].greetCountToday = 0;
        updated = true;
    }

    // 確保 greetCountToday 是數字型別（以防舊數據結構問題）
    if (typeof data[userId].greetCountToday !== 'number') {
        data[userId].greetCountToday = 0;
        updated = true;
    }

    // 只有在數據有更新時才儲存
    if (updated) {
        saveData();
    }
}

/**
 * 檢查使用者今日是否已問候。
 * @param {string} userId 使用者的 ID。
 * @returns {boolean} 如果今日已問候則返回 true，否則返回 false。
 */
function hasGreetedToday(userId) {
    ensureUserData(userId); // 確保使用者資料存在並更新
    return data[userId].greetCountToday > 0;
}

/**
 * 取得使用者今日的問候次數。
 * @param {string} userId 使用者的 ID。
 * @returns {number} 使用者今日的問候次數。
 */
function getGreetCount(userId) {
    ensureUserData(userId); // 確保使用者資料存在並更新
    return data[userId].greetCountToday;
}

/**
 * 增加使用者好感度，通常限制為每日首次問候。
 * 執行後會儲存數據。
 * @param {string} userId 使用者的 ID。
 * @param {number} [amount=1] 增加好感度的數量。預設為 1。
 * @returns {number|false} 成功增加好感度後返回新的好感度值，如果今日已增加過則返回 false。
 */
function addAffection(userId, amount = 1) {
    ensureUserData(userId); // 確保使用者資料存在並更新
    const today = getTodayDateStr();
    const user = data[userId];

    // 如果今日已增加過好感度 (且 amount > 0)，則不再次增加
    if (amount > 0 && user.lastGreetDate === today && user.greetCountToday >= 1) {
        return false; // 今日已增加過
    }

    if (amount > 0) { // 只有當增加數量為正時才增加好感度
        user.affection += amount;
    }
    user.lastGreetDate = today; // 更新最後問候日期
    user.greetCountToday += 1; // 增加今日問候次數

    saveData(); // 保存數據

    return user.affection;
}

/**
 * 取得使用者目前的好感度值。
 * @param {string} userId 使用者的 ID。
 * @returns {number} 使用者當前的好感度值，如果不存在則為 0。
 */
function getAffection(userId) {
    ensureUserData(userId); // 確保使用者資料存在並更新
    // 使用 ?? 運算符提供預設值 0
    return data[userId].affection ?? 0;
}

/**
 * 根據好感度分數計算好感度等級。
 * 分數在 1 到 100 之間時，等級範圍從 1 到 10；超過 100 時為 11 級。
 * @param {number} affection 使用者的好感度分數。
 * @returns {number} 計算出的好感度等級 (1-11)。
 */
function getAffectionLevel(affection) {
    return affection > 100 ? 11 : Math.min(Math.ceil(affection / 10), 10);
}

/**
 * 從預載入的回應語句中，根據好感度等級隨機選取一句回應。
 * @param {number} level 好感度等級。
 * @returns {string} 隨機選取的回應語句，如果無法解析則返回預設錯誤訊息。
 */
function getRandomResponse(level) {
    const levelKey = level.toString();
    const responses = affectionResponses[levelKey]; // 從預載入的物件中獲取

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
        return '（無法解析的回應，仿佛來自未知維度）';
    }

    return responses[Math.floor(Math.random() * responses.length)];
}


// --- 模組匯出 ---
// 將所有核心功能匯出，供其他模組使用
module.exports = {
    loadData,          // 載入好感度數據
    saveData,          // 儲存好感度數據
    hasGreetedToday,   // 檢查今日是否已問候
    getGreetCount,     // 取得今日問候次數
    addAffection,      // 增加好感度
    getAffection,      // 取得使用者目前好感度值
    getAffectionLevel, // 根據好感度取得等級
    getRandomResponse  // 隨機選一句語句
};
