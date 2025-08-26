// logManager.js 
const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

let trpgSessionLogCollection;
let trpgLogStateCollection;
let dbConnected = false;
const guildCache = new Map();

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

function getTimestamp() { return new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }); }

async function getGuildLogData(guildId) {
    if (guildCache.has(guildId)) return guildCache.get(guildId);
    if (dbConnected) {
        const state = await trpgLogStateCollection.findOne({ guildId });
        const guildData = {
            currentLogName: state?.currentLogName || null,
            isLogging: state?.isLogging || false,
        };
        guildCache.set(guildId, guildData);
        return guildData;
    }
    const tempData = { currentLogName: null, isLogging: false };
    guildCache.set(guildId, tempData);
    return tempData;
}

async function handleLogCommand(source, args) {
    if (!dbConnected) {
        return source.interaction.reply({ content: "⚠️ 資料庫未連接，日誌功能目前無法使用。", ephemeral: true });
    }

    await source.interaction.deferReply({ ephemeral: true });

    const command = args[0] || 'help';
    const logName = args[1] || null;

    try {
        switch (command) {
            case 'new': await handleNew(source, logName); break;
            case 'on': await handleOn(source, logName); break;
            case 'off': await handleOff(source); break;
            case 'halt': await handleHalt(source, false); break;
            case 'end': await handleHalt(source, true); break;
            case 'list': await handleList(source); break;
            case 'get': await handleGet(source, logName); break;
            case 'del': await handleDel(source, logName); break;
            case 'stat': await handleStat(source, logName); break;
            case 'export': await handleExport(source, logName); break;
            default: await source.interaction.editReply({ content: '❓ 無效的 `log` 子指令。', ephemeral: true }); break;
        }
    } catch (error) {
        console.error(`[LOG MODULE ERROR] Command: ${command}, Error:`, error);
        if (source.interaction && !source.interaction.replied) {
             await source.interaction.editReply({ content: `執行指令時發生未預期的錯誤: ${error.message}`, ephemeral: true }).catch(console.error);
        }
    }
}

// --- 子指令處理函數 (全部修正) ---

async function handleNew(source, logName) {
    const guildId = source.guild.id;
    if (!logName) return source.interaction.editReply({ content: '❌ 請提供新日誌的名稱。', ephemeral: true });

    const guildData = await getGuildLogData(guildId);
    if (guildData.currentLogName) return source.interaction.editReply({ content: `❌ 無法建立，因為正在處理日誌 \`${guildData.currentLogName}\`。`, ephemeral: true });
    
    const existingLog = await trpgSessionLogCollection.findOne({ guildId, logName });
    if (existingLog) return source.interaction.editReply({ content: `❌ 名為 \`${logName}\` 的日誌已存在。`, ephemeral: true });

    // ... 資料庫操作 ...
    await trpgSessionLogCollection.insertOne({ guildId, logName, content: `--- 日誌開始於 ${getTimestamp()} ---\n\n`, rendererLink: null, createdAt: new Date() });
    await trpgLogStateCollection.updateOne({ guildId }, { $set: { currentLogName: logName, isLogging: true } }, { upsert: true });
    guildData.currentLogName = logName;
    guildData.isLogging = true;
    
    const publicEmbed = new EmbedBuilder().setColor('Green').setTitle('✅ 日誌建立成功').setDescription(`已建立並開始記錄新日誌： **${logName}**`);
    await source.channel.send({ embeds: [publicEmbed] });
    
    await source.interaction.editReply({ content: '指令執行完畢。', ephemeral: true });
}

async function handleOn(source, logName) {
    const guildId = source.guild.id;
    const guildData = await getGuildLogData(guildId);
    const targetLogName = logName || guildData.currentLogName;

    if (!targetLogName) return source.interaction.editReply({ content: '❌ 沒有可以繼續的日誌。請使用 `/log on log-name:<日誌名>`。', ephemeral: true });
    if (guildData.isLogging && guildData.currentLogName === targetLogName) return source.interaction.editReply({ content: `▶️ 日誌 \`${targetLogName}\` 已經在記錄中了。`, ephemeral: true });

    const logToOn = await trpgSessionLogCollection.findOne({ guildId, logName: targetLogName });
    if (!logToOn) return source.interaction.editReply({ content: `❌ 找不到名為 \`${targetLogName}\` 的日誌。`, ephemeral: true });
    
    await trpgLogStateCollection.updateOne({ guildId }, { $set: { currentLogName: targetLogName, isLogging: true } }, { upsert: true });
    guildData.currentLogName = targetLogName;
    guildData.isLogging = true;

    const publicEmbed = new EmbedBuilder().setColor('Green').setTitle('▶️ 繼續記錄').setDescription(`已繼續記錄日誌： **${targetLogName}**`);
    await source.channel.send({ embeds: [publicEmbed] });
    await source.interaction.editReply({ content: '指令執行完畢。', ephemeral: true });
}

