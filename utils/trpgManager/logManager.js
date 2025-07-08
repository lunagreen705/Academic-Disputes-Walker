// logManager.js 
const { EmbedBuilder } = require('discord.js');

// --- 模組變數 ---
let trpgSessionLogCollection; // 儲存日誌內容
let trpgLogStateCollection; // 儲存伺服器日誌狀態
let dbConnected = false;

// 使用記憶體快取來儲存日誌狀態，避免頻繁讀寫資料庫
// 結構: Map<guildId, GuildLogData>
const guildCache = new Map();

/**
 * 初始化日誌模組，傳入資料庫集合
 * @param {object} dbCollections - 從 getCollections() 得到的物件
 */
function initialize(dbCollections) {
    if (dbCollections) {
        trpgSessionLogCollection = dbCollections.trpgSessionLogCollection;
        trpgLogStateCollection = dbCollections.trpgLogStateCollection;
        dbConnected = true;
        console.log('\x1b[36m[ LOG MODULE ]\x1b[0m', '\x1b[32mMongoDB integration enabled. ✅\x1b[0m');
    } else {
        console.warn('\x1b[33m[ WARNING ]\x1b[0m Log module running in memory-only mode. Logs will not be saved.');
    }
}

function getTimestamp() {
    return new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

/**
 * 從快取或資料庫中獲取伺服器的日誌數據
 * @param {string} guildId
 * @returns {Promise<object>}
 */
async function getGuildLogData(guildId) {
    // 優先從快取讀取
    if (guildCache.has(guildId)) {
        return guildCache.get(guildId);
    }

    // 若快取沒有，且已連接資料庫，則從資料庫載入
    if (dbConnected) {
        const state = await trpgLogStateCollection.findOne({ guildId });
        const guildData = {
            currentLogName: state ? state.currentLogName : null,
            isLogging: state ? state.isLogging : false,
            // 為了效能，日誌內容只在需要時才載入
        };
        guildCache.set(guildId, guildData);
        return guildData;
    }

    // 如果未連接資料庫，則回傳一個臨時的記憶體儲存
    const tempData = { currentLogName: null, isLogging: false };
    guildCache.set(guildId, tempData);
    return tempData;
}

/**
 * 主指令處理函數
 * @param {import('discord.js').Message} message
 * @param {string[]} args
 */
async function handleLogCommand(message, args) {
    if (!dbConnected) {
        return message.reply("⚠️ 資料庫未連接，日誌功能目前無法使用。");
    }

    const command = args[0] ? args[0].toLowerCase() : 'help';
    const logName = args.slice(1).join(' ');

    switch (command) {
        case 'new': await handleNew(message, logName); break;
        case 'on': await handleOn(message, logName); break;
        case 'off': await handleOff(message); break;
        case 'halt': await handleHalt(message, false); break;
        case 'end': await handleHalt(message, true); break;
        case 'list': await handleList(message); break;
        case 'get': await handleGet(message, logName); break;
        case 'del': await handleDel(message, logName); break;
        case 'stat': await handleStat(message, logName); break;
        default: message.reply('無效的 `log` 子指令。'); break;
    }
}

// --- 子指令處理函數 (已全部改為 async) ---

async function handleNew(message, logName) {
    const guildId = message.guild.id;
    const guildData = await getGuildLogData(guildId);

    if (!logName) return message.reply('請提供新日誌的名稱。用法: `log new <日誌名>`');
    if (guildData.currentLogName) return message.reply(`錯誤：目前正在處理日誌 \`${guildData.currentLogName}\`。請先結束它。`);

    const existingLog = await trpgSessionLogCollection.findOne({ guildId, logName });
    if (existingLog) return message.reply(`錯誤：名為 \`${logName}\` 的日誌已存在。`);

    // 1. 在資料庫中建立日誌
    const newLogContent = `--- 日誌開始於 ${getTimestamp()} ---\n\n`;
    await trpgSessionLogCollection.insertOne({
        guildId,
        logName,
        content: newLogContent,
        rendererLink: null,
        createdAt: new Date(),
    });

    // 2. 更新伺服器狀態
    await trpgLogStateCollection.updateOne(
        { guildId },
        { $set: { currentLogName: logName, isLogging: true } },
        { upsert: true }
    );

    // 3. 更新快取
    guildData.currentLogName = logName;
    guildData.isLogging = true;
    guildData.currentLogContent = newLogContent; // 將內容載入快取

    const embed = new EmbedBuilder().setColor('#00FF00').setTitle('✅ 日誌建立成功').setDescription(`已建立並開始記錄新日誌： **${logName}**`);
    message.channel.send({ embeds: [embed] });
}

async function handleHalt(message, generateLink) {
    const guildId = message.guild.id;
    const guildData = await getGuildLogData(guildId);
    const logNameToHalt = guildData.currentLogName;

    if (!logNameToHalt) return message.reply('錯誤：沒有可以停止的當前日誌。');

    // 1. 從快取獲取最終內容並更新
    const finalContent = (guildData.currentLogContent || '') + `\n\n--- 日誌結束於 ${getTimestamp()} ---`;

    // 2. 儲存到資料庫
    const updateData = { $set: { content: finalContent } };
    let link = null;
    if (generateLink) {
        link = `https://fake-seal-renderer.com/log/${guildId}/${Date.now()}`;
        updateData.$set.rendererLink = link;
    }
    await trpgSessionLogCollection.updateOne({ guildId, logName: logNameToHalt }, updateData);

    // 3. 清除伺服器狀態
    await trpgLogStateCollection.updateOne({ guildId }, { $set: { currentLogName: null, isLogging: false } });

    // 4. 清除快取
    guildData.currentLogName = null;
    guildData.isLogging = false;
    delete guildData.currentLogContent;

    if (generateLink) {
        const embed = new EmbedBuilder().setColor('#FFFF00').setTitle('⏹️ 日誌已停止並上傳').setDescription(`日誌 **${logNameToHalt}** 已停止記錄。`).addFields({ name: '渲染器連結', value: `[點此查看](${link})` });
        message.channel.send({ embeds: [embed] });
    } else {
        message.reply(`日誌 \`${logNameToHalt}\` 已停止記錄。`);
    }
}

async function handleOff(message) {
    const guildId = message.guild.id;
    const guildData = await getGuildLogData(guildId);

    if (!guildData.currentLogName || !guildData.isLogging) return message.reply('錯誤：目前沒有正在記錄的日誌可以暫停。');

    // 1. 將快取中的內容同步到資料庫
    if (guildData.currentLogContent) {
        await trpgSessionLogCollection.updateOne(
            { guildId, logName: guildData.currentLogName },
            { $set: { content: guildData.currentLogContent } }
        );
    }

    // 2. 更新伺服器狀態
    await trpgLogStateCollection.updateOne({ guildId }, { $set: { isLogging: false } });
    
    // 3. 更新快取
    guildData.isLogging = false;
    delete guildData.currentLogContent; // 從快取中清除內容，下次 on 的時候會重新載入

    message.reply(`已暫停記錄日誌 \`${guildData.currentLogName}\`。使用 \`log on\` 可繼續。`);
}

async function handleOn(message, logName) {
    const guildId = message.guild.id;
    const guildData = await getGuildLogData(guildId);

    const targetLogName = logName || guildData.currentLogName;
    if (!targetLogName) return message.reply('錯誤：沒有可以繼續的日誌。請使用 `log on <日誌名>` 或 `log new <日誌名>`。');

    if (guildData.isLogging && guildData.currentLogName === targetLogName) return message.reply(`日誌 \`${targetLogName}\` 已經在記錄中了。`);

    const logToOn = await trpgSessionLogCollection.findOne({ guildId, logName: targetLogName });
    if (!logToOn) return message.reply(`錯誤：找不到名為 \`${targetLogName}\` 的日誌。`);
    
    // 1. 更新伺服器狀態
    await trpgLogStateCollection.updateOne(
        { guildId },
        { $set: { currentLogName: targetLogName, isLogging: true } },
        { upsert: true }
    );

    // 2. 更新快取並載入日誌內容
    guildData.currentLogName = targetLogName;
    guildData.isLogging = true;
    guildData.currentLogContent = logToOn.content;

    message.reply(`已將 \`${targetLogName}\` 設定為當前日誌並開始記錄。`);
}

async function handleList(message) {
    const guildId = message.guild.id;
    const guildData = await getGuildLogData(guildId); // 確保當前狀態被載入
    const logs = await trpgSessionLogCollection.find({ guildId }).sort({ createdAt: -1 }).toArray();

    if (logs.length === 0) return message.reply('本伺服器還沒有任何日誌記錄。');

    let description = logs.map(log => {
        let status = '';
        if (log.logName === guildData.currentLogName) {
            status = guildData.isLogging ? ' (🔴 記錄中)' : ' (⏸️ 已暫停)';
        }
        return `• ${log.logName}${status}`;
    }).join('\n');

    const embed = new EmbedBuilder().setColor('#0099FF').setTitle('本群的日誌列表').setDescription(description);
    message.channel.send({ embeds: [embed] });
}

async function handleDel(message, logName) {
    const guildId = message.guild.id;
    if (!logName) return message.reply('請提供要刪除的日誌名稱。');

    const guildData = await getGuildLogData(guildId);
    if (logName === guildData.currentLogName) return message.reply(`錯誤：無法刪除正在使用中的日誌。請先結束它。`);

    const result = await trpgSessionLogCollection.deleteOne({ guildId, logName });
    if (result.deletedCount === 0) return message.reply(`錯誤：找不到名為 \`${logName}\` 的日誌。`);

    message.reply(`✅ 日誌 \`${logName}\` 已被成功刪除。`);
}

// 其他指令 (get, stat) 的實作類似，都是先查詢資料庫再回覆
async function handleGet(message, logName) { /* ... 實作同前，從 DB 查詢 ... */ }
async function handleStat(message, logName) { /* ... 實作同前，從 DB 查詢 ... */ }


/**
 * 記錄訊息的函數 (核心)
 * @param {import('discord.js').Message} message
 */
async function recordMessage(message) {
    if (!dbConnected) return;

    const guildId = message.guild.id;
    const guildData = await getGuildLogData(guildId);

    if (!guildData.isLogging || !guildData.currentLogName) {
        return;
    }

    // 如果正在記錄，但內容不在快取中（例如剛從 off -> on），則載入它
    if (!guildData.currentLogContent) {
        const log = await trpgSessionLogCollection.findOne({ guildId, logName: guildData.currentLogName });
        guildData.currentLogContent = log ? log.content : '';
    }

    const timestamp = getTimestamp();
    const authorName = message.member ? message.member.displayName : message.author.username;
    let logEntry = `[${timestamp}] ${authorName}:\n`;

    if (message.content) logEntry += `${message.content}\n`;
    if (message.embeds.length > 0) { /* ... 處理 embed ... */ }
    if (message.attachments.size > 0) { /* ... 處理附件 ... */ }

    // 將新內容附加到快取中
    guildData.currentLogContent += logEntry + '\n';
}

module.exports = {
    initialize, // <--- 新增的導出
    handleLogCommand,
    recordMessage,
};