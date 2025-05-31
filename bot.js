const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const config = require("./config.js");
const fs = require("fs");
const path = require('path');
const { initializePlayer } = require('./player');
const { connectToDatabase } = require('./mongodb');
const colors = require('./UI/colors/colors');
require('dotenv').config();

const client = new Client({
    intents: Object.keys(GatewayIntentBits).map((a) => {
        return GatewayIntentBits[a];
    }),
});

client.config = config;
initializePlayer(client);

client.on("ready", async () => {
    console.log(`${colors.cyan}[ SYSTEM ]${colors.reset} ${colors.green}Client logged as ${colors.yellow}${client.user.tag}${colors.reset}`);
    console.log(`${colors.cyan}[ MUSIC ]${colors.reset} ${colors.green}Riffy Music System Ready 🎵${colors.reset}`);
    console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
    client.riffy.init(client.user.id);

    // --- 指令部署邏輯 (每次機器人啟動時執行) ---
    // 這個陣列只包含 SlashCommandBuilder 格式的指令，用於部署到 Discord API
    const commandsToDeploy = [];
    const commandsPath = path.join(__dirname, config.commandsDir);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        // 檢查指令是否是 SlashCommandBuilder 格式 (有 'data' 屬性)
        if ('data' in command && 'run' in command) {
            commandsToDeploy.push(command.data.toJSON()); // 將 SlashCommandBuilder 的資料轉換為 JSON 格式
        } else if ('name' in command && 'run' in command) {
            // 如果是舊格式的指令 (有 'name' 和 'run' 但沒有 'data')
            // 它們將不會作為斜線指令部署，但仍會被載入供其他處理方式 (例如前綴指令) 使用
            console.warn(`${colors.yellow}[ WARNING ]${colors.reset} Command '${command.name || file}' at ${filePath} is in an old format and will not be deployed as a slash command.`);
        } else {
            // 檔案不符合任何已知指令格式
            console.warn(`${colors.yellow}[ WARNING ]${colors.reset} The command file at ${filePath} is missing a required "data" or "run" property.`);
        }
    }

    // 建立 REST 客戶端來與 Discord API 互動
    const rest = new REST({ version: '10' }).setToken(config.TOKEN || process.env.TOKEN);

    try {
        console.log(`\n${colors.cyan}[ COMMANDS ]${colors.reset} ${colors.green}Started refreshing ${commandsToDeploy.length} application (/) commands.`);

        // ***重要：選擇你的指令部署方式***
        // 選項 1 (已取消註解): 部署到特定伺服器 (適合開發和測試，更新速度快)
        // 確保你的 config.js 中有 GUILD_ID，並將 'YOUR_GUILD_ID' 替換為實際的伺服器 ID
        const data = await rest.put(
            Routes.applicationGuildCommands(client.user.id, config.GUILD_ID), // 使用 GUILD_ID 部署到特定伺服器
            { body: commandsToDeploy },
        );

        // 選項 2 (已註解): 部署為全域指令 (適合生產環境，在所有伺服器可用，但更新需要時間)
        // 如果選擇全域部署，請註解掉上面的 Routes.applicationGuildCommands 那行
        // const data = await rest.put(
        //     Routes.applicationCommands(client.user.id), // 全域部署，不需要 GUILD_ID
        //     { body: commandsToDeploy },
        // );


        console.log(`${colors.cyan}[ COMMANDS ]${colors.reset} ${colors.green}Successfully reloaded ${data.length} application (/) commands.${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}[ COMMANDS ]${colors.reset} ${colors.red}Failed to load commands:${colors.reset}`, error);
    }
    // --- 指令部署邏輯結束 ---
});

fs.readdir("./events", (_err, files) => {
    files.forEach((file) => {
        if (!file.endsWith(".js")) return;
        const event = require(`./events/${file}`);
        let eventName = file.split(".")[0];
        client.on(eventName, event.bind(null, client));
        delete require.cache[require.resolve(`./events/${file}`)];
    });
});

// client.commands 用於儲存指令物件，以便在 interactionCreate 事件或前綴指令處理中執行它們
// 使用 Map 結構更利於根據指令名稱快速查找
client.commands = new Map();
fs.readdir(config.commandsDir, (err, files) => {
    if (err) throw err;
    files.forEach(async (f) => {
        try {
            if (f.endsWith(".js")) {
                let props = require(`${config.commandsDir}/${f}`);
                // 新版 SlashCommandBuilder 指令，使用 data.name
                if (props.data) {
                    client.commands.set(props.data.name, props);
                } else if (props.name) {
                    // 舊版前綴指令，使用 name
                    client.commands.set(props.name, props);
                }
            }
        } catch (err) {
            console.error(`${colors.red}[ ERROR ]${colors.reset} Failed to load command file ${f}:`, err);
        }
    });
});


client.on("raw", (d) => {
    const { GatewayDispatchEvents } = require("discord.js");
    if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
    client.riffy.updateVoiceState(d);
});

client.login(config.TOKEN || process.env.TOKEN).catch((e) => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🔐 TOKEN VERIFICATION${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ TOKEN ]${colors.reset} ${colors.red}Authentication Failed ❌${colors.reset}`);
    console.log(`${colors.gray}Error: Turn On Intents or Reset New Token${colors.reset}`);
});

connectToDatabase().then(() => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🕸️ DATABASE STATUS${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.green}MongoDB Online ✅${colors.reset}`);
}).catch((err) => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🕸️ DATABASE STATUS${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.red}Connection Failed ❌${colors.reset}`);
    console.log(`${colors.gray}Error: ${err.message}${colors.reset}`);
});

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
