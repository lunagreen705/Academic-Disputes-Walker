const fs = require('fs'); // 使用同步檔案系統模組
const path = require('path');

// --- GitHub 相關設定 (請確保這些環境變數在 Render 上已配置) ---
const GH_TOKEN = process.env.GH_TOKEN;
const GH_USERNAME = process.env.GH_USERNAME;
const GH_REPO = process.env.GH_REPO;

// --- 檔案路徑定義 ---
// 好感度資料路徑：建議將數據存儲在應用程式目錄下的 data 資料夾。
// 如果在 Render 部署時遇到 ENOENT 錯誤，可能需要調整此路徑到 /tmp 或 Render Persistent Disks。
const DATA_FILE = path.join(__dirname, '../data/user_affection.json');
// GitHub 儲存庫中的檔案路徑 (這是 GitHub API 要求的路徑，與本地路徑結構無關)
const GH_FILE_PATH = 'data/user_affection.json';

// 回應語句資料路徑
const RESPONSE_FILE = path.join(__dirname, '../data/affection/affectionResponses.json');


// --- 數據容器與載入 ---
let userAffectionData = {}; // 載入好感度數據的容器
let affectionResponses = {}; // 載入回應語句數據的容器


// 在模組載入時，立即嘗試載入回應語句和好感度數據
// 這樣確保其他函式可以使用這些數據
try {
    // 載入回應語句
    const responseDir = path.dirname(RESPONSE_FILE);
    if (!fs.existsSync(responseDir)) {
        console.warn(`[AffectionManager] Warning: Response directory "${responseDir}" not found. Creating it.`);
        fs.mkdirSync(responseDir, { recursive: true });
    }
    if (fs.existsSync(RESPONSE_FILE)) {
        affectionResponses = JSON.parse(fs.readFileSync(RESPONSE_FILE, 'utf8'));
        console.log(`[AffectionManager] Loaded response data from: ${RESPONSE_FILE}`);
    } else {
        console.warn(`[AffectionManager] Warning: Response file "${RESPONSE_FILE}" not found. Initializing empty responses.`);
        affectionResponses = {}; // 如果檔案不存在，初始化為空
    }
} catch (error) {
    console.error(`[AffectionManager] Error loading affection responses from ${RESPONSE_FILE}:`, error.message);
    affectionResponses = {}; // 確保即使載入失敗，物件也存在
}


// 初始載入好感度數據 (同步)
// 確保在模組被 require 時數據就已經準備好
function initializeAffectionData() {
    const dataDir = path.dirname(DATA_FILE);
    try {
        // 確保資料目錄存在，如果不存在則創建
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`[AffectionManager] Created data directory: ${dataDir}`);
        }

        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            userAffectionData = JSON.parse(raw);
            console.log(`[AffectionManager] Loaded affection data from: ${DATA_FILE}`);
        } else {
            // 如果檔案不存在，建立一個空的 JSON 檔案
            userAffectionData = {};
            fs.writeFileSync(DATA_FILE, JSON.stringify(userAffectionData, null, 2), 'utf8');
            console.log(`[AffectionManager] Created new empty affection data file: ${DATA_FILE}`);
        }
    } catch (error) {
        console.error(`[AffectionManager] Error loading or creating affection data:`, error.message);
        userAffectionData = {}; // 確保即使載入失敗，數據物件也存在
    }
}
// 在模組載入時立即執行一次初始化
initializeAffectionData();


// --- 核心功能函式 ---

/**
 * 儲存好感度資料到本地檔案，並異步推送到 GitHub。
 * 這是你的主要保存機制，會觸發本地寫入和遠端同步。
 */
function saveData() {
    try {
        // 確保 userAffectionData 是一個有效的物件
        if (typeof userAffectionData !== 'object' || userAffectionData === null) {
            console.error('[AffectionManager] Data is not a valid object, cannot save.');
            return;
        }
        const jsonContent = JSON.stringify(userAffectionData, null, 2);

        // 同步寫入本地檔案
        fs.writeFileSync(DATA_FILE, jsonContent, 'utf8');
        console.log(`[AffectionManager] Saved affection data to: ${DATA_FILE} at ${new Date().toISOString()}`);

        // 異步推送到 GitHub，不阻塞當前流程
        // 使用 .then().catch() 來處理非阻塞的 Promise
        pushToGitHub(jsonContent).catch(err => {
            console.error('[AffectionManager] Asynchronous GitHub push failed:', err.message);
        });

    } catch (error) {
        console.error(`[AffectionManager] Error saving affection data locally:`, error.message);
    }
}

