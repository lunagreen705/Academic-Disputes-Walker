const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config.js");
const fs = require("fs");
const path = require('path');
const { initializePlayer } = require('./player');
const { connectToDatabase } = require('./mongodb');
const colors = require('./UI/colors/colors');
const { GoogleGenerativeAI } = require("@google/genai"); // 使用新的 @google/genai 套件
require('dotenv').config();

// --- Gemini AI 配置 ---
const MODEL_NAME = "gemini-flash"; // 或 "gemini-pro"，根據您的需求選擇
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// --- 結束 Gemini AI 配置 ---

const client = new Client({
    // 精確地列出所需的 Intents，而不是全部啟用
    intents: [
        GatewayIntentBits.Guilds,           // 用於伺服器相關事件 (例如加入/離開伺服器、頻道建立)
        GatewayIntentBits.GuildMessages,    // 用於接收伺服器內的訊息
        GatewayIntentBits.MessageContent,   // 【重要】用於讀取訊息的實際內容 (AI 回應和指令處理需要)
        GatewayIntentBits.GuildVoiceStates, // 用於音樂機器人的語音頻道狀態更新
        // 如果您的機器人需要更多功能 (例如獲取成員列表，或處理私人訊息)，請在此處添加相應的 Intent：
        // GatewayIntentBits.GuildMembers,   // 【特權 Intent】用於獲取伺服器成員資訊 (需在 Discord Developer Portal 啟用)
        // GatewayIntentBits.DirectMessages, // 用於接收直接訊息
    ],
});

client.config = config; // 設定機器人配置
initializePlayer(client); // 初始化音樂播放器

client.on("ready", async () => {
    console.log(`${colors.cyan}[ SYSTEM ]${colors.reset} ${colors.green}Client logged as ${colors.yellow}${client.user.tag}${colors.reset}`);
    console.log(`${colors.cyan}[ MUSIC ]${colors.reset} ${colors.green}Riffy Music System Ready 🎵${colors.reset}`);
    console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
    client.riffy.init(client.user.id);

    // --- 註冊斜線指令 ---
    // 確保您的 bot.js 或相關文件中處理了 client.commands 的填充
    if (client.commands.length > 0) {
        try {
            await client.application.commands.set(client.commands);
            console.log(`${colors.cyan}[ COMMAND ]${colors.reset} ${colors.green}Successfully registered slash commands!${colors.reset}`);
        } catch (error) {
            console.error(`${colors.red}[ ERROR ]${colors.reset} ${colors.red}Failed to register slash commands: ${error.message}${colors.reset}`);
        }
    } else {
        console.log(`${colors.cyan}[ COMMAND ]${colors.reset} ${colors.yellow}No slash commands found to register.${colors.reset}`);
    }
    // --- 結束斜線指令註冊 ---
});

// --- Gemini AI 訊息處理 ---
client.on("messageCreate", async (message) => {
    // 忽略來自機器人本身的訊息，防止無限循環
    if (message.author.bot) return;

    // 當機器人被 @提及 時觸發
    if (message.mentions.has(client.user)) {
        // 從訊息內容中移除機器人的 @提及 部分，並去除前後空白
        const userMessage = message.content
            .replace(`<@!${client.user.id}>`, "") // 處理 <@!ID> 格式的提及
            .replace(`<@${client.user.id}>`, "")   // 處理 <@ID> 格式的提及
            .trim();

        // 如果訊息內容只剩下提及或空白，則不處理
        if (userMessage.length === 0) {
            await message.reply("嗯？你需要我幫忙嗎？請在提及我後輸入你的問題。");
            return;
        }

        // 發送「正在輸入...」狀態，提升使用者體驗
        await message.channel.sendTyping();

        try {
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });

            const generationConfig = {
                temperature: 0.9,      // 0.0-1.0，值越高，回應越具創意/隨機性
                topK: 40,              // 建議值：考慮前 K 個可能性最高的詞元 (通常比 1 更好，增加多樣性)
                topP: 0.9,             // 建議值：核採樣，考慮累積機率達到 P 的詞元 (通常比 1 更好，增加多樣性)
                maxOutputTokens: 2048, // 最大輸出詞元數
            };

            // 以「使用者」角色傳遞訊息給 Gemini 模型
            const parts = [{
                role: "user",
                text: userMessage,
            }];

            const result = await model.generateContent({
                contents: [{ role: "user", parts }],
                generationConfig,
            });

            const reply = await result.response.text();

            // 由於 Discord 訊息有 2000 字元限制，需要分割長訊息
            if (reply.length > 2000) {
                const replyArray = reply.match(/[\s\S]{1,1999}/g); // 確保每個片段略小於 2000
                for (const msg of replyArray) { // 使用 for...of 確保按順序發送
                    await message.reply(msg);
                }
            } else {
                await message.reply(reply);
            }
        } catch (error) {
            console.error(`${colors.red}[ AI ERROR ]${colors.reset} Error generating content:`, error);
            await message.reply("抱歉，我現在無法處理你的請求。請稍後再試。");
        }
    }
});
// --- 結束 Gemini AI 訊息處理 ---

// 讀取並註冊事件處理器 (例如 'messageCreate', 'interactionCreate' 等)
fs.readdir("./events", (_err, files) => {
    files.forEach((file) => {
        if (!file.endsWith(".js")) return;
        const event = require(`./events/${file}`);
        let eventName = file.split(".")[0];
        client.on(eventName, event.bind(null, client));
        delete require.cache[require.resolve(`./events/${file}`)]; // 清除快取，有利於開發時熱重載
    });
});

client.commands = []; // 初始化一個陣列來儲存斜線指令資訊
// 讀取並載入斜線指令 (這些指令隨後會在 'ready' 事件中註冊到 Discord API)
fs.readdir(config.commandsDir, (err, files) => {
    if (err) {
        console.error(`${colors.red}[ ERROR ]${colors.reset} ${colors.red}Failed to read commands directory: ${err.message}${colors.reset}`);
        return;
    }
    files.forEach(async (f) => {
        try {
            if (f.endsWith(".js")) {
                let props = require(`${config.commandsDir}/${f}`);
                client.commands.push({
                    name: props.name,
                    description: props.description,
                    options: props.options,
                });
                console.log(`${colors.cyan}[ COMMAND ]${colors.reset} ${colors.green}Loaded command: ${colors.yellow}${props.name}${colors.reset}`);
            }
        } catch (err) {
            console.error(`${colors.red}[ ERROR ]${colors.reset} ${colors.red}Failed to load command ${f}: ${err.message}${colors.reset}`);
        }
    });
});

// 處理原始 Discord 網關事件 (主要用於 Riffy 的語音狀態更新)
client.on("raw", (d) => {
    const { GatewayDispatchEvents } = require("discord.js"); // 局部引用，避免全域污染
    if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
    client.riffy.updateVoiceState(d);
});

// 登入 Discord 機器人
client.login(config.TOKEN || process.env.TOKEN).catch((e) => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🔐 TOKEN VERIFICATION${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ TOKEN ]${colors.reset} ${colors.red}Authentication Failed ❌${colors.reset}`);
    console.log(`${colors.gray}Error: ${e.message}. Please turn on necessary Intents or reset to a new Token.${colors.reset}`); // 更明確的錯誤提示
});

// 連接到 MongoDB 資料庫
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

// 設定一個簡單的 Express Web 伺服器
const express = require("express");
const app = express();
const port = 3000;
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'index.html'); // 假設 index.html 存在於機器人主目錄
    res.sendFile(filePath);
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
