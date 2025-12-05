const { getAIResponse } = require('../utils/ai/aiManager.js');
module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot) return;

    const mentionedBot = message.mentions.has(client.user);
    const hasBaseKeyword = message.content.includes('晚上好基地');
    const sessionId = message.guild ? message.guild.id : message.channel.id;

    // --- 1. 優化時區計算與變數定義 (告別低效的 toLocaleString 黑魔法) ---
    // 直接用 Intl.DateTimeFormat 精確取得臺北時間的日期與時間字串，
    // 避免多餘的物件轉換和toISOString()的截斷。

    // 格式化為 YYYY-MM-DD
    const dateFormatter = new Intl.DateTimeFormat('fr-CA', { // 'fr-CA' locale 自然輸出 YYYY-MM-DD
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    // 格式化為 ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ) 的臺北時間物件
    const isoFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
        hourCycle: 'h23',
    });
    
    const taipeiDateStr = dateFormatter.format(new Date()); // YYYY-MM-DD (e.g., '2025-12-05')
    
    // 解決 ReferenceError 的關鍵：從 YYYY-MM-DD 轉為 YYYYMMDD
    const YYYYMMDD = taipeiDateStr.replace(/-/g, ''); // (e.g., '20251205')
    
    // 獲取一個近似的臺北時間 ISO 字串來滿足你的 prompt 需求
    const isoParts = isoFormatter.formatToParts(new Date());
    const taipeiISOTime = `${taipeiDateStr}T${isoParts.find(p => p.type === 'hour').value}:${isoParts.find(p => p.type === 'minute').value}:${isoParts.find(p => p.type === 'second').value}.000+08:00`; // 假定 UTC+8

    // 每日事件紀錄觸發（台北時間判斷）
    if (hasBaseKeyword) {
      
      if (!global.dailyTrigger) global.dailyTrigger = new Map();
      
      // 使用 YYYY-MM-DD 進行每日判斷
      if (global.dailyTrigger.get(message.author.id) !== taipeiDateStr) {
        global.dailyTrigger.set(message.author.id, taipeiDateStr); 

        try {
          await message.channel.sendTyping();
  
          // --- 2. 修正 ReferenceError 並使用正確變數 ---
          const rawPrompt = `你是一名M.I.O. (米斯卡托尼克大學異常觀測局) 資深調查員。

**行為準則：**
1. 輸出為嚴謹、科學、冷靜的報告格式，但內含對不可名狀實體(如舊日支配者)的戰慄與敬畏。
2. 內容融入克蘇魯神話元素、符號、低語或失落地名。
3. 輸出字數嚴格控制在100字以內，注重留白和詭秘感，保持資訊的不可完全理解性。

**任務：**
根據以下格式，為調查員 ${message.author.username} 生成一則當日的異常事件紀錄。

**格式：**
📓 事件紀錄
事件編號：MIO-${YYYYMMDD}-${Math.random().toString(36).substring(2, 5).toUpperCase()} 
事件等級：(低/中/高/致命)
現象類型：(外神干擾/次元裂縫/邪教活動/心靈侵蝕/異常死亡等隨機選一)
調查員：${message.author.username}
時間：${taipeiISOTime}
地點：(隨機全球地名或禁忌地點)
異常偏移：(一句專業且含糊的觀測數據描述)
紀錄：
- (事件簡述，理性描述超自然現象的片段)
備註：(一句未知的警告或古籍碎語)`; // 這裡直接使用 Math.random() 生成 XXX，避免另一個 ReferenceError

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
    if (mentionedBot) { // 已經確認過 hasBaseKeyword 的 case，因此只需要檢查 mentionedBot
      
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