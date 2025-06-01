const fs = require('fs');
const path = require('path');

// 檔案路徑設定
const dataPath = path.join(__dirname, '../data/user_affection.json');
const responsePath = path.join(__dirname, '../data/affection/affectionResponses.json');

// 儲存使用者好感度資料
let data = {};

// 載入好感度資料
function loadData() {
    if (fs.existsSync(dataPath)) {
        const raw = fs.readFileSync(dataPath, 'utf8');
        data = JSON.parse(raw);
        console.log(`[AffectionManager] Loaded affection data from: ${dataPath}`);
    } else {
        console.warn(`[AffectionManager] Warning: ${dataPath} not found. Please create it manually.`);
    }
}

// 儲存好感度資料
function saveData() {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log(`[AffectionManager] Saved affection data to: ${dataPath} at ${new Date().toISOString()}`);
}

// 取得今天日期（字串）
function getTodayDateStr() {
    return new Date().toISOString().split('T')[0];
}

// 確保用戶資料存在
function ensureUserData(userId) {
    const today = getTodayDateStr();
    if (!data[userId]) {
        data[userId] = {
            affection: 0,
            lastGreetDate: today,
            greetCountToday: 0
        };
    }
    if (data[userId].lastGreetDate !== today) {
        data[userId].lastGreetDate = today;
        data[userId].greetCountToday = 0;
    }
    if (typeof data[userId].greetCountToday !== 'number') {
        data[userId].greetCountToday = 0;
    }
    saveData();
}

// 檢查今日是否已問候
function hasGreetedToday(userId) {
    ensureUserData(userId);
    return data[userId].greetCountToday > 0;
}

// 取得今日問候次數
function getGreetCount(userId) {
    ensureUserData(userId);
    return data[userId].greetCountToday;
}

// 增加好感度（僅限首次問候）
function addAffection(userId, amount = 1) {
    ensureUserData(userId);
    const today = getTodayDateStr();
    const user = data[userId];

    if (user.lastGreetDate === today && user.greetCountToday >= 1 && amount > 0) {
        return false; // 今日已增加過
    }

    if (amount > 0) {
        user.affection += amount;
    }
    user.lastGreetDate = today;
    user.greetCountToday += 1;
    saveData();

    return user.affection;
}

// 取得使用者目前好感度值
function getAffection(userId) {
    ensureUserData(userId);
    return data[userId].affection ?? 0;
}

// 根據好感度取得等級
function getAffectionLevel(affection) {
    return affection > 100 ? 11 : Math.min(Math.ceil(affection / 10), 10);
}

// 隨機選一句語句（來自 response JSON）
function getRandomResponse(level) {
    const responsesByLevel = require(responsePath);
    const levelKey = level.toString();
    const responses = responsesByLevel[levelKey];

    if (!responses || responses.length === 0) {
        return '（無法解析的回應，仿佛來自未知維度）';
    }

    return responses[Math.floor(Math.random() * responses.length)];
}

// 匯出模組函數
module.exports = {
    loadData,
    saveData,
    getAffection,
    hasGreetedToday,
    getGreetCount,
    addAffection,
    getAffectionLevel,
    getRandomResponse
};