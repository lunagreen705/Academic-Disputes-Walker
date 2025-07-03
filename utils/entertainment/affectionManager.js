// affectionManager.js
const fs = require('fs');
const path = require('path');
const colors = require("../../UI/colors/colors");

// === GitHub 環境設定 ===
const GH_TOKEN    = process.env.GH_TOKEN;
const GH_USERNAME = process.env.GH_USERNAME;
const GH_REPO     = process.env.GH_REPO;

// === 路徑設定 ===
const DATA_FILE      = path.join(__dirname, '../../data/affection/user_affection.json');
const GH_FILE_PATH   = 'data/affection/user_affection.json';
const RESPONSE_FILE  = path.join(__dirname, '../../data/affection/affectionResponses.json');

// === 資料容器 ===
let userAffectionData   = {};
let affectionResponses  = {};


// === 載入回應語句 ===
try {
    const responseDir = path.dirname(RESPONSE_FILE);
    if (!fs.existsSync(responseDir)) fs.mkdirSync(responseDir, { recursive: true });

    if (fs.existsSync(RESPONSE_FILE)) {
        affectionResponses = JSON.parse(fs.readFileSync(RESPONSE_FILE, 'utf8'));
  console.log(`${colors.cyan}[ AFFECTION ]${colors.reset} ${colors.green}好感回應語句載入成功 ✅${colors.reset}`);
    } else {
        console.warn('[AFFECTION MANAGER] ⚠️ 未找到回應語句檔案，已初始化為空。');
    }
} catch (err) {
    console.error('[AFFECTION MANAGER] ❌ 載入回應語句失敗：', err.message);
}

// === 初始化好感度資料 ===
function initializeAffectionData() {
    const dataDir = path.dirname(DATA_FILE);
    try {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            userAffectionData = JSON.parse(raw);
        } else {
            userAffectionData = {};
            fs.writeFileSync(DATA_FILE, JSON.stringify(userAffectionData, null, 2), 'utf8');
        }

    console.log(`${colors.cyan}[ AFFECTION ]${colors.reset} ${colors.green}好感度資料初始化完成 ✅${colors.reset}`);
    } catch (err) {
        console.error('[AFFECTION MANAGER] ❌ 初始化好感度資料失敗：', err.message);
    }
}
initializeAffectionData();

// === 儲存並同步資料 ===
function saveData() {
    try {
        if (typeof userAffectionData !== 'object' || !userAffectionData) return;

        const json = JSON.stringify(userAffectionData, null, 2);
        fs.writeFileSync(DATA_FILE, json, 'utf8');
        console.log('[AFFECTION MANAGER] 💾 本地好感度資料已儲存。');

        pushToGitHub(json).catch(err =>
            console.error('[AFFECTION MANAGER] ❌ 推送 GitHub 時發生錯誤：', err.message)
        );
    } catch (err) {
        console.error('[AFFECTION MANAGER] ❌ 儲存好感度資料失敗：', err.message);
    }
}