/**
 * 將提供的內容推送到 GitHub 儲存庫中指定的檔案。
 * 此函式本身是異步的，但其呼叫可以是非阻塞的。
 * @param {string} content 要推送的字串內容（例如 JSON 字串）。
 */
async function pushToGitHub(content) {
    // 檢查 GitHub 憑證是否完整
    if (!GH_TOKEN || !GH_USERNAME || !GH_REPO) {
        console.warn('[AffectionManager] GitHub credentials (GH_TOKEN, GH_USERNAME, GH_REPO) are missing. Skipping push.');
        return;
    }

    const apiUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_FILE_PATH}`;
    let sha = null; // 用於更新檔案的 SHA 值

    try {
        // 嘗試獲取當前檔案的 SHA 以便更新
        const getShaResponse = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`,
                'User-Agent': 'Discord-Bot' // GitHub API 要求提供 User-Agent
            }
        });

        if (getShaResponse.ok) {
            const getShaJson = await getShaResponse.json();
            sha = getShaJson.sha; // 取得檔案的 SHA
        } else if (getShaResponse.status !== 404) { // 如果不是 404（檔案未找到）而是其他錯誤
            const errorText = await getShaResponse.text();
            throw new Error(`GitHub get SHA failed: ${getShaResponse.status} - ${errorText}`);
        }
        // 如果是 404，sha 保持為 null，後續的 PUT 請求可能會嘗試建立檔案
    } catch (err) {
        console.error('[AffectionManager] Error retrieving file SHA from GitHub:', err.message);
        // 如果獲取 SHA 失敗，目前會繼續嘗試 PUT，如果 SHA 為 null，GitHub 可能會建立新檔案
    }

    // 準備 PUT 請求的內容（更新或建立檔案）
    const body = JSON.stringify({
        message: `Update user_affection.json at ${new Date().toISOString()}`, // 提交訊息
        content: Buffer.from(content).toString('base64'), // 檔案內容需要 Base64 編碼
        sha // 包含 SHA，如果已獲取到，否則為 null（用於初始建立）
    });

    try {
        const res = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`,
                'User-Agent': 'Discord-Bot',
                'Content-Type': 'application/json' // 告知伺服器發送的是 JSON
            },
            body
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`GitHub push failed: ${res.status} - ${errorText}`);
        }

        console.log(`[AffectionManager] Synced affection data to GitHub.`);
    } catch (err) {
        console.error('[AffectionManager] GitHub push error:', err.message);
    }
}

/**
 * 取得今天的日期字串，格式為YYYY-MM-DD。
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

    if (!userAffectionData[userId]) {
        userAffectionData[userId] = {
            affection: 0,
            lastGreetDate: today,
            greetCountToday: 0
        };
        updated = true;
    }

    // 如果日期不同，重置今日問候次數
    if (userAffectionData[userId].lastGreetDate !== today) {
        userAffectionData[userId].lastGreetDate = today;
        userAffectionData[userId].greetCountToday = 0;
        updated = true;
    }

    // 確保 greetCountToday 是數字型別（以防舊數據結構問題）
    if (typeof userAffectionData[userId].greetCountToday !== 'number') {
        userAffectionData[userId].greetCountToday = 0;
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
    return userAffectionData[userId].greetCountToday > 0;
}

/**
 * 取得使用者今日的問候次數。
 * @param {string} userId 使用者的 ID。
 * @returns {number} 使用者今日的問候次數。
 */
function getGreetCount(userId) {
    ensureUserData(userId); // 確保使用者資料存在並更新
    return userAffectionData[userId].greetCountToday;
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
    const user = userAffectionData[userId];

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
    return userAffectionData[userId].affection ?? 0;
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
    // loadData, // 初始化已在模組載入時完成，外部無需再次呼叫
    saveData,          // 儲存好感度數據 (並觸發 GitHub 同步)
    hasGreetedToday,   // 檢查今日是否已問候
    getGreetCount,     // 取得今日問候次數
    addAffection,      // 增加好感度
    getAffection,      // 取得使用者目前好感度值
    getAffectionLevel, // 根據好感度取得等級
    getRandomResponse  // 隨機選一句語句
};
