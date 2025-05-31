// events/messageCreate.js
const fs = require('fs');
const path = require('path');

// 定義好感度資料檔案的路徑
const DATA_FILE = path.join(__dirname, '..', 'data', 'user_affection.json');

/**
 * 載入用戶好感度資料。
 * 如果檔案不存在，則會創建一個空的 JSON 檔案。
 * @returns {Object} 包含用戶ID和好感度的物件。
 */
function loadAffectionData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, '{}', 'utf8');
            return {};
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading affection data:', error);
        return {};
    }
}

/**
 * 儲存用戶好感度資料到檔案。
 * @param {Object} data - 包含用戶ID和好感度的物件。
 */
function saveAffectionData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving affection data:', error);
    }
}

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return; // 忽略機器人自己的訊息

        const userId = message.author.id;
        let userAffection = loadAffectionData();

        // **修改這裡的條件判斷**
        // 檢查訊息內容是否包含「早上好基地」（不區分大小寫）
        if (message.content.toLowerCase().includes('早上好基地')) {
            // 如果是新用戶，初始化好感度為 0
            if (!userAffection[userId]) {
                userAffection[userId] = 0;
            }
            userAffection[userId] += 1; // 好感度增加 1 點
            saveAffectionData(userAffection); // 儲存更新後的好感度

            let replyMessage = '';
            // 根據好感度給出不同的回覆
            if (userAffection[userId] < 5) {
                replyMessage = `早上好基地！${message.author.username}，歡迎來到這個充滿活力的一天！`;
            } else if (userAffection[userId] < 15) {
                replyMessage = `☀️ 喔喔，又是個美好的一天！早上好基地，${message.author.username}！好感度：${userAffection[userId]} ✨`;
            } else {
                replyMessage = `💖 親愛的 ${message.author.username}，早上好基地！看到你真是太開心了！今天的你一樣光芒四射呢！✨ 好感度：${userAffection[userId]}！`;
            }
            await message.reply(replyMessage); // 回覆用戶
        }

        // `!好感度` 指令的處理邏輯仍然由 `commands/affection.js` 和 `index.js` 中的指令處理部分負責。
    },
};
