const { getAIResponse } = require('../utils/ai/aiManager.js');

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot) return;

    // 判斷是否要觸發 AI 回覆
    const mentionedBot = message.mentions.has(client.user);
    const hasBaseKeyword = message.content.includes('晚上好基地');

    // 頻率限制：1 分鐘內最多 10 次
 if (hasBaseKeyword) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // 記憶體每日觸發判斷
  if (!global.dailyTrigger) global.dailyTrigger = new Map();
  if (global.dailyTrigger.get(message.author.id) === today) return;
  global.dailyTrigger.set(message.author.id, today);

  try {
    await message.channel.sendTyping();
    const sessionId = message.guild ? message.guild.id : message.channel.id;

    // AI prompt 生成學術事件紀錄
    const rawPrompt = `生成一條每日事件紀錄給用戶 ${message.author.username}。
請用文本風格：
📓 事件紀錄
調查員：<用戶名>
時間：<ISO時間>
紀錄：
  - <事件描述>
備註：<附加說明>
請生成一個新的事件紀錄，語氣專業、科學感，但加入克蘇魯神話風格，100字以內。`;

    const aiReply = await getAIResponse(rawPrompt, sessionId);

    await message.channel.send(aiReply);

  } catch (err) {
    console.error('❌ AI 回覆失敗:', err);
    await message.channel.send('✨ 改天再來調查？');
  }
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