// === 推送至 GitHub ===
async function pushToGitHub(content) {
    if (!GH_TOKEN || !GH_USERNAME || !GH_REPO) {
        console.warn('[AFFECTION MANAGER] ⚠️ GitHub 憑證資訊不完整，已跳過推送。');
        return;
    }

    const apiUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_FILE_PATH}`;
    let currentSha = null;
    let remoteContent = null;

    try {
        const res = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`,
                'User-Agent':    'Discord-Bot',
                'Accept':        'application/vnd.github.v3+json',
            },
        });

        if (res.ok) {
            const fileData = await res.json();
            currentSha     = fileData.sha;
            remoteContent  = Buffer.from(fileData.content, 'base64').toString('utf8');
        } else if (res.status !== 404) {
            throw new Error(await res.text());
        }
    } catch (err) {
        console.error('[AFFECTION MANAGER] ❌ 擷取 GitHub 資料失敗：', err.message);
        return;
    }

    let final = content;

    if (remoteContent) {
        try {
            const remoteData = JSON.parse(remoteContent);
            const localData  = JSON.parse(content);
            final = JSON.stringify({ ...remoteData, ...localData }, null, 2);
        } catch (err) {
            console.error('[AFFECTION MANAGER] ❌ 合併資料時發生錯誤：', err.message);
            return;
        }
    }

    try {
        const body = JSON.stringify({
            message: `Update user_affection.json at ${new Date().toISOString()}`,
            content: Buffer.from(final).toString('base64'),
            sha:     currentSha,
        });

        const res = await fetch(apiUrl, {
            method:  'PUT',
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`,
                'User-Agent':    'Discord-Bot',
                'Content-Type':  'application/json',
            },
            body,
        });

        if (!res.ok) throw new Error(await res.text());

        console.log('[AFFECTION MANAGER] 🚀 好感度資料已成功同步至 GitHub。');
    } catch (err) {
        console.error('[AFFECTION MANAGER] ❌ 推送至 GitHub 失敗：', err.message);
    }
}

// === 工具函式 ===
function getTodayDateStr() {
    const now   = new Date();
    const utc   = now.getTime() + now.getTimezoneOffset() * 60000;
    const local = new Date(utc + 8 * 60 * 60000); // UTC+8

    return `${local.getFullYear()}-${(local.getMonth() + 1).toString().padStart(2, '0')}-${local.getDate().toString().padStart(2, '0')}`;
}

function ensureUserData(userId) {
    const today = getTodayDateStr();
    let changed = false;

    if (!userAffectionData[userId]) {
        userAffectionData[userId] = {
            affection:       0,
            lastGreetDate:   today,
            greetCountToday: 0,
        };
        changed = true;
    }

    if (userAffectionData[userId].lastGreetDate !== today) {
        userAffectionData[userId].lastGreetDate   = today;
        userAffectionData[userId].greetCountToday = 0;
        changed = true;
    }

    if (typeof userAffectionData[userId].greetCountToday !== 'number') {
        userAffectionData[userId].greetCountToday = 0;
        changed = true;
    }

    return changed;
}

// === 好感度操作 ===
function hasGreetedToday(userId) {
    ensureUserData(userId);
    return userAffectionData[userId].greetCountToday > 0;
}

function getGreetCount(userId) {
    ensureUserData(userId);
    return userAffectionData[userId].greetCountToday;
}

function addAffection(userId, amount = 1) {
    const today = getTodayDateStr();
    const changed = ensureUserData(userId);
    const user = userAffectionData[userId];
    let changedDuringAdd = false;
    let secret = null;

    if (amount > 0 && user.lastGreetDate === today && user.greetCountToday >= 1) {
        return false;
    }

    if (amount > 0) {
        user.affection += amount;
        changedDuringAdd = true;
    }

    if (user.lastGreetDate !== today || user.greetCountToday === 0) {
        user.lastGreetDate = today;
        user.greetCountToday += 1;
        changedDuringAdd = true;
    } else if (amount === 0) {
        user.greetCountToday += 1;
        changedDuringAdd = true;
    }

    if (user.affection > 0 && user.affection % 5 === 0) {
        secret = getRandomResponse(0, true);
    }

    if (changed || changedDuringAdd) saveData();

    return {
        newAffection:         user.affection,
        optionalSecretReveal: secret,
    };
}

function getAffection(userId) {
    ensureUserData(userId);
    return userAffectionData[userId].affection ?? 0;
}

function getAffectionLevel(affection) {
    return affection > 100 ? 11 : Math.min(Math.ceil(affection / 10), 10);
}

function getRandomResponse(level, isSecretReveal = false) {
    let responses;

    if (isSecretReveal) {
        responses = affectionResponses['secret_reveals'];
    } else {
        responses = affectionResponses[level.toString()];
    }

    if (!Array.isArray(responses) || responses.length === 0) {
        return isSecretReveal
            ? '（一陣低語在你耳邊迴響，但你無法聽清它的內容...）'
            : '（無法解析的回應，仿佛來自未知維度）';
    }

    return responses[Math.floor(Math.random() * responses.length)];
}

// === 匯出模組 ===
module.exports = {
    saveData,
    hasGreetedToday,
    getGreetCount,
    addAffection,
    getAffection,
    getAffectionLevel,
    getRandomResponse,
};
