// your-discord-bot/commands/affection.js
const affectionManager = require('../utils/affectionManager'); // 引入好感度管理模組

module.exports = {
    data: { // 定義指令的元資料
        name: '好感度', // 指令名稱，用戶將輸入 `!好感度`
        description: '查看你對機器人的好感度。', // 指令的簡短描述
    },
    async execute(message, args) { // 指令執行函數，接收 message 和 args (參數)
        const userId = message.author.id; // 獲取發送指令的用戶 ID
        // 透過 affectionManager 獲取用戶的好感度
        const currentAffection = affectionManager.getAffection(userId);

        // 回覆用戶其當前的好感度
        await message.reply(`${message.author.username}，你目前的好感度是：${currentAffection} 點。`);
    },
};
