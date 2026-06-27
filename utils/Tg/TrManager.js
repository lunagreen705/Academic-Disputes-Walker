const { TelegramBot } = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const colors = require("../../UI/colors/colors"); 

const TG_TOKEN = process.env.TG_TOKEN;
const TG_ADMIN_ID = parseInt(process.env.TG_ADMIN_ID);
const TG_SUBSCRIBERS_FILE = './tg_subscribers.json';

function loadSubscribers() {
  if (fs.existsSync(TG_SUBSCRIBERS_FILE))
    return new Set(JSON.parse(fs.readFileSync(TG_SUBSCRIBERS_FILE)));
  return new Set();
}
function saveSubscribers(subs) {
  fs.writeFileSync(TG_SUBSCRIBERS_FILE, JSON.stringify([...subs]));
}

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
    // 每個指令監聽自己的 pattern
    bot.onText(cmd.pattern, (msg, match) => {
      cmd.execute({ bot, msg, match, discordClient, loadSubscribers, saveSubscribers, TG_ADMIN_ID });
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

module.exports = { initTelegramBot, loadSubscribers, saveSubscribers };