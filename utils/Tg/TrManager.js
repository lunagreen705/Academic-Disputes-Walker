const { TelegramBot } = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const colors = require("../../UI/colors/colors");
const { getCollections } = require('../db/mongodb');

const TG_TOKEN = process.env.TG_TOKEN;
const TG_ADMIN_ID = parseInt(process.env.TG_ADMIN_ID);

// ========== 訂閱者：改用 MongoDB ==========

async function loadSubscribers() {
  const { tgSubscribersCollection } = getCollections();
  const docs = await tgSubscribersCollection.find({}).toArray();
  return new Set(docs.map(doc => doc.chatId));
}

async function addSubscriber(chatId) {
  const { tgSubscribersCollection } = getCollections();
  await tgSubscribersCollection.updateOne(
    { chatId },
    { $set: { chatId, subscribedAt: new Date() } },
    { upsert: true }
  );
}

async function removeSubscriber(chatId) {
  const { tgSubscribersCollection } = getCollections();
  await tgSubscribersCollection.deleteOne({ chatId });
}

// ========== 初始化 Bot ==========

function initTelegramBot(discordClient) {
  if (!TG_TOKEN) {
    console.warn(`${colors.yellow}[ TELEGRAM ]${colors.reset} ⚠️ 未設定 TG_TOKEN，功能停用`);
    return null;
  }

  const bot = new TelegramBot(TG_TOKEN, { polling: true });

  // ========== 自動載入指令 ==========
  const commandsPath = path.join(process.cwd(), 'tg-commands');
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const cmd = require(path.join(commandsPath, file));
    bot.onText(cmd.pattern, (msg, match) => {
      cmd.execute({
        bot,
        msg,
        match,
        discordClient,
        loadSubscribers,
        addSubscriber,
        removeSubscriber,
        TG_ADMIN_ID
      });
    });
    console.log(`${colors.cyan}[ TG CMD ]${colors.reset} 已載入：${colors.yellow}${cmd.name}${colors.reset}`);
  }

  // ========== 顯示指令清單 ==========
  bot.onText(/\/help/, (msg) => {
    const list = files.map(f => {
      const c = require(path.join(commandsPath, f));
      return `${c.name} - ${c.description}`;
    }).join('\n');
    bot.sendMessage(msg.chat.id, `📋 可用指令：\n\n${list}`);
  });

  console.log(`${colors.cyan}[ TELEGRAM ]${colors.reset} ${colors.green}TG Bot 已啟動 ✅${colors.reset}`);
  return bot;
}

module.exports = { initTelegramBot, loadSubscribers, addSubscriber, removeSubscriber };