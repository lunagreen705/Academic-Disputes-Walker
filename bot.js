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

// ========== Google OAuth2 相關模組 ==========
const { google } = require('googleapis');
const { getAuth, saveToken, CLIENT_SECRET_PATH } = require('./utils/auth/oauth2.js'); 
// --------------------------------------------------

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

// 讀取 client_secret.json 以便初始化 oAuth2Client
const clientSecretContent = fs.readFileSync(CLIENT_SECRET_PATH, 'utf8');
const credentials = JSON.parse(clientSecretContent);
const { client_id, client_secret, redirect_uris } = credentials.web || credentials.installed;

// 確保 REDIRECT_URI 是你 Render 部署的網址，且要與 Google Cloud Console 中設定的完全一致
const REDIRECT_URI = redirect_uris[0]; // 例如 "https://academic-disputes-walker.onrender.com"

// 創建 OAuth2 客戶端，用於生成授權 URL 和交換令牌
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

// 根路徑，用於顯示基本的首頁或授權入口
app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "index.html");
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('[ERROR] 發送首頁失敗:', err);
      res.status(500).send('伺服器錯誤，無法讀取首頁。');
    }
  });
});

// --- 新增：啟動 Google OAuth2 授權流程的路由 ---
app.get('/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  try {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
    console.log(`[INFO] 請訪問以下 URL 進行授權：${authUrl}`);
    res.send(`請訪問以下 URL 進行 Google Drive 權限授權：<a href="${authUrl}" target="_blank" rel="noopener noreferrer">點擊這裡</a>。授權完成後，此頁面會顯示成功訊息，您即可關閉。`);
  } catch (error) {
    console.error('[ERROR] 生成授權 URL 失敗:', error);
    res.status(500).send('伺服器錯誤，無法生成授權 URL。');
  }
});

// --- 新增：Google OAuth2 回呼路由 ---
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    console.error('[ERROR] Google OAuth2 回呼未收到授權碼。');
    return res.status(400).send('Google OAuth2 授權失敗：未收到授權碼。');
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    try {
      await saveToken(tokens);
      console.log('[INFO] Google Drive 令牌已成功獲取並儲存到 MongoDB！');
      res.send('Google Drive 授權成功！令牌已儲存至資料庫。您可以關閉此頁面。');
    } catch (saveError) {
      console.error('[ERROR] 儲存令牌至 MongoDB 失敗:', saveError);
      res.status(500).send('令牌授權成功，但儲存令牌時發生錯誤，請檢查伺服器日誌。');
    }
  } catch (error) {
    console.error('[ERROR] 交換 Google Drive 令牌失敗:', error);
    res.status(500).send(`交換 Google Drive 令牌失敗：${error.message}`);
  }
});

// 啟動伺服器
app.listen(port, () => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🌐 SERVER STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ SERVER ]${colors.reset} ${colors.green}Online ✅${colors.reset}`);
  console.log(`${colors.cyan}[ PORT ]${colors.reset} ${colors.yellow}http://localhost:${port}${colors.reset}`);
  console.log(`${colors.cyan}[ RENDER URL ]${colors.reset} ${colors.yellow}${REDIRECT_URI}${colors.reset}`);
  console.log(`${colors.cyan}[ Google Auth URL ]${colors.reset} ${colors.yellow}${REDIRECT_URI}/auth/google${colors.reset}`);
  console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
});