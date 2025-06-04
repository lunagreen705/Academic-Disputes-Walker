const fs = require('fs');
const path = require('path');

// --- GitHub 相關設定 (請確保這些環境變數在 Render 上已配置) ---
const GH_TOKEN = process.env.GH_TOKEN;
const GH_USERNAME = process.env.GH_USERNAME;
const GH_REPO = process.env.GH_REPO;

// --- 檔案路徑定義 ---
const DATA_FILE = path.join(__dirname, '../data/affection/user_affection.json');
const GH_FILE_PATH = 'data/affection/user_affection.json'; // 這裡也要同步修改為新的 GitHub 路徑

// 回應語句資料路徑
const RESPONSE_FILE = path.join(__dirname, '../data/affection/affectionResponses.json');


// --- 數據容器與載入 ---
let userAffectionData = {}; // 載入好感度數據的容器
let affectionResponses = {}; // 載入回應語句數據的容器


// 在模組載入時，立即嘗試載入回應語句和好感度數據
try {
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
function initializeAffectionData() {
    const dataDir = path.dirname(DATA_FILE);
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`[AffectionManager] Created data directory: ${dataDir}`);
        }

        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            userAffectionData = JSON.parse(raw);
            console.log(`[AffectionManager] Loaded affection data from: ${DATA_FILE}`);
        } else {
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
        if (typeof userAffectionData !== 'object' || userAffectionData === null) {
            console.error('[AffectionManager] Data is not a valid object, cannot save.');
            return;
        }
        const jsonContent = JSON.stringify(userAffectionData, null, 2);

        fs.writeFileSync(DATA_FILE, jsonContent, 'utf8');
        console.log(`[AffectionManager] Saved affection data to: ${DATA_FILE} at ${new Date().toISOString()}`);

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
    if (!GH_TOKEN || !GH_USERNAME || !GH_REPO) {
        console.warn('[AffectionManager] GitHub credentials (GH_TOKEN, GH_USERNAME, GH_REPO) are missing. Skipping push.');
        return;
    }

    const apiUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_FILE_PATH}`;
    let currentSha = null; // 用於更新檔案的 SHA 值
    let remoteContent = null; // 用於儲存遠端檔案內容

    try {
        const getFileResponse = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`,
                'User-Agent': 'Discord-Bot',
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (getFileResponse.ok) {
            const fileData = await getFileResponse.json();
            currentSha = fileData.sha;
            remoteContent = Buffer.from(fileData.content, 'base64').toString('utf8');
            console.log(`[AffectionManager] Successfully retrieved current file SHA and content from GitHub. SHA: ${currentSha}`);
        } else if (getFileResponse.status === 404) {
            console.log(`[AffectionManager] File ${GH_FILE_PATH} not found on GitHub. Will create a new file.`);
            currentSha = null;
        } else {
            const errorText = await getFileResponse.text();
            throw new Error(`GitHub get file failed: ${getFileResponse.status} - ${errorText}`);
        }
    } catch (err) {
        console.error('[AffectionManager] Error retrieving file from GitHub:', err.message);
        return;
    }

    let finalContentToPush = content;

    if (remoteContent) {
        try {
            const localData = JSON.parse(content);
            const remoteData = JSON.parse(remoteContent);

            const mergedData = { ...remoteData, ...localData };

            finalContentToPush = JSON.stringify(mergedData, null, 2);
            console.log('[AffectionManager] Merged local changes with remote GitHub data.');

        } catch (mergeError) {
            console.error('[AffectionManager] Error merging affection data:', mergeError.message);
            return;
        }
    }

    const body = JSON.stringify({
        message: `Update user_affection.json at ${new Date().toISOString()}`,
        content: Buffer.from(finalContentToPush).toString('base64'),
        sha: currentSha
    });

    try {
        const res = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`,
                'User-Agent': 'Discord-Bot',
                'Content-Type': 'application/json'
            },
            body
        });

        if (!res.ok) {
            const errorText = await res.text();
            if (res.status === 409) {
                console.error('[AffectionManager] GitHub push conflicted AGAIN after merge attempt. This might indicate rapid concurrent updates or a flawed merge strategy.');
            }
            throw new Error(`GitHub push failed: ${res.status} - ${errorText}`);
        }

        console.log(`[AffectionManager] Synced affection data to GitHub.`);
    } catch (err) {
        console.error('[AffectionManager] GitHub push error:', err.message);
    }
}

/**
 * 取得今天的日期字串，格式為YYYY-MM-DD (台灣時間)。
 * @returns {string} 當前日期字串。
 */
function getTodayDateStr() {
    const now = new Date();
    // 考慮台灣時區，UTC+8
    const taiwanOffset = 8 * 60; // 8 hours in minutes
    const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const taiwanTime = new Date(utc + (taiwanOffset * 60 * 1000));

    const year = taiwanTime.getFullYear();
    const month = (taiwanTime.getMonth() + 1).toString().padStart(2, '0');
    const day = taiwanTime.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * 確保使用者資料結構存在，並在是新的一天時重置每日問候計數。
 * 此函式現在只負責數據結構的確保和重置，不再觸發 saveData()。
 * @param {string} userId 使用者的 ID。
 * @returns {boolean} 如果有任何數據被初始化或重置（需要保存）則返回 true，否則返回 false。
 */
function ensureUserData(userId) {
    const today = getTodayDateStr();
    let changed = false;

    if (!userAffectionData[userId]) {
        userAffectionData[userId] = {
            affection: 0,
            lastGreetDate: today,
            greetCountToday: 0
        };
        changed = true;
    }

    if (userAffectionData[userId].lastGreetDate !== today) {
        userAffectionData[userId].lastGreetDate = today;
        userAffectionData[userId].greetCountToday = 0;
        changed = true;
    }

    if (typeof userAffectionData[userId].greetCountToday !== 'number') {
        userAffectionData[userId].greetCountToday = 0;
        changed = true;
    }
    
    return changed;
}

/**
 * 檢查使用者今日是否已問候。
 * @param {string} userId 使用者的 ID。
 * @returns {boolean} 如果今日已問候則返回 true，否則返回 false。
 */
function hasGreetedToday(userId) {
    ensureUserData(userId); 
    return userAffectionData[userId].greetCountToday > 0;
}

/**
 * 取得使用者今日的問候次數。
 * @param {string} userId 使用者的 ID。
 * @returns {number} 使用者今日的問候次數。
 */
function getGreetCount(userId) {
    ensureUserData(userId);
    return userAffectionData[userId].greetCountToday;
}

/**
 * 增加使用者好感度，通常限制為每日首次問候。
 * 執行後會儲存數據。
 * @param {string} userId 使用者的 ID。
 * @param {number} [amount=1] 增加好感度的數量。預設為 1。
 * @returns {object|false} 成功增加好感度後返回包含 newAffection 和 optionalSecretReveal 的物件，
 * 如果今日已增加過則返回 false。
 */
function addAffection(userId, amount = 1) {
    const ensureChanged = ensureUserData(userId); 
    const today = getTodayDateStr();
    const user = userAffectionData[userId];
    let dataChangedInAddAffection = false;
    let optionalSecretReveal = null; // 用於儲存秘密透露語句

    // 如果今日已增加過好感度 (且 amount > 0)，則不再次增加
    if (amount > 0 && user.lastGreetDate === today && user.greetCountToday >= 1) {
        return false;
    }

    if (amount > 0) {
        user.affection += amount;
        dataChangedInAddAffection = true;
    }
    
    if (user.lastGreetDate !== today || user.greetCountToday === 0) {
        user.lastGreetDate = today;
        user.greetCountToday += 1;
        dataChangedInAddAffection = true;
    } else if (user.greetCountToday > 0 && amount === 0) {
        user.greetCountToday += 1;
        dataChangedInAddAffection = true;
    }

    // --- 修改點1：檢查是否觸發秘密透露 ---
    // 檢查好感度是否為 5 的倍數，並且好感度大於 0
    if (user.affection > 0 && user.affection % 5 === 0) {
        optionalSecretReveal = getRandomResponse(0, true); // 呼叫 getRandomResponse 請求秘密透露
    }
    // --- 修改點1 結束 ---

    if (ensureChanged || dataChangedInAddAffection) {
        saveData();
    }

    // --- 修改點2：返回包含秘密透露的物件 ---
    return {
        newAffection: user.affection,
        optionalSecretReveal: optionalSecretReveal
    };
    // --- 修改點2 結束 ---
}

/**
 * 取得使用者目前的好感度值。
 * @param {string} userId 使用者的 ID。
 * @returns {number} 使用者當前的好感度值，如果不存在則為 0。
 */
function getAffection(userId) {
    ensureUserData(userId); 
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
 * --- 修改點3：新增 isSecretReveal 參數 ---
 * @param {number} level 好感度等級 (對於秘密透露語句，此參數可以忽略或傳遞任何值)。
 * @param {boolean} [isSecretReveal=false] 是否請求秘密透露語句。
 * @returns {string} 隨機選取的回應語句，如果無法解析則返回預設錯誤訊息。
 */
function getRandomResponse(level, isSecretReveal = false) {
    let responses;
    if (isSecretReveal) {
        // --- 修改點4：從 secret_reveals 獲取語句 ---
        responses = affectionResponses['secret_reveals'];
        // --- 修改點4 結束 ---
    } else {
        const levelKey = level.toString();
        responses = affectionResponses[levelKey];
    }

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
        // 如果是請求秘密透露但沒有定義，返回一個通用訊息
        if (isSecretReveal) {
             return '（一陣低語在你耳邊迴響，但你無法聽清它的內容...）';
        }
        return '（無法解析的回應，仿佛來自未知維度）';
    }

    return responses[Math.floor(Math.random() * responses.length)];
}
// --- 修改點3 結束 ---


// --- 模組匯出 ---
module.exports = {
    saveData,
    hasGreetedToday,
    getGreetCount,
    addAffection,
    getAffection,
    getAffectionLevel,
    getRandomResponse
};
