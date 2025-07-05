// bot.js
const { Client, GatewayIntentBits } = require("discord.js");
const { google } = require('googleapis');
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const config = require("./config.js");
const colors = require("./UI/colors/colors");
//========== 載入模組 ==========

const { initializePlayer } = require("./utils/music/player.js");
const { connectToDatabase } = require("./utils/db/mongodb"); 
const deckManager = require("./utils/entertainment/deckManager");
const affectionManager = require("./utils/entertainment/affectionManager");
const aiManager = require("./utils/ai/aiManager");
const personaManager = require("./utils/ai/personaManager");
const botManager = require("./utils/normal/botManager");
const libraryManager = require('./utils/normal/libraryManager');
const { getAuth, saveToken, CLIENT_SECRET_PATH } = require('./utils/auth/oauth2.js'); 
const schedulerManager = require('./utils/normal/schedulerManager');

//========== 連線設定 ==========

const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

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
      if (event.name && typeof event.execute === "function") {
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

// ========== 載入指令  ==========

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

// === 核心：定義所有排程任務可以執行的動作 ===
const taskActionFunctions = {
    /**
     * 發送好感度排行榜到指定頻道 (用於 autotasks.json)
     */
    'sendAffectionLeaderboard': (task, client) => {
        const channelId = task.args?.channelId;
        if (!channelId) {
            console.error(`[Action:sendAffectionLeaderboard] 任務 ${task.id} 未在 args 中指定 channelId。`);
            return;
        }
        schedulerManager.postAffectionLeaderboard(client, channelId, task.args?.limit);
    },

    /**
     * 發送私訊給建立任務的使用者 (用於 personaltasks.json)
     */
    'sendDirectMessage': async (task, client) => {
        try {
            const user = await client.users.fetch(task.userId);
            if (user) {
                const message = task.args?.message || `這是一則來自 ${client.user.username} 的排程提醒！`;
                await user.send(message);
            }
        } catch (error) {
            console.error(`${colors.red}[Action:sendDirectMessage]${colors.reset} ❌ 發送私訊失敗 (任務ID: ${task.id}):`, error.message);
        }
    }
};


// ========== Bot Ready  ==========

client.once("ready", async () => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🤖 DISCORD BOT STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ SYSTEM ]${colors.reset} ${colors.green}Client logged as ${colors.yellow}${client.user.tag}${colors.reset}`);
  console.log(`${colors.cyan}[ MUSIC ]${colors.reset} ${colors.green}Riffy Music System Ready 🎵${colors.reset}`);
  console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.green}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
  client.riffy.init(client.user.id);
  
    try {
        // 初始化所有需要資料庫或其他前置作業的模組
        await connectToDatabase();
        console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.green}MongoDB 資料庫已連線 ✅${colors.reset}`);
        
        deckManager.loadDecks(); // 牌堆系統
        console.log(`${colors.cyan}[ SYSTEMS ]${colors.reset} ${colors.green}所有主要功能模組已準備就緒 ✅${colors.reset}`);

        // =========================================================
        // ===             初始化排程器 (正確的位置)             ===
        // =========================================================
        console.log(`${colors.cyan}[ SCHEDULER ]${colors.reset} ${colors.yellow}正在初始化排程任務...${colors.reset}`);
        
        // 將 taskActionFunctions 附加到 client 上，方便其他檔案（如指令檔）取用
        client.taskActionFunctions = taskActionFunctions; 
        
        // 現在傳遞的是一本內容完整的「說明書」
        await schedulerManager.initializeScheduler(client, taskActionFunctions);

    } catch (err) {
        console.error(`${colors.red}[ ERROR ] 準備就緒過程中發生錯誤：${err.message}${colors.reset}`);
    }
});


// ========== Voice Packets  ==========

client.on("raw", (d) => {
  const { GatewayDispatchEvents } = require("discord.js");
  if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
  client.riffy.updateVoiceState(d);
});

// ========== 登入 BOT  ==========

client.login(config.TOKEN || process.env.TOKEN).catch((e) => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🔐 TOKEN VERIFICATION${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ TOKEN ]${colors.reset} ${colors.red}Authentication Failed ❌${colors.reset}`);
  console.log(`${colors.gray}Error: Turn On Intents or Reset New Token${colors.reset}`);
});

// ========== Express 網頁伺服器 ==========

try {
    const clientSecretContent = fs.readFileSync(CLIENT_SECRET_PATH, 'utf8');
    const credentials = JSON.parse(clientSecretContent);
    const { client_id, client_secret, redirect_uris } = credentials.web || credentials.installed;
    const REDIRECT_URI = redirect_uris[0]; 
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

    app.get("/", (req, res) => {
      const filePath = path.join(__dirname, "index.html");
      res.sendFile(filePath);
    });

    app.get('/auth/google', (req, res) => {
      const scopes = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/userinfo.profile',
      ];
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
      });
      res.send(`請訪問以下 URL 進行 Google Drive 權限授權：<a href="${authUrl}">點擊這裡</a>。`);
    });

    app.get('/oauth2callback', async (req, res) => {
      const { code } = req.query;
      if (!code) {
        return res.status(400).send('Google OAuth2 授權失敗：未收到授權碼。');
      }
      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        await saveToken(tokens);
        res.send('Google Drive 授權成功！令牌已儲存至資料庫。您可以關閉此頁面。');
      } catch (error) {
        console.error('[ERROR] 交換 Google Drive 令牌失敗:', error.message);
        res.status(500).send(`交換 Google Drive 令牌失敗：${error.message}`);
      }
    });

    app.listen(port, () => {
      console.log('\n' + '─'.repeat(40));
      console.log(`${colors.magenta}${colors.bright}🌐 SERVER STATUS${colors.reset}`);
      console.log('─'.repeat(40));
      console.log(`${colors.cyan}[ SERVER ]${colors.reset} ${colors.green}Online ✅${colors.reset}`);
      console.log(`${colors.cyan}[ PORT ]${colors.reset} ${colors.yellow}http://localhost:${port}${colors.reset}`); 
    });
} catch (error) {
    console.warn(`${colors.yellow}[OAUTH2]${colors.reset} ⚠️ 未找到 client_secret.json，Google Drive 相關功能將停用。`);
}