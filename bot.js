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
const aiManager = require("./utils/normal/aiManager");

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

  deckManager.loadDecks();
  console.log(`${colors.cyan}[ DECKS ]${colors.reset} ${colors.green}卡牌模組已載入 ✅${colors.reset}`);

  console.log(`${colors.cyan}[ AFFECTION ]${colors.reset} ${colors.green}好感度系統已準備就緒 ✅${colors.reset}`);
  console.log(`${colors.cyan}[ AI MANAGER ]${colors.reset} ${colors.green}模組已匯入，等待訊息觸發 ✅${colors.reset}`);
});

// ========== Event Loader ==========
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

// ========== Command Loader ==========
client.commands = [];

function loadCommands(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      loadCommands(fullPath); // 遞迴子目錄
    } else if (file.endsWith(".js")) {
      try {
        // --- 核心修改在這裡 ---
        // 使用 path.resolve() 將 fullPath 轉換為絕對路徑，
        // 確保 require() 可以正確找到文件。
        const commandModulePath = path.resolve(fullPath);
        const props = require(commandModulePath);
        // --- 核心修改結束 ---

        client.commands.push({
          name: props.name,
          description: props.description,
          options: props.options,
          category: path.basename(path.dirname(fullPath)) // 自動標記分類，取父資料夾名
        });
        console.log(`${colors.cyan}[ COMMAND ]${colors.reset} 已載入指令：${colors.yellow}${props.name}${colors.reset} (分類: ${path.basename(path.dirname(fullPath))})`);
      } catch (err) {
        console.error(`${colors.red}[ ERROR ] 無法載入指令 ${file}：${err.message}${colors.reset}`);
      }
    }
  }
}

loadCommands(config.commandsDir);

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

// ========== Express Web Server ==========
const express = require("express");
const app = express();
const port = 3000;

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