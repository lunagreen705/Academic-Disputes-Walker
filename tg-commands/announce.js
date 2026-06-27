module.exports = {
  name: '/announce [內容]',
  description: '廣播通知給所有訂閱者（管理員限定）',
  pattern: /\/announce (.+)/,

  async execute({ bot, msg, match, loadSubscribers, TG_ADMIN_ID }) {
    if (msg.from.id !== TG_ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, '❌ 你沒有權限使用此指令');
    }

    const text = match[1];
    const subs = loadSubscribers();
    let success = 0, fail = 0;

    for (const chatId of subs) {
      try {
        await bot.sendMessage(chatId, `📢 ${text}`);
        success++;
      } catch { fail++; }
    }

    bot.sendMessage(msg.chat.id, `✅ 發送完成｜成功：${success}｜失敗：${fail}`);
  }
};