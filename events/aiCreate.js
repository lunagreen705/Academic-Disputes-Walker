const { getAIResponse } = require('../utils/ai/aiManager.js');

let baseTriggerTimes = []; // 全局觸發時間記錄

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot) return;

    // 判斷是否要觸發 AI 回覆
    const mentionedBot = message.mentions.has(client.user);
    const hasBaseKeyword = message.content.includes('晚上好基地');

    // 頻率限制：1 分鐘內最多 10 次
    if (hasBaseKeyword) {
      const now = Date.now();
      baseTriggerTimes = baseTriggerTimes.filter(t => now - t < 60_000);
      if (baseTriggerTimes.length >= 10) return; // 超過頻率直接略過
      baseTriggerTimes.push(now);
    }

    if (mentionedBot || hasBaseKeyword) {
      const sessionId = message.guild ? message.guild.id : message.channel.id;
      const raw = mentionedBot
        ? message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim()
        : message.content;

      if (!raw) return;

      try {
        await message.channel.sendTyping();
        const reply = await getAIResponse(raw, sessionId);
        await message.channel.send(reply);
      } catch (err) {
        console.error('❌ AI 回覆失敗:', err);
        await message.channel.send('✨ 改天再來調查？');
      }
    }
  }
};
