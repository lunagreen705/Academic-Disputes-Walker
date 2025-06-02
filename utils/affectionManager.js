const fs = require('fs/promises');
const path = require('path');
// const https = require('https'); // 'https' 模組未直接使用於 fetch 呼叫，如果沒有其他地方需要可移除

const GH_TOKEN = process.env.GH_TOKEN;
const GH_USERNAME = process.env.GH_USERNAME;
const GH_REPO = process.env.GH_REPO;

// 定義本地數據檔案路徑
const DATA_FILE = path.join(__dirname, 'data', 'user_affection.json');
// 定義 GitHub 儲存庫中的檔案路徑
const GH_FILE_PATH = 'data/user_affection.json';

let userAffectionData = {};
let isDataLoaded = false;

/**
 * 從本地檔案載入使用者好感度數據。
 * 如果檔案不存在，則初始化一個空數據物件並建立該檔案。
 */
async function loadData() {
    try {
        await fs.access(DATA_FILE); // 檢查檔案是否存在
        const data = await fs.readFile(DATA_FILE, 'utf8'); // 讀取檔案內容
        userAffectionData = JSON.parse(data); // 解析 JSON 數據
        console.log(`[AffectionManager] Loaded affection data from: ${DATA_FILE}`);
        isDataLoaded = true;
    } catch (error) {
        if (error.code === 'ENOENT') { // 如果檔案不存在
            userAffectionData = {}; // 初始化為空物件
            await fs.writeFile(DATA_FILE, '{}', 'utf8'); // 建立一個空的 JSON 檔案
            console.log(`[AffectionManager] Created new affection data file: ${DATA_FILE}`);
            isDataLoaded = true;
        } else {
            console.error(`[AffectionManager] Error loading affection data:`, error);
        }
    }
}

/**
 * 將當前使用者好感度數據保存到本地檔案，
 * 然後將更新後的內容推送到 GitHub 儲存庫。
 */
async function saveData() {
    try {
        const jsonContent = JSON.stringify(userAffectionData, null, 2); // 將數據格式化為 JSON 字串
        await fs.writeFile(DATA_FILE, jsonContent, 'utf8'); // 寫入本地檔案
        console.log(`[AffectionManager] Saved affection data to: ${DATA_FILE} at ${new Date().toISOString()}`);

        await pushToGitHub(jsonContent); // 自動推送到 GitHub
    } catch (error) {
        console.error(`[AffectionManager] Error saving affection data locally:`, error);
    }
}

/**
 * 將提供的內容推送到 GitHub 儲存庫中指定的檔案。
 * 它會嘗試先獲取檔案的 SHA 以進行更新。
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
        // 如果獲取 SHA 失敗，可以選擇中止推送或繼續嘗試創建/更新
        // 目前的實現會繼續嘗試 PUT，如果 SHA 為 null，GitHub 可能會建立新檔案
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
 * 返回當天的日期字串，格式為 YYYY-MM-DD。
 * @returns {string} 當前日期字串。
 */
function getTodayDateStr() {
    return new Date().toISOString().split('T')[0];
}

/**
 * 確保使用者的數據結構在 userAffectionData 中存在，
 * 並在是新的一天時重置每日問候計數。
 * @param {string} userId 使用者的 ID。
 */
function ensureUserData(userId) {
    const today = getTodayDateStr();
    if (!userAffectionData[userId]) {
        userAffectionData[userId] = {
            affection: 0,
            lastGreetDate: today,
            greetCountToday: 0
        };
    }
    // 如果是新的一天，重置今日問候次數
    if (userAffectionData[userId].lastGreetDate !== today) {
        userAffectionData[userId].lastGreetDate = today;
        userAffectionData[userId].greetCountToday = 0;
    }
    // 確保 greetCountToday 是數字型別（以防舊數據結構問題）
    if (typeof userAffectionData[userId].greetCountToday !== 'number') {
        userAffectionData[userId].greetCountToday = 0;
    }
}

/**
 * 查詢指定使用者當前的好感度分數。
 * 如果使用者數據不存在，會先進行初始化。
 * @param {string} userId 使用者的 ID。
 * @returns {number} 使用者當前的好感度分數。
 */
function getAffection(userId) {
    ensureUserData(userId);
    return userAffectionData[userId].affection || 0;
}

/**
 * 增加使用者好感度，通常用於每日首次問候。
 * 更新後會保存數據並推送到 GitHub。
 * @param {string} userId 使用者的 ID。
 * @param {number} [amount=1] 增加好感度的數量。預設為 1。
 * @returns {Promise<number|false>} 成功時返回新的好感度分數，如果好感度未增加（例如今日已問候），則返回 false。
 */
async function addAffection(userId, amount = 1) {
    ensureUserData(userId);
    const today = getTodayDateStr();
    const user = userAffectionData[userId];

    // 如果 amount 大於 0 且今日已問候過，則不增加好感度
    if (amount > 0 && user.lastGreetDate === today && user.greetCountToday >= 1) {
        return false;
    }

    if (amount > 0) { // 只有當增加數量為正時才增加好感度
        user.affection += amount;
    }

    user.lastGreetDate = today; // 更新最後問候日期
    user.greetCountToday += 1; // 增加今日問候次數

    await saveData(); // 保存數據並推送到 GitHub
    return user.affection;
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

// 匯出模組功能
module.exports = {
    loadData,
    saveData,
    getAffection,
    addAffection,
    getAffectionLevel
};
