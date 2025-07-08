// commands/normal/task.js 
const { 
    EmbedBuilder, 
    StringSelectMenuBuilder, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const schedulerManager = require('../../utils/normal/schedulerManager'); 
const config = require("../../config.js");
const chrono = require('chrono-node');
const { DateTime } = require('luxon');
const { randomUUID } = require('crypto');

// --- 時間解析相關函式 (保持不變) ---
const customChrono = chrono.zh.casual.clone();
function parseWhenToCron(whenStr) {
    // ... 您的時間解析邏輯完全不需要修改 ...
    const nowInTaipei = DateTime.now().setZone('Asia/Taipei').toJSDate();
    if (/每天/.test(whenStr)) {
        const parsedResult = customChrono.parse(whenStr, nowInTaipei, { forwardDate: true });
        if (!parsedResult || parsedResult.length === 0) return null;
        const hour = parsedResult[0].start.get('hour');
        const minute = parsedResult[0].start.get('minute');
        return `${minute} ${hour} * * *`;
    }
    const weeklyMatch = whenStr.match(/每(週|星期)([一二三四五六日])/);
    if (weeklyMatch) {
        const dayOfWeekMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
        const dayOfWeek = dayOfWeekMap[weeklyMatch[2]];
        const parsedResult = customChrono.parse(whenStr, nowInTaipei, { forwardDate: true });
        if (!parsedResult || parsedResult.length === 0) return null;
        const hour = parsedResult[0].start.get('hour');
        const minute = parsedResult[0].start.get('minute');
        return `${minute} ${hour} * * ${dayOfWeek}`;
    }
    const results = customChrono.parse(whenStr, nowInTaipei, { forwardDate: true });
    if (results.length === 0) return null;
    const targetDate = results[0].start.date();
    return `${targetDate.getMinutes()} ${targetDate.getHours()} ${targetDate.getDate()} ${targetDate.getMonth() + 1} *`;
}


// --- 子指令處理函式 (已修改) ---

async function handleSet(interaction, userId) {
    // ✅ 移除 deferReply，因為 interactionCreate.js 會處理
    const { client, options } = interaction;
    const message = options.getString('message');
    const whenStr = options.getString('when');
    const isRecurring = /每天|每週|每星期/.test(whenStr);
    const cronExpression = parseWhenToCron(whenStr);

    if (!cronExpression) {
        // ✅ 將 followUp 改為 editReply
        return interaction.editReply({ 
            content: '❌ 無法理解您輸入的時間格式。\n請試試看：`10分鐘後`, `明天早上9點`, `每天晚上10:30` 或 `每週五 20:00`',
        });
    }

    const taskConfig = {
        id: randomUUID().slice(0, 8),
        name: message.length > 30 ? message.substring(0, 27) + '...' : message,
        cronExpression: cronExpression,
        action: 'sendDirectMessage',
        enabled: true,
        timezone: 'Asia/Taipei',
        userId: userId,
        args: { message: `⏰ **排程提醒**：\n\n>>> ${message}` },
        // 使用三元運算子簡化
        occurrence_count: isRecurring ? undefined : 1,
    };

    const success = await schedulerManager.addOrUpdateTask(client, client.taskActionFunctions, taskConfig);
    
    if (success) {
        const successEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ 提醒設定成功！')
            .setDescription(`學術糾紛將會透過私訊提醒您。${!isRecurring ? '\n\n**此提醒將在執行一次後自動刪除。**' : ''}`);
        // ✅ 將 followUp 改為 editReply
        await interaction.editReply({ embeds: [successEmbed] });
    } else {
        // ✅ 將 followUp 改為 editReply
        await interaction.editReply({ content: '❌ 操作失敗，請稍後再試。' });
    }
}

async function handleList(interaction, userId) {
    const userTasks = schedulerManager.getTasksByUserId(userId); 

    if (userTasks.length === 0) {
        // ✅ 將 reply 改為 editReply
        return interaction.editReply({ content: 'ℹ️ 您目前沒有設定任何個人提醒。' });
    }

    const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setAuthor({ name: `${interaction.user.username} 的個人提醒` })
        .setDescription('以下是您設定的所有排程提醒。');

    userTasks.forEach(task => {
        // ... (addFields 邏輯不變) ...
        let occurrenceInfo = '';
        if (typeof task.occurrence_count === 'number' && task.occurrence_count > 0) {
            const executed = typeof task.executedCount === 'number' ? task.executedCount : 0;
            occurrenceInfo = ` (已執行 ${executed}/${task.occurrence_count} 次)`;
        } else if (task.end_date) {
            occurrenceInfo = ` (結束日期: ${task.end_date})`;
        }
        embed.addFields({
            name: `${task.enabled ? '🟢' : '🔴'} ${task.name}`,
            value: `ID: \`${task.id}\`\n排程: \`${task.cronExpression}\`${occurrenceInfo}`,
        });
    });

    // ✅ 將 reply 改為 editReply
    await interaction.editReply({ embeds: [embed] });
}

// 共用的互動選單產生函式 (已修改)
async function handleInteractiveMenu(interaction, userId, action) {
    const userTasks = schedulerManager.getTasksByUserId(userId);
    if (userTasks.length === 0) {
        // ✅ 將 reply 改為 editReply
        return interaction.editReply({ content: `ℹ️ 您目前沒有可${action === 'delete' ? '刪除' : action === 'toggle' ? '切換啟用/暫停' : '編輯'}的提醒。` });
    }

    const actionVerb = { delete: '刪除', toggle: '切換啟用/暫停', edit: '編輯' };
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${action}-task-menu:${userId}`)
        .setPlaceholder(`請選擇要${actionVerb[action]}的提醒...`)
        .addOptions(userTasks.map(task => ({
            label: task.name.substring(0, 100),
            description: `ID: ${task.id}`,
            value: task.id,
            emoji: task.enabled ? '🟢' : '🔴'
        })));

    const row = new ActionRowBuilder().addComponents(selectMenu);
    // ✅ 將 reply 改為 editReply
    await interaction.editReply({ content: `請從下方選單選擇您想${actionVerb[action]}的提醒：`, components: [row] });
}

// 觸發選單的函式 (保持不變)
async function handleDelete(interaction, userId) { await handleInteractiveMenu(interaction, userId, 'delete'); }
async function handleToggle(interaction, userId) { await handleInteractiveMenu(interaction, userId, 'toggle'); }
async function handleEdit(interaction, userId) { await handleInteractiveMenu(interaction, userId, 'edit'); }


// --- 元件互動處理函式 (已修改) ---

async function handleSelectMenu(client, interaction, lang) {
    // ✅ 移除本地的 deferUpdate，因為 interactionCreate.js 會處理
    const [actionType, userIdFromCustomId] = interaction.customId.split(':');

    if (interaction.user.id !== userIdFromCustomId) {
        // deferUpdate 後不能 editReply，只能 followUp 一個臨時訊息
        return interaction.followUp({ content: '❌ 您無權操作此提醒。', ephemeral: true });
    }

    const selectedTaskId = interaction.values?.[0];
    if (!selectedTaskId) {
        // ✅ 使用 update 更新原始訊息，告知操作已取消
        return interaction.update({ content: '❌ 您未選擇任何提醒，操作已取消。', components: [] });
    }

    const currentTask = schedulerManager.getTasksByUserId(userIdFromCustomId).find(t => t.id === selectedTaskId);
    if (!currentTask) {
        return interaction.update({ content: '❌ 找不到該提醒，可能已被刪除。', components: [] });
    }

    if (actionType === 'delete-task-menu') {
        const success = await schedulerManager.deleteTask(client, client.taskActionFunctions, selectedTaskId, userIdFromCustomId);
        const msg = success ? `✅ 提醒 \`${selectedTaskId}\` 已成功刪除。` : `❌ 操作失敗。`;
        // ✅ 使用 update 更新原始訊息
        return interaction.update({ content: msg, components: [] });
    }

    if (actionType === 'toggle-task-menu') {
        const newEnabled = !currentTask.enabled;
        const success = await schedulerManager.addOrUpdateTask(client, client.taskActionFunctions, { ...currentTask, enabled: newEnabled });
        const msg = success ? `✅ 提醒 \`${selectedTaskId}\` 已成功${newEnabled ? '啟用' : '暫停'}。` : `❌ 操作失敗。`;
        // ✅ 使用 update 更新原始訊息
        return interaction.update({ content: msg, components: [] });
    }

    if (actionType === 'edit-task-menu') {
        const modal = new ModalBuilder()
            .setCustomId(`edit-task-modal:${selectedTaskId}:${userIdFromCustomId}`)
            .setTitle(`編輯提醒: ${currentTask.name}`);
        
        const msgInput = new TextInputBuilder().setCustomId('editMessageInput').setLabel('新的提醒內容').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(currentTask.args.message.replace('⏰ **排程提醒**：\n\n>>> ', ''));
        const whenInput = new TextInputBuilder().setCustomId('editWhenInput').setLabel('新的提醒時間').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('例如: 明天早上9點, 每週五20:00');
        
        modal.addComponents(new ActionRowBuilder().addComponents(msgInput), new ActionRowBuilder().addComponents(whenInput));
        
        // ✅ showModal 本身就是一種回覆，這是正確的，予以保留
        return interaction.showModal(modal);
    }
}

async function handleModalSubmit(client, interaction, lang) {
    // ✅ 移除 deferReply，因為 interactionCreate.js 會處理
    const [actionType, taskId, userIdFromCustomId] = interaction.customId.split(':');

    if (interaction.user.id !== userIdFromCustomId) {
        return interaction.editReply({ content: '❌ 您無權操作此提醒。' });
    }

    if (actionType === 'edit-task-modal') {
        const newMessage = interaction.fields.getTextInputValue('editMessageInput');
        const newWhenStr = interaction.fields.getTextInputValue('editWhenInput');
        const currentTask = schedulerManager.getTasksByUserId(userIdFromCustomId).find(task => task.id === taskId);
        
        if (!currentTask) {
            return interaction.editReply({ content: '❌ 找不到要編輯的提醒。' });
        }

        const newCronExpression = parseWhenToCron(newWhenStr);
        if (!newCronExpression) {
            return interaction.editReply({ content: '❌ 無法理解您輸入的新時間格式。' });
        }
        
        const isRecurring = /每天|每週|每星期/.test(newWhenStr);
        const updatedTaskConfig = {
            ...currentTask,
            name: newMessage.length > 30 ? newMessage.substring(0, 27) + '...' : newMessage,
            cronExpression: newCronExpression,
            args: { message: `⏰ **排程提醒**：\n\n>>> ${newMessage}` },
        };
        // 條件式地處理 occurrence_count
        if (isRecurring) delete updatedTaskConfig.occurrence_count;
        else updatedTaskConfig.occurrence_count = 1;

        const success = await schedulerManager.addOrUpdateTask(client, client.taskActionFunctions, updatedTaskConfig);

        if (success) {
            const successEmbed = new EmbedBuilder().setColor('#57F287').setTitle('✅ 提醒編輯成功！').setDescription(`提醒 \`${taskId}\` 已更新。${!isRecurring ? '\n\n**此提醒將在執行一次後自動刪除。**' : ''}`);
            await interaction.editReply({ embeds: [successEmbed] });
        } else {
            await interaction.editReply({ content: '❌ 編輯失敗，請稍後再試。' });
        }
    } else {
        await interaction.editReply({ content: '❌ 未知的 Modal 提交操作。' });
    }
}


// --- 指令主體 (已修改) ---

async function run(client, interaction, lang) {
    // ✅ 移除本地的 try/catch，讓錯誤交給 interactionCreate.js 統一處理
    const subcommand = interaction.options.getSubcommand();
    const { user } = interaction;

    switch (subcommand) {
        case 'set': await handleSet(interaction, user.id); break;
        case 'list': await handleList(interaction, user.id); break;
        case 'delete': await handleDelete(interaction, user.id); break;
        case 'toggle': await handleToggle(interaction, user.id); break;
        case 'edit': await handleEdit(interaction, user.id); break;
        default:
            // ✅ 這裡使用 editReply
            await interaction.editReply({ content: '❌ 未知的子指令。' });
    }
}

module.exports = {
    name: "task",
    description: "設定或管理您的個人排程提醒",
    permissions: "0x0000000000000800",
    options: [
        {
            name: 'set',
            description: '設定一個簡單的個人提醒',
            type: 1,
            options: [
                { name: 'message', description: '您想要提醒的內容', type: 3, required: true },
                { name: 'when', description: '什麼時候提醒您？例如: "明天早上9點", "10分鐘後", "每週三 20:30"', type: 3, required: true },
            ]
        },
        {
            name: 'list',
            description: '列出您設定的所有提醒',
            type: 1,
        },
        {
            name: 'delete',
            description: '刪除您的一個提醒 (使用互動式選單)', 
            type: 1,
            options: []
        },
        {
            name: 'toggle',
            description: '暫停或啟用一個提醒',
            type: 1,
        },
        {
            name: 'edit',
            description: '編輯一個現有的提醒',
            type: 1,
        }
    ],
    run,
    handleSelectMenu,
    handleModalSubmit,
};