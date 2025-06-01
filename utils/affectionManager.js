const fs = require('fs');
const path = require('path');

// 資料與回應的檔案路徑
const dataDir = path.join(__dirname, '../data');
const dataPath = path.join(dataDir, 'user_affection.json');
const responsePath = path.join(dataDir, 'affection', 'affectionResponses.json');

// 初始化資料容器
let data = {};

// 確保資料夾存在
function ensureDataFolder() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`[AffectionManager] Created data folder: ${dataDir}`);
    }
}

// 載入或初始化資料
function loadData() {
    ensureDataFolder();

    if (fs.existsSync(dataPath)) {
        const raw = fs.readFileSync(dataPath);
        data = JSON.parse(raw);
        console.log(`[AffectionManager] Loaded affection data from: ${dataPath}`);
    } else {
        data = {};
        saveData();
        console.log(`[AffectionManager] Created new affection file at: ${dataPath}`);
    }
}

// 儲存資料
function saveData() {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log(`[AffectionManager] Saved affection data to: ${dataPath} at ${new Date().toISOString()}`);
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

// 增加好感度（僅第一次問候會加）
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

// 🔹 新增這個：用來讀取目前好感度
function getAffection(userId) {
    ensureUserData(userId);
    return data[userId].affection;
}

// 好感度等級（若你未使用可刪）
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
    getAffection,
    getAffectionLevel,
    getRandomResponse
};