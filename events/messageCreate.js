// your-discord-bot/events/messageCreate.js
const affectionManager = require('../utils/affectionManager'); // 引入好感度管理模組

module.exports = {
    name: 'messageCreate', // Discord.js 事件名稱
    async execute(message) { // 事件處理函數，接收 message 物件
        if (message.author.bot) return; // 忽略機器人自己的訊息，避免無限循環

        const userId = message.author.id; // 獲取發送訊息的用戶 ID

        // 檢查訊息內容是否包含「早上好基地」（不區分大小寫）
        if (message.content.toLowerCase().includes('早上好基地')) {
            // 透過 affectionManager 增加用戶好感度，並獲取更新後的值
            const currentAffection = affectionManager.addAffection(userId, 1);

            let replyMessage = '';
            // 根據好感度等級，生成不同的回覆訊息
            if (currentAffection < 5) {
                replyMessage = `早上好基地！${message.author.username}，歡迎來到這個充滿活力的一天！`;
            } else if (currentAffection < 15) {
                replyMessage = `☀️ 喔喔，又是個美好的一天！早上好基地，${message.author.username}！好感度：${currentAffection} ✨`;
            } else {
                replyMessage = `💖 親愛的 ${message.author.username}，早上好基地！看到你真是太開心了！今天的你一樣光芒四射呢！✨ 好感度：${currentAffection}！`;
            }
            await message.reply(replyMessage); // 回覆用戶
        }
    },
};
