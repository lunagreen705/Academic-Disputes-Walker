import { getAIResponse } from '../utils/normal/aiManager.js';

client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // 忽略機器人自己

  // 假設妳想要偵測 @bot 的訊息
  if (message.mentions.has(client.user)) {
    // 去掉 @機器人的標籤，剩下的文字就是 prompt
    const prompt = message.content.replace(/<@!?(\d+)>/, '').trim();
    if (!prompt) return;

    const reply = await getAIResponse(prompt);
    message.channel.send(reply);
  }
});
