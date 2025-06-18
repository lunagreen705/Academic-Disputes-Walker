const { getAIResponse } = require('../utils/ai/aiManager.js');

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot) return;

    // 只要訊息有提到本機器人就觸發
    if (message.mentions.has(client.user)) {
      // 用群組ID作為 sessionId 保持上下文記憶
      const sessionId = message.guild ? message.guild.id : message.channel.id;

      // 移除所有機器人 mention（全局）
      const raw = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
      if (!raw) return;

      try {
        await message.channel.sendTyping();

        // 傳入 raw 內容和 sessionId，保持記憶
        const reply = await getAIResponse(raw, sessionId);

        await message.channel.send(reply);
      } catch (err) {
        console.error('❌ AI 回覆失敗:', err);
        await message.channel.send('✨ 改天再來調查？');
      }
    }
  }
};
