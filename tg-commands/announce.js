module.exports = {
  name: '/announce [內容]',
  description: '廣播通知給所有訂閱者（管理員限定）',
  pattern: /\/announce (.+)/,

  async execute({ bot, msg, match, loadSubscribers, TG_ADMIN_ID }) {
    if (msg.from.id !== TG_ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, '❌ 你沒有權限使用此指令');
    }

    const text = match[1];

    // 等待 MongoDB 查詢完成
    const subs = await loadSubscribers();

    // 防止資料格式錯誤
    if (!Array.isArray(subs)) {
      console.error('loadSubscribers 回傳錯誤:', subs);

      return bot.sendMessage(
        msg.chat.id,
        '❌ 訂閱者資料格式錯誤'
      );
    }

    let success = 0;
    let fail = 0;

    for (const chatId of subs) {
      try {
        await bot.sendMessage(chatId, `📢 ${text}`);
        success++;
      } catch (err) {
        console.error(`發送失敗 ${chatId}:`, err.message);
        fail++;
      }
    }

    await bot.sendMessage(
      msg.chat.id,
      `✅ 發送完成｜成功：${success}｜失敗：${fail}`
    );
  }
};