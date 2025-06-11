const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config.js");
const fs = require("fs");
const path = require("path");
const { initializePlayer } = require("./player");
const { connectToDatabase } = require("./utils/db/mongodb");
const colors = require("./UI/colors/colors");
const deckManager = require("./utils/entertainment/deckManager");
const affectionManager = require("./utils/entertainment/affectionManager");
const aiManager = require("./utils/normal/aiManager");

require("dotenv").config();

const client = new Client({
  intents: Object.values(GatewayIntentBits),
});

client.config = config;
initializePlayer(client);

// ========== Ready ==========
client.on("ready", () => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🤖 DISCORD BOT STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ SYSTEM ]${colors.reset} ${colors.green}Client logged as ${colors.yellow}${client.user.tag}${colors.reset}`);
  console.log(`${colors.cyan}[ MUSIC ]${colors.reset} ${colors.green}Riffy Music System Ready 🎵${colors.reset}`);
  console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);

  client.riffy.init(client.user.id);

  // --- 載入牌堆 ---
  deckManager.loadDecks();
  console.log(`${colors.cyan}[ DECKS ]${colors.reset} ${colors.green}卡牌模組已載入 ✅${colors.reset}`);

  // --- 好感度模組 ---
  console.log(`${colors.cyan}[ AFFECTION ]${colors.reset} ${colors.green}好感度系統已準備就緒 ✅${colors.reset}`);

  // --- AI 模組 ---
  console.log(`${colors.cyan}[ AI MANAGER ]${colors.reset} ${colors.green}模組已匯入，等待訊息觸發 ✅${colors.reset}`);
});

// ========== Event Handlers (Safe Load) ==========
const eventsPath = path.join(__dirname, "events");

fs.readdir(eventsPath, (err, files) => {
  if (err) {
    console.error(`${colors.red}[ ERROR ] 無法讀取事件資料夾：${err.message}${colors.reset}`);
    return;
  }

  files.forEach((file) => {
    if (!file.endsWith(".js")) return;

    const eventPath = path.join(eventsPath, file);
    const eventName = path.basename(file, ".js");

    try {
      const eventHandler = require(eventPath);
      client.removeAllListeners(eventName); // 防止重複掛載
      client.on(eventName, (...args) => eventHandler(client, ...args));
      console.log(`${colors.cyan}[ EVENT ]${colors.reset} 已載入事件：${colors.yellow}${eventName}${colors.reset}`);
    } catch (err) {
      console.error(`${colors.red}[ ERROR ] 無法載入事件檔 ${file}：${err.message}${colors.reset}`);
    }
  });
});

// ========== Commands ==========
client.commands = [];

fs.readdir(config.commandsDir, (err, files) => {
  if (err) {
    console.error(`${colors.red}[ ERROR ] 指令載入失敗：${err.message}${colors.reset}`);
    return;
  }

  files.forEach((f) => {
    if (!f.endsWith(".js")) return;

    try {
      const props = require(`${config.commandsDir}/${f}`);
      client.commands.push({
        name: props.name,
        description: props.description,
        options: props.options,
      });
      console.log(`${colors.cyan}[ COMMAND ]${colors.reset} 已載入指令：${colors.yellow}${props.name}${colors.reset}`);
    } catch (err) {
      console.error(`${colors.red}[ ERROR ] 無法載入指令 ${f}：${err.message}${colors.reset}`);
    }
  });
});

// ========== Voice Raw Packets ==========
client.on("raw", (d) => {
  const { GatewayDispatchEvents } = require("discord.js");
  if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
  client.riffy.updateVoiceState(d);
});

// ========== Bot Login ==========
client.login(config.TOKEN || process.env.TOKEN).catch((e) => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🔐 TOKEN VERIFICATION${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ TOKEN ]${colors.reset} ${colors.red}Authentication Failed ❌${colors.reset}`);
  console.log(`${colors.gray}Error: Turn On Intents or Reset New Token${colors.reset}`);
});

// ========== MongoDB ==========
connectToDatabase().then(() => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.green}MongoDB Online ✅${colors.reset}`);
}).catch((err) => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.red}Connection Failed ❌${colors.reset}`);
  console.log(`${colors.gray}Error: ${err.message}${colors.reset}`);
});

// ========== Web Express Server ==========
const express = require("express");
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  const imagePath = path.join(__dirname, 'index.html');
  res.sendFile(imagePath);
});

app.listen(port, () => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🌐 SERVER STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ SERVER ]${colors.reset} ${colors.green}Online ✅${colors.reset}`);
  console.log(`${colors.cyan}[ PORT ]${colors.reset} ${colors.yellow}http://localhost:${port}${colors.reset}`);
  console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
  console.log(`${colors.cyan}[ USER ]${colors.reset} ${colors.yellow}GlaceYT${colors.reset}`);
});