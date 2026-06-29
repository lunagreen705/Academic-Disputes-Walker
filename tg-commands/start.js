module.exports = {
  name: '/start',
  description: '訂閱更新',
  pattern: /\/start/,

  async execute({ bot, msg, addSubscriber }) {
    await addSubscriber(msg.chat.id);
    bot.sendMessage(msg.chat.id, '✅ 已訂閱！有更新時會通知你。');
  }
};