async function handleOff(source) {
    const guildId = source.guild.id;
    const guildData = await getGuildLogData(guildId);

    if (!guildData.currentLogName || !guildData.isLogging) return source.interaction.editReply({ content: '❌ 目前沒有正在記錄的日誌可以暫停。', ephemeral: true });

    await trpgLogStateCollection.updateOne({ guildId }, { $set: { isLogging: false } });
    guildData.isLogging = false;

    const publicEmbed = new EmbedBuilder().setColor('Grey').setTitle('⏸️ 記錄已暫停').setDescription(`已暫停記錄日誌： **${guildData.currentLogName}**\n使用 \`/log on\` 可繼續。`);
    await source.channel.send({ embeds: [publicEmbed] });
    await source.interaction.editReply({ content: '指令執行完畢。', ephemeral: true });
}

async function handleHalt(source, generateLink) {
    const guildId = source.guild.id;
    const guildData = await getGuildLogData(guildId);
    const logNameToHalt = guildData.currentLogName;

    if (!logNameToHalt) return source.interaction.editReply({ content: '❌ 沒有可以停止的當前日誌。', ephemeral: true });
    
    const logData = await trpgSessionLogCollection.findOne({ guildId, logName: logNameToHalt });
    const finalContent = (logData.content || '') + `\n\n--- 日誌結束於 ${getTimestamp()} ---`;

    let publicEmbed;
    if (generateLink) {
        const link = `https://logtrpg.lovable.app${guildId}/${Date.now()}`;
        await trpgSessionLogCollection.updateOne({ guildId, logName: logNameToHalt }, { $set: { content: finalContent, rendererLink: link } });
        publicEmbed = new EmbedBuilder().setColor('Gold').setTitle('🔚 日誌已停止並上傳').setDescription(`日誌 **${logNameToHalt}** 已停止記錄。`).addFields({ name: '渲染器連結', value: `[點此查看](${link})` });
    } else {
        await trpgSessionLogCollection.updateOne({ guildId, logName: logNameToHalt }, { $set: { content: finalContent } });
        publicEmbed = new EmbedBuilder().setColor('Orange').setTitle('⏹️ 日誌已停止').setDescription(`日誌 **${logNameToHalt}** 已停止記錄。`);
    }
    
    await trpgLogStateCollection.updateOne({ guildId }, { $set: { currentLogName: null, isLogging: false } });
    guildData.currentLogName = null;
    guildData.isLogging = false;

    await source.channel.send({ embeds: [publicEmbed] });
    await source.interaction.editReply({ content: '指令執行完畢。', ephemeral: true });
}

async function handleList(source) {
    const guildId = source.guild.id;
    const guildData = await getGuildLogData(guildId);
    const logs = await trpgSessionLogCollection.find({ guildId }).sort({ createdAt: -1 }).toArray();

    if (logs.length === 0) return source.interaction.editReply({ content: '本伺服器還沒有任何日誌記錄。', ephemeral: true });

    let description = logs.map(log => {
        let status = '';
        if (log.logName === guildData.currentLogName) {
            status = guildData.isLogging ? ' (🔴 記錄中)' : ' (⏸️ 已暫停)';
        }
        return `• ${log.logName}${status}`;
    }).join('\n');

    const embed = new EmbedBuilder().setColor('Blue').setTitle('本群的日誌列表').setDescription(description || '無');
    await source.interaction.editReply({ embeds: [embed], ephemeral: true });
}

async function handleGet(source, logName) {
    if (!logName) return source.interaction.editReply({ content: '❌ 請提供要獲取連結的日誌名稱。', ephemeral: true });
    
    const logData = await trpgSessionLogCollection.findOne({ guildId: source.guild.id, logName });
    if (!logData) return source.interaction.editReply({ content: `❌ 找不到名為 \`${logName}\` 的日誌。`, ephemeral: true });
    if (!logData.rendererLink) return source.interaction.editReply({ content: `⚠️ 日誌 \`${logName}\` 沒有可用的渲染器連結。`, ephemeral: true });

    await source.interaction.editReply({ content: `這是日誌 \`${logName}\` 的渲染器連結：\n${logData.rendererLink}`, ephemeral: true });
}

async function handleDel(source, logName) {
    const guildId = source.guild.id;
    if (!logName) return source.interaction.editReply({ content: '❌ 請提供要刪除的日誌名稱。', ephemeral: true });

    const guildData = await getGuildLogData(guildId);
    if (logName === guildData.currentLogName) return source.interaction.editReply({ content: `❌ 無法刪除正在使用中的日誌。請先結束它。`, ephemeral: true });

    const result = await trpgSessionLogCollection.deleteOne({ guildId, logName });
    if (result.deletedCount === 0) return source.interaction.editReply({ content: `❌ 找不到名為 \`${logName}\` 的日誌。`, ephemeral: true });

    await source.interaction.editReply({ content: `🗑️ 日誌 \`${logName}\` 已被成功刪除。`, ephemeral: true });
}

