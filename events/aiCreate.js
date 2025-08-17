const { getAIResponse } = require('../utils/ai/aiManager.js');

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot) return;

    const mentionedBot = message.mentions.has(client.user);
    const hasBaseKeyword = message.content.includes('晚上好基地');
    const sessionId = message.guild ? message.guild.id : message.channel.id;

    // 每日事件紀錄觸發
    if (hasBaseKeyword) {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      if (!global.dailyTrigger) global.dailyTrigger = new Map();
      if (global.dailyTrigger.get(message.author.id) === today) return;
      global.dailyTrigger.set(message.author.id, today);

      try {
        await message.channel.sendTyping();

        const rawPrompt = `生成一條每日事件紀錄給用戶 ${message.author.username}。

【世界觀設定】
本紀錄隸屬於「米斯卡托尼克大學 / 異常現象觀測局 (M.I.O.)」，其檔案保存在多重加密與封印的數據庫中，僅供授權調查員查閱。
所有調查員在提交紀錄時，必須以嚴謹科學與理性分析角度描述異常現象，但語氣中不可避免地透露對未知、不可名狀存在的戰慄與敬畏。
此紀錄系統專門用於追蹤、分析並記錄潛伏於人類文明之外的異常事件，包括但不限於：

1.克蘇魯神話中的「外神干擾現實」

2.超乎人類認知的「真相裂縫」與「次元扭曲」

3.舊日支配者及其秘密邪教活動

4.神秘失蹤與異常死亡

5.古老遺跡與禁忌地點

6.異常自然現象與怪異事件

7.心靈侵蝕、幻覺與理智損失

8.古神或外神的低語及秘密儀式

【文本格式】
📓 事件紀錄
事件編號：自動生成唯一 ID（例如：MIO-2025-0817-001）
事件等級：低 / 中 / 高 / 致命（根據事件危險性判定）
調查員：${message.author.username}
時間：${now.toISOString()}  // ISO 時間由程式提供
地點：自動生成全球城市或地名
星象：隨機生成也可以不自然
異常偏移：根據事件生成
觀測異常數據：根據事件生成
紀錄：
  - <事件描述，科學冷靜卻暗藏詭秘>
備註：<未知警告或古籍碎語>

【要求】
- 語氣必須是「專業調查報告」而非日記
- 融合理性與不可名狀的恐懼
- 不超過 100 字
- 留白、詭秘、不可完全理解
- 帶入克蘇魯神話元素（符號、低語、失落地名）
請生成一個新的事件紀錄`;

        const aiReply = await getAIResponse(rawPrompt, sessionId);
        await message.channel.send(aiReply);

      } catch (err) {
        console.error('❌ AI 回覆失敗:', err);
        await message.channel.send('✨ 改天再來調查？');
      }
    }

    if (mentionedBot || hasBaseKeyword) {
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
