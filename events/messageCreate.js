// events/messageCreate.js
const fs = require('fs');
const path = require('path');

// 定義好感度資料檔案的路徑
// __dirname 指向當前檔案 (messageCreate.js) 的目錄
// '..' 向上一個目錄 (your-discord-bot/)
// 'data' 進入 data 目錄
const DATA_FILE = path.join(__dirname, '..', 'data', 'user_affection.json');

/**
 * 載入用戶好感度資料。
 * 如果檔案不存在，則會創建一個空的 JSON 檔案。
 * @returns {Object} 包含用戶ID和好感度的物件。
 */
function loadAffectionData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            // 如果檔案不存在，創建一個空的 JSON 物件並寫入
            fs.writeFileSync(DATA_FILE, '{}', 'utf8');
            return {};
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading affection data:', error);
        return {}; // 載入失敗時返回空物件，避免程式崩潰
    }
}

/**
 * 儲存用戶好感度資料到檔案。
 * @param {Object} data - 包含用戶ID和好感度的物件。
 */
function saveAffectionData(data) {
    try {
        // null, 2 讓 JSON 格式化更易讀
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving affection data:', error);
    }
}

module.exports = {
    name: 'messageCreate', // 事件名稱，Discord.js 會監聽這個事件
    async execute(message) { // 事件觸發時執行的函數
        // 忽略機器人自己的訊息，避免無限循環
        if (message.author.bot) return;

        const userId = message.author.id;
        let userAffection = loadAffectionData(); // 每次處理訊息都重新載入，確保是最新的資料

        // 檢查訊息內容是否包含「早安」
        if (message.content.toLowerCase().includes('早安')) {
            // 如果是新用戶，初始化好感度為 0
            if (!userAffection[userId]) {
                userAffection[userId] = 0;
            }
            userAffection[userId] += 1; // 好感度增加 1 點
            saveAffectionData(userAffection); // 儲存更新後的好感度

            let replyMessage = '';
            // 根據好感度給出不同的回覆
            if (userAffection[userId] < 5) {
                replyMessage = `早安！${message.author.username}，今天過得好嗎？`;
            } else if (userAffection[userId] < 15) {
                replyMessage = `☀️ 喔喔，又是個美好的一天！早安，${message.author.username}！好感度：${userAffection[userId]} ✨`;
            } else {
                replyMessage = `💖 親愛的 ${message.author.username}，早安！和你說早安真是太開心了！今天的你一樣光芒四射呢！✨ 好感度：${userAffection[userId]}！`;
            }
            await message.reply(replyMessage); // 回覆用戶
        }

        // 注意：`!好感度` 指令的處理邏輯現在應該在 `commands/affection.js` 中處理。
        // 所以這裡不需要再檢查 `!好感度` 的訊息。
    },
};
