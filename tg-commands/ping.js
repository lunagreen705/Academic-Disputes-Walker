module.exports = {
  name: '/ping',
  description: '測試 Bot 是否在線',
  pattern: /\/ping/,

  execute({ bot, msg }) {
    bot.sendMessage(msg.chat.id, '🏓 Pong！Bot 運作正常');
  }
};