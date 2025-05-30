const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config.js");
const fs = require("fs");
const path = require('path');
const { initializePlayer } = require('./player');
const { connectToDatabase } = require('./mongodb');
const colors = require('./UI/colors/colors');
// --- 這裡有改動：引入 @google/genai 的方式 ---
const { GoogleGenerativeAI } = require("@google/genai"); 
// --- 結束改動 ---
require('dotenv').config();

// --- Gemini AI 配置 ---
const MODEL_NAME = "gemini-flash"; // 或 "gemini-pro"，根據您的需求選擇
// --- 這裡有改動：正確實例化 GoogleGenerativeAI ---
const genAI = new GoogleGenerativeAI.GoogleGenerativeAI(process.env.GEMINI_API_KEY); 
// --- 結束改動 ---

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
    console.log(`<span class="math-inline">\{colors\.cyan\}\[ SYSTEM \]</span>{colors.reset} ${colors.green}Client logged as <span class="math-inline">\{colors\.yellow\}</span>{client.user.tag}${colors.reset}`);
    console.log(`<span class="math-inline">\{colors\.cyan\}\[ MUSIC \]</span>{colors.reset} <span class="math-inline">\{colors\.green\}Riffy Music System Ready 🎵</span>{colors.reset}`);
    console.log(`<span class="math-inline">\{colors\.cyan\}\[ TIME \]</span>{colors.reset} <span class="math-inline">\{colors\.gray\}</span>{new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
    client.riffy.init(client.user.id);

    // --- 註冊斜線指令 ---
    // 確保您的 bot.js 或相關文件中處理了 client.commands 的填充
    if (client.commands.length > 0) {
        try {
            await client.application.commands.set(client.commands);
            console.log(`<span class="math-inline">\{colors\.cyan\}\[ COMMAND \]</span>{colors.reset} <span class="math-inline">\{colors\.green\}Successfully registered slash commands\!</span>{colors.reset}`);
        } catch (error) {
            console.error(`<span class="math-inline">\{colors\.red\}\[ ERROR \]</span>{colors.reset} ${colors.red}Failed to register slash commands: <span class="math-inline">\{error\.message\}</span>{colors.reset}`);
        }
    } else {
        console.log(`<span class="math-inline">\{colors\.cyan\}\[ COMMAND \]</span>{colors.reset} <span class="math-inline">\{colors\.yellow\}No slash commands found to register\.</span>{colors.reset}`);
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
            console.error(`<span class="math-inline">\{colors\.red\}\[ AI ERROR \]</span>{colors.reset} Error generating content:`, error);
            await message.reply("抱歉，我現在無法處理你的請求。請稍後再試。");
        }
    }
});
// --- 結束 Gemini AI 訊息處理 ---

// 讀取並註冊事件處理器 (例如 'messageCreate', 'interactionCreate' 等)
fs.readdir("./events", (_err, files) => {
    files.forEach((file) => {
        if (!file.endsWith(".js")) return
