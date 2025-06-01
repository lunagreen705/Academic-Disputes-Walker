const fs = require('fs');
const path = require('path');

// 定義資料與回應的檔案路徑
const dataPath = path.join(__dirname, '../data/user_affection.json');
const responsePath = path.join(__dirname, '../data/affection/affectionResponses.json');

// 儲存用戶資料
let data = {};

// 載入資料
function loadData() {
    if (fs.existsSync(dataPath)) {
        const raw = fs.readFileSync(dataPath);
        data = JSON.parse(raw);
    } else {
        data = {};
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    }
}

// 儲存資料
function saveData() {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// 當天日期字串
function getTodayDateStr() {
    return new Date().toISOString().split('T')[0];
}

// 初始化或檢查用戶資料
function ensureUserData(userId) {
    const today = getTodayDateStr();

    if (!data[userId]) {
        data[userId] = {
            affection: 0,
            lastGreetDate: today,
            greetCountToday: 0
        };
    }

    // 每日重置問候次數
    if (data[userId].lastGreetDate !== today) {
        data[userId].lastGreetDate = today;
        data[userId].greetCountToday = 0;
    }

    if (typeof data[userId].greetCountToday !== 'number') {
        data[userId].greetCountToday = 0;
    }

    saveData();
}

// 是否已問候過
function hasGreetedToday(userId) {
    ensureUserData(userId);
    return data[userId].greetCountToday > 0;
}

// 取得今日問候次數
function getGreetCount(userId) {
    ensureUserData(userId);
    return data[userId].greetCountToday;
}

// 增加好感度（第一次當天問候才會加）
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

// 根據好感度取得等級
function getAffectionLevel(affection) {
    if (affection > 100) return 11;
    return Math.min(Math.ceil(affection / 10), 10);
}

// 抽一句語句
function getRandomResponse(level) {
    const responsesByLevel = require(responsePath);
    const levelKey = level.toString();

    const responses = responsesByLevel[levelKey];
    if (!responses || responses.length === 0) return '（無法解析的回應，仿佛來自未知維度）';

    return responses[Math.floor(Math.random() * responses.length)];
}

// 匯出模組
module.exports = {
    loadData,
    saveData,
    hasGreetedToday,
    getGreetCount,
    addAffection,
    getAffectionLevel,
    getRandomResponse
};