async function handleStat(source, logName) {
    const guildId = source.guild.id;
    const guildData = await getGuildLogData(guildId);
    const logNameToStat = logName || guildData.currentLogName;

    if (!logNameToStat) return source.interaction.editReply({ content: '請指定要統計的日誌，或確保有一個正在處理的當前日誌。', ephemeral: true });
    
    const logData = await trpgSessionLogCollection.findOne({ guildId, logName: logNameToStat });
    if (!logData) return source.interaction.editReply({ content: `❌ 找不到名為 \`${logNameToStat}\` 的日誌。`, ephemeral: true });
    
    const successCount = (logData.content.match(/成功/g) || []).length;
    const failureCount = (logData.content.match(/失敗/g) || []).length;

    const embed = new EmbedBuilder().setColor('Purple').setTitle(`📊 日誌統計: ${logNameToStat}`).addFields(
        { name: '成功檢定', value: `${successCount} 次`, inline: true },
        { name: '失敗檢定', value: `${failureCount} 次`, inline: true }
    );
    await source.interaction.editReply({ embeds: [embed], ephemeral: true });
}

async function handleExport(source, logName) {
    if (!logName) return source.interaction.editReply({ content: '❌ 請提供要匯出的日誌名稱。', ephemeral: true });

    const guildId = source.guild.id;
    const logData = await trpgSessionLogCollection.findOne({ guildId, logName });
    if (!logData) return source.interaction.editReply({ content: `❌ 找不到名為 \`${logName}\` 的日誌。`, ephemeral: true });

    const parsedEntries = [];
    const regex = /\[(.*?)\]\s(.*?):\n([\s\S]*?)(?=\n\n\[|$)/g;
    let match;
    while ((match = regex.exec(logData.content)) !== null) {
        parsedEntries.push({ timestamp: match[1].trim(), nickname: match[2].trim(), text: match[3].trim() });
    }

    if (parsedEntries.length === 0) return source.interaction.editReply({ content: `⚠️ 日誌 \`${logName}\` 中沒有可供匯出的對話內容。`, ephemeral: true });

    const docChildren = [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: `日誌匯出: ${logName}`, bold: true })] }),
        new Paragraph({ text: `匯出時間: ${getTimestamp()}`, style: "IntenseQuote" }),
    ];
    parsedEntries.forEach(entry => {
        docChildren.push(new Paragraph({ children: [ new TextRun({ text: `[${entry.timestamp}] `, color: "999999" }), new TextRun({ text: `${entry.nickname}:`, bold: true }) ], spacing: { before: 200 } }));
        entry.text.split('\n').forEach(line => { docChildren.push(new Paragraph({ text: line, indent: { left: 720 } })); });
    });
    const doc = new Document({ sections: [{ properties: {}, children: docChildren }] });
    const buffer = await Packer.toBuffer(doc);
    const attachment = new AttachmentBuilder(buffer, { name: `${logName.replace(/ /g, '_')}.docx` });
    
    const successEmbed = new EmbedBuilder().setColor('Green').setTitle('📄 日誌匯出成功').setDescription(`您的日誌 **${logName}** 已成功匯出為 .docx 檔案。`);
    
    await source.channel.send({ embeds: [successEmbed], files: [attachment] });
    await source.interaction.editReply({ content: '匯出檔案已傳送至頻道。', ephemeral: true });
}

async function recordMessage(message) {
    if (!dbConnected || !message.guild) return;
    const guildId = message.guild.id;
    const guildData = await getGuildLogData(guildId);

    if (!guildData.isLogging || !guildData.currentLogName) return;
    
    const log = guildCache.get(guildId);
    if (typeof log.currentLogContent !== 'string') {
        const dbLog = await trpgSessionLogCollection.findOne({ guildId, logName: log.currentLogName });
        log.currentLogContent = dbLog ? dbLog.content : '';
    }

    const timestamp = getTimestamp();
    const authorName = message.member ? message.member.displayName : message.author.username;
    let logEntry = `[${timestamp}] ${authorName}:\n${message.content}\n\n`;
    
    log.currentLogContent += logEntry;


    // 每次記錄後都更新
    await trpgSessionLogCollection.updateOne(
        { guildId, logName: log.currentLogName },
        { $set: { content: log.currentLogContent } }
    );
}

module.exports = {
    initialize,
    handleLogCommand,
    recordMessage,
};