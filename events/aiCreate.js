const { getAIResponse } = require('../utils/normal/aiManager.js');

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot) return;

    if (message.mentions.has(client.user)) {
      const prompt = message.content.replace(/<@!?(\d+)>/, '').trim();
      if (!prompt) return;

      try {
        const { getAIResponse } = require('../utils/normal/aiManager.js');
        const reply = await getAIResponse(prompt);
        await message.channel.send(reply);
      } catch (err) {
        console.error('❌ AI 回覆失敗:', err);
        await message.channel.send('✨ 改天再來調查？');
      }
    }
  }
};