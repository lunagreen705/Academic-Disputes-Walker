// ...
module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot) return;

    const mentionedBot = message.mentions.has(client.user);
    const hasBaseKeyword = message.content.includes('晚上好基地');
    const sessionId = message.guild ? message.guild.id : message.channel.id;

    // 每日事件紀錄觸發（台北時間判斷）
    if (hasBaseKeyword) {
      const now = new Date();
      const taipeiNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
      const taipeiDateStr = taipeiNow.toISOString().slice(0, 10); // YYYY-MM-DD

      if (!global.dailyTrigger) global.dailyTrigger = new Map();
      
      
      if (global.dailyTrigger.get(message.author.id) !== taipeiDateStr) {
        global.dailyTrigger.set(message.author.id, taipeiDateStr); 

        try {
          await message.channel.sendTyping();
  
          const rawPrompt = `你是一名M.I.O. (米斯卡托尼克大學異常觀測局) 資深調查員。

**行為準則：**
1. 輸出為嚴謹、科學、冷靜的報告格式，但內含對不可名狀實體(如舊日支配者)的戰慄與敬畏。
2. 內容融入克蘇魯神話元素、符號、低語或失落地名。
3. 輸出字數嚴格控制在100字以內，注重留白和詭秘感，保持資訊的不可完全理解性。

**任務：**
根據以下格式，為調查員 ${message.author.username} 生成一則當日的異常事件紀錄。

**格式：**
📓 事件紀錄
事件編號：MIO-${YYYYMMDD}-${XXX} (隨機生成)
事件等級：(低/中/高/致命)
現象類型：(外神干擾/次元裂縫/邪教活動/心靈侵蝕/異常死亡等隨機選一)
調查員：${message.author.username}
時間：${taipeiNow.toISOString()}
地點：(隨機全球地名或禁忌地點)
異常偏移：(一句專業且含糊的觀測數據描述)
紀錄：
- (事件簡述，理性描述超自然現象的片段)
備註：(一句未知的警告或古籍碎語)`; 
          const aiReply = await getAIResponse(rawPrompt, sessionId);
          await message.channel.send(aiReply);

          return; 

        } catch (err) {
          console.error('❌ 學術糾紛回覆失敗:', err);
          await message.channel.send('✨ 改天再來調查？');
        }
      }
    }

    // （@bot觸發）
    if (mentionedBot || hasBaseKeyword) { 

      if (!mentionedBot) return; 
      
      const raw = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();

      if (!raw) return;

      try {
        await message.channel.sendTyping();
        const reply = await getAIResponse(raw, sessionId);
        await message.channel.send(reply);
      } catch (err) {
        console.error('❌ 學術糾紛回覆失敗:', err);
        await message.channel.send('✨ 改天再來調查？');
      }
    }
  }
};