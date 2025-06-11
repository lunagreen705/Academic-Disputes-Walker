import { getAIResponse } from '../utils/normal/aiManager.js';

export default (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // 判斷是否提到 bot 本人
    if (message.mentions.has(client.user)) {
      const prompt = message.content.replace(/<@!?(\d+)>/, '').trim();
      if (!prompt) return;

      const reply = await getAIResponse(prompt);
      message.channel.send(reply);
    }
  });
};
