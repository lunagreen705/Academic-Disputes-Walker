const fs = require('fs');
const path = require('path');

// 好感度資料路徑
const dataPath = path.join(__dirname, '../data/user_affection.json');
// 回應語句資料路徑
const responsePath = path.join(__dirname, '../data/affection/affectionResponses.json');

// 載入資料容器
let data = {};

// 載入好感度資料（不自動建立）
function loadData() {
    if (fs.existsSync(dataPath)) {
        const raw = fs.readFileSync(dataPath);
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

// 當天日期
function getTodayDateStr() {
    return new Date().toISOString().split('T')[0];
}

// 初始化使用者資料（若不存在）
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

// 是否今日已問候
function hasGreetedToday(userId) {
    ensureUserData(userId);
    return data[userId].greetCountToday > 0;
}

// 取得今日問候次數
function getGreetCount(userId) {
    ensureUserData(userId);
    return data[userId].greetCountToday;
}

// 增加好感度（限首次問候）
function addAffection(userId, amount = 1) {
    ensureUserData(userId);
    const today = getTodayDateStr();
    const user = data[userId];
    if (user.lastGreetDate === today && user.greetCountToday >= 1 && amount > 0) {
        return false;
    }
    if (amount > 0) {
        user.affection += amount;
    }
    user.lastGreetDate = today;
    user.greetCountToday += 1;
    saveData();
    return user.affection;
}

// 取得好感度等級（1~10，超過100為11）
function getAffectionLevel(affection) {
    return affection > 100 ? 11 : Math.min(Math.ceil(affection / 10), 10);
}

// 隨機一句語句
function getRandomResponse(level) {
    const responsesByLevel = require(responsePath);
    const levelKey = level.toString();
    const responses = responsesByLevel[levelKey];
    if (!responses || responses.length === 0) return '（無法解析的回應，仿佛來自未知維度）';
    return responses[Math.floor(Math.random() * responses.length)];
}

// 匯出功能
module.exports = {
    loadData,
    saveData,
    hasGreetedToday,
    getGreetCount,
    addAffection,
    getAffectionLevel,
    getRandomResponse
};