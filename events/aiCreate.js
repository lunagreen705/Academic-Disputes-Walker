const { getAIResponse } = require('../utils/normal/aiManager.js');

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    // 忽略機器人自己
    if (message.author.bot) return;

    // 被提及才觸發
    if (message.mentions.has(client.user)) {
      const raw = message.content.replace(/<@!?(\d+)>/, '').trim();
      if (!raw) return;

      try {
        await message.channel.sendTyping(); // 增加沉浸感
        const reply = await getAIResponse(raw);
        await message.channel.send(reply);
      } catch (err) {
        console.error('❌ AI 回覆失敗:', err);
        await message.channel.send('✨ 改天再來調查？');
      }
    }
  }
};