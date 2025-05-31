// your-discord-bot/events/messageCreate.js
const affectionManager = require('../utils/affectionManager'); // 引入好感度管理模組

// 直接導出一個異步函數
// 這個函數的參數會由 client.on 傳入，通常第一個是 client 物件本身，後面是事件的參數
// 對於 messageCreate 事件，它的參數是 (message)
// 但由於您在 bot.js 中使用了 event.bind(null, client)，這會把 client 綁定為第一個參數
// 所以這裡需要接收 (client, message)
module.exports = async (client, message) => { // 注意這裡接收 client 和 message
    if (message.author.bot) return; // 忽略機器人自己的訊息

    const userId = message.author.id;

    if (message.content.toLowerCase().includes('早上好基地')) {
        const currentAffection = affectionManager.addAffection(userId, 1);

        let replyMessage = '';
        if (currentAffection < 5) {
            replyMessage = `早上好基地！${message.author.username}，歡迎來到這個充滿活力的一天！`;
        } else if (currentAffection < 15) {
            replyMessage = `☀️ 喔喔，又是個美好的一天！早上好基地，${message.author.username}！好感度：${currentAffection} ✨`;
        } else {
            replyMessage = `💖 親愛的 ${message.author.username}，早上好基地！看到你真是太開心了！今天的你一樣光芒四射呢！✨ 好感度：${currentAffection}！`;
        }
        await message.reply(replyMessage);
    }
};
