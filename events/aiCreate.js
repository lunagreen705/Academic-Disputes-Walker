const { getAIResponse } = require('../utils/normal/aiManager.js');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // 判斷是否提到 bot 本人
    if (message.mentions.has(client.user)) {
      const prompt = message.content.replace(/<@!?(\d+)>/, '').trim();
      if (!prompt) return;

      try {
        const reply = await getAIResponse(prompt);
        await message.channel.send(reply);
      } catch (err) {
        console.error('❌ AI 回覆失敗:', err);
        await message.channel.send('✨ 改天再來調查？');
      }
    }
  });
};
