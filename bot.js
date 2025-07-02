// bot.js
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const config = require("./config.js");
const colors = require("./UI/colors/colors");
const { initializePlayer } = require("./utils/music/player.js");
const { connectToDatabase } = require("./utils/db/mongodb");

const deckManager = require("./utils/entertainment/deckManager");
const affectionManager = require("./utils/entertainment/affectionManager");
const aiManager = require("./utils/ai/aiManager");
const personaManager = require("./utils/ai/personaManager");
const botManager = require("./utils/normal/botManager");
const libraryManager = require('./utils/normal/libraryManager');
const oauth2 = require('./utils/auth/oauth2.js');

const express = require("express");
const app = express();
const port = 3000;

const client = new Client({
  intents: Object.values(GatewayIntentBits),
});
client.config = config;
initializePlayer(client);

// ========== 載入事件 ==========

const eventsPath = path.join(__dirname, "events");
fs.readdir(eventsPath, (err, files) => {
  if (err) {
    console.error(`${colors.red}[ ERROR ] 無法讀取事件資料夾：${err.message}${colors.reset}`);
    return;
  }

  files.forEach((file) => {
    if (!file.endsWith(".js")) return;
    const eventPath = path.join(eventsPath, file);
    const event = require(eventPath);

    try {
      if (typeof event === "function") {
        const eventName = file.split(".")[0];
        client.on(eventName, event.bind(null, client));
        console.log(`${colors.cyan}[ EVENT ]${colors.reset} 舊式事件載入：${colors.yellow}${eventName}${colors.reset}`);
      } else if (event.name && typeof event.execute === "function") {
        client.on(event.name, (...args) => event.execute(client, ...args));
        console.log(`${colors.cyan}[ EVENT ]${colors.reset} 已載入事件：${colors.yellow}${event.name}${colors.reset}`);
      } else {
        console.warn(`${colors.red}[ EVENT ] 格式錯誤，跳過：${file}${colors.reset}`);
      }
    } catch (err) {
      console.error(`${colors.red}[ ERROR ] 載入事件 ${file} 時發生錯誤：${err.message}${colors.reset}`);
    }
  });
});

// ========== 載入指令 ==========

client.commands = [];
function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      loadCommands(path.join(dir, entry.name));
    } else if (entry.name.endsWith(".js")) {
      try {
        const command = require(path.join(dir, entry.name));
        client.commands.push({
          name: command.name,
          description: command.description,
          options: command.options,
          autocomplete: command.autocomplete || null,  
          run: command.run,
          handleButton: command.handleButton || null,
        });
        console.log(`${colors.cyan}[ COMMAND ]${colors.reset} 已載入指令：${colors.yellow}${command.name}${colors.reset}`);
      } catch (err) {
        console.error(`${colors.red}[ ERROR ] 無法載入指令 ${entry.name}：${err.message}${colors.reset}`);
      }
    }
  }
}
loadCommands(path.join(__dirname, config.commandsDir));

// ========== Bot Ready  ==========

client.once("ready", async () => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🤖 DISCORD BOT STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ SYSTEM ]${colors.reset} ${colors.green}Client logged as ${colors.yellow}${client.user.tag}${colors.reset}`);
  console.log(`${colors.cyan}[ MUSIC ]${colors.reset} ${colors.green}Riffy Music System Ready 🎵${colors.reset}`);
  console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);

  client.riffy.init(client.user.id);

  try {
    // 連接資料庫
    await connectToDatabase();
    console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.green}MongoDB資料庫已連線 ✅${colors.reset}`);


    // 牌堆及好感度模組初始化（視具體實作）
    deckManager.loadDecks();
    console.log(`${colors.cyan}[ DECKS ]${colors.reset} ${colors.green}牌堆模組已準備就緒 ✅${colors.reset}`);
    console.log(`${colors.cyan}[ AFFECTION ]${colors.reset} ${colors.green}好感度系統已準備就緒 ✅${colors.reset}`);
    console.log(`${colors.cyan}[ AI ]${colors.reset} ${colors.green}AI模組已準備就緒 ✅${colors.reset}`);
    console.log(`${colors.cyan}[ MANAGER ]${colors.reset} ${colors.green}管理模組已準備就緒 ✅${colors.reset}`);
    console.log(`${colors.cyan}[ LIBRARY ]${colors.reset} ${colors.green}圖書模組已準備就緒 ✅${colors.reset}`);
  } catch (err) {
    console.error(`${colors.red}[ DATABASE ] MongoDB連線失敗，可能影響部分功能：${err.message}${colors.reset}`);
  }
});

// ==========  Voice Packets ==========

client.on("raw", (d) => {
  const { GatewayDispatchEvents } = require("discord.js");
  if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
  client.riffy.updateVoiceState(d);
});

// ========== 登入 BOT ==========

client.login(config.TOKEN || process.env.TOKEN).catch((e) => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🔐 TOKEN VERIFICATION${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ TOKEN ]${colors.reset} ${colors.red}Authentication Failed ❌${colors.reset}`);
  console.log(`${colors.gray}Error: Turn On Intents or Reset New Token${colors.reset}`);
});

// ========== Express 本地伺服器 ==========

app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "index.html");
  res.sendFile(filePath);
});

app.listen(port, () => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🌐 SERVER STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ SERVER ]${colors.reset} ${colors.green}Online ✅${colors.reset}`);
  console.log(`${colors.cyan}[ PORT ]${colors.reset} ${colors.yellow}http://localhost:${port}${colors.reset}`);
  console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
});
