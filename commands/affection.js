// commands/affection.js
const fs = require('fs');
const path = require('path');

// 定義好感度資料檔案的路徑
// __dirname 指向當前檔案 (affection.js) 的目錄
// '..' 向上一個目錄 (your-discord-bot/)
// 'data' 進入 data 目錄
const DATA_FILE = path.join(__dirname, '..', 'data', 'user_affection.json');

/**
 * 載入用戶好感度資料。
 * @returns {Object} 包含用戶ID和好感度的物件。
 */
function loadAffectionData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            // 如果檔案不存在，則返回空物件（因為指令是查詢，如果沒有檔案就是沒有資料）
            return {};
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading affection data for command:', error);
        return {};
    }
}

module.exports = {
    data: { // 定義指令的名稱
        name: '好感度', // 指令名稱，用戶將輸入 `!好感度`
        description: '查看你對機器人的好感度。',
    },
    async execute(message) { // 指令觸發時執行的函數
        const userId = message.author.id;
        const userAffection = loadAffectionData(); // 載入好感度資料

        // 取得用戶當前的好感度，如果沒有則為 0
        const currentAffection = userAffection[userId] || 0;

        // 回覆用戶其好感度
        await message.reply(`${message.author.username}，你目前的好感度是：${currentAffection} 點。`);
    },
};
