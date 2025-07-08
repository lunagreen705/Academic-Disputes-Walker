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

// 建立自訂中文解析器
const customChrono = chrono.zh.casual.clone();

// 將中文時間轉換成 cron 表達式
function parseWhenToCron(whenStr) {
    const nowInTaipei = DateTime.now().setZone('Asia/Taipei').toJSDate();

    // 處理 "每天"
    if (/每天/.test(whenStr)) {
        const parsedResult = customChrono.parse(whenStr, nowInTaipei, { forwardDate: true });
        if (!parsedResult || parsedResult.length === 0) return null;
        const hour = parsedResult[0].start.get('hour');
        const minute = parsedResult[0].start.get('minute');
        return `${minute} ${hour} * * *`;
    }

    // 處理 "每週"
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

    // 處理單次時間
    const results = customChrono.parse(whenStr, nowInTaipei, { forwardDate: true });
    if (results.length === 0) return null;
    const targetDate = results[0].start.date();
    return `${targetDate.getMinutes()} ${targetDate.getHours()} ${targetDate.getDate()} ${targetDate.getMonth() + 1} *`;
}

// 設定提醒
async function handleSet(interaction, userId) {
    const { client, options } = interaction;
    await interaction.deferReply({ ephemeral: true });

    const message = options.getString('message');
    const whenStr = options.getString('when');
    const isRecurring = /每天|每週|每星期/.test(whenStr);
    const cronExpression = parseWhenToCron(whenStr);

    if (!cronExpression) {
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
        ...( !isRecurring && { occurrence_count: 1, executedCount: 0 } ) // 非循環任務預設執行一次
    };

    const success = await schedulerManager.addOrUpdateTask(client, client.taskActionFunctions, taskConfig);

    if (success) {
        const successEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ 提醒設定成功！')
            .setDescription(`我將會透過私訊提醒您。${!isRecurring ? '\n\n**此提醒將在執行一次後自動刪除。**' : ''}`);
        await interaction.editReply({ embeds: [successEmbed] });
    } else {
        await interaction.editReply({ content: '❌ 操作失敗，請稍後再試。' });
    }
}

// 列出所有提醒
async function handleList(interaction, userId) {
    const userTasks = schedulerManager.getTasksByUserId(userId);

    if (userTasks.length === 0) {
        return interaction.reply({ content: 'ℹ️ 您目前沒有設定任何個人提醒。', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setAuthor({ name: `${interaction.user.username} 的個人提醒` })
        .setDescription('以下是您設定的所有排程提醒。');

    userTasks.forEach(task => {
        let occurrenceInfo = '';
        if (task.occurrence_count) {
            occurrenceInfo = ` (已執行 ${task.executedCount || 0}/${task.occurrence_count} 次)`;
        } else if (task.end_date) {
            occurrenceInfo = ` (結束於 ${task.end_date})`;
        }

        embed.addFields({
            name: `${task.enabled ? '🟢' : '🔴'} ${task.name}`,
            value: `ID: \`${task.id}\`\n排程: \`${task.cronExpression}\`${occurrenceInfo}`,
        });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 刪除、啟用/暫停、編輯提醒的共用處理函式
async function handleInteractiveMenu(interaction, userId, action) {
    const userTasks = schedulerManager.getTasksByUserId(userId);
    const actionVerb = { delete: '刪除', toggle: '切換啟用/暫停', edit: '編輯' };

    if (userTasks.length === 0) {
        return interaction.reply({ content: `ℹ️ 您目前沒有可${actionVerb[action]}的提醒。`, ephemeral: true });
    }

    // ✨【核心修改處】✨
    const options = userTasks.map(task => {
        // 優先使用 task.name，若無則從 args.message 提取提醒內容
        let displayLabel = task.name;
        if (task.args?.message) {
            displayLabel = task.args.message
                .replace('⏰ **排程提醒**：\n\n>>> ', '')
                .split('\n')[0]; // 只取第一行，避免過長
        }
        // 確保標籤長度不超過 Discord 限制
        if (displayLabel.length > 100) {
            displayLabel = displayLabel.substring(0, 97) + '...';
        }

        return {
            label: displayLabel,
            description: `排程: ${task.cronExpression}`, // 描述改為顯示排程時間
            value: task.id, // value 必須是唯一的 ID
            emoji: task.enabled ? '🟢' : '🔴',
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${action}-task-menu:${userId}`)
        .setPlaceholder(`請選擇要${actionVerb[action]}的提醒...`)
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.reply({ content: `請從下方選單選擇您想${actionVerb[action]}的提醒：`, components: [row], ephemeral: true });
}

// 下拉選單互動處理
async function handleSelectMenu(client, interaction, actionType, userIdFromCustomId) {
    if (interaction.user.id !== userIdFromCustomId) {
        return interaction.reply({ content: '❌ 您無權操作此提醒。', ephemeral: true });
    }
    const selectedTaskId = interaction.values?.[0];
    if (!selectedTaskId) {
        return interaction.reply({ content: '❌ 您未選擇任何提醒。', ephemeral: true });
    }
    const userTasks = schedulerManager.getTasksByUserId(userIdFromCustomId);
    const currentTask = userTasks.find(t => t.id === selectedTaskId);
    if (!currentTask) {
        return interaction.reply({ content: '❌ 找不到該提醒。', ephemeral: true });
    }

    if (actionType === 'edit-task-menu') {
        const modal = new ModalBuilder()
            .setCustomId(`edit-task-modal:${selectedTaskId}:${userIdFromCustomId}`)
            .setTitle(`編輯提醒: ${currentTask.name}`);
        const msgInput = new TextInputBuilder()
            .setCustomId('editMessageInput')
            .setLabel('新的提醒內容')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue(currentTask.args.message.replace('⏰ **排程提醒**：\n\n>>> ', ''));
        const whenInput = new TextInputBuilder()
            .setCustomId('editWhenInput')
            .setLabel('新的提醒時間 (留空表示不變)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false) // 改為非必要，允許只改內容
            .setPlaceholder('例如: 明天早上9點, 每週五20:00');
        modal.addComponents(
            new ActionRowBuilder().addComponents(msgInput),
            new ActionRowBuilder().addComponents(whenInput)
        );
        return interaction.showModal(modal);
    }

    await interaction.deferReply({ ephemeral: true });

    if (actionType === 'delete-task-menu') {
        const success = await schedulerManager.deleteTask(client, client.taskActionFunctions, selectedTaskId, userIdFromCustomId);
        const msg = success ? '✅ 提醒已成功刪除。' : '❌ 操作失敗，找不到提醒或您無權刪除。';
        return interaction.editReply({ content: msg });
    }

    if (actionType === 'toggle-task-menu') {
        const newEnabled = !currentTask.enabled;
        const success = await schedulerManager.addOrUpdateTask(client, client.taskActionFunctions, {
            ...currentTask,
            enabled: newEnabled,
        });
        const msg = success ? `✅ 提醒已成功${newEnabled ? '啟用' : '暫停'}。` : '❌ 操作失敗，請稍後再試。';
        return interaction.editReply({ content: msg });
    }
    
    return interaction.editReply({ content: '❌ 未知的提醒操作。' });
}

// Modal 提交處理
async function handleModalSubmit(client, interaction, actionType, taskId, userIdFromCustomId) {
    if (interaction.user.id !== userIdFromCustomId) {
        return interaction.reply({ content: '❌ 您無權操作此提醒。', ephemeral: true });
    }
    
    await interaction.deferReply({ ephemeral: true });

    const currentTask = schedulerManager.getTasksByUserId(userIdFromCustomId).find(task => task.id === taskId);
    if (!currentTask) {
        return interaction.editReply({ content: '❌ 找不到要編輯的提醒。' });
    }

    const newMessage = interaction.fields.getTextInputValue('editMessageInput');
    const newWhenStr = interaction.fields.getTextInputValue('editWhenInput');
    let newCronExpression = currentTask.cronExpression; // 預設為舊時間
    let isRecurring = !currentTask.occurrence_count;

    // 只有在使用者輸入了新時間時才進行解析
    if (newWhenStr) {
        newCronExpression = parseWhenToCron(newWhenStr);
        if (!newCronExpression) {
            return interaction.editReply({
                content: '❌ 無法理解您輸入的新時間格式。\n請試試看：`10分鐘後`, `明天早上9點`, `每天晚上10:30` 或 `每週五 20:00`',
            });
        }
        isRecurring = /每天|每週|每星期/.test(newWhenStr);
    }

    const updatedTaskConfig = {
        ...currentTask,
        name: newMessage.length > 30 ? newMessage.substring(0, 27) + '...' : newMessage,
        cronExpression: newCronExpression,
        args: { message: `⏰ **排程提醒**：\n\n>>> ${newMessage}` },
    };

    // 根據是否循環來更新執行次數設定
    if (isRecurring) {
        delete updatedTaskConfig.occurrence_count;
        delete updatedTaskConfig.executedCount;
    } else {
        updatedTaskConfig.occurrence_count = 1;
        updatedTaskConfig.executedCount = 0;
    }

    const success = await schedulerManager.addOrUpdateTask(client, client.taskActionFunctions, updatedTaskConfig);

    if (success) {
        const successEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ 提醒編輯成功！')
            .setDescription(`提醒 \`${taskId}\` 已更新。${!isRecurring ? '\n\n**此提醒將在執行一次後自動刪除。**' : ''}`);
        await interaction.editReply({ embeds: [successEmbed] });
    } else {
        await interaction.editReply({ content: '❌ 編輯失敗，請稍後再試。' });
    }
}

// 指令主體
module.exports = {
    name: "task",
    description: "設定管理個人排程提醒",
    permissions: "0x0000000000000800",
    options: [
        { name: 'set', description: '設定個人提醒', type: 1, options: [ { name: 'message', description: '提醒內容', type: 3, required: true }, { name: 'when', description: '什麼時候提醒？例如: "明天早上9點", "10分鐘後"', type: 3, required: true } ] },
        { name: 'list', description: '列出所有提醒', type: 1 },
        { name: 'delete', description: '刪除提醒', type: 1 },
        { name: 'toggle', description: '暫停或啟用提醒', type: 1 },
        { name: 'edit', description: '編輯提醒', type: 1 }
    ],
    async run(client, interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user } = interaction;
        const handler = {
            'set': () => handleSet(interaction, user.id),
            'list': () => handleList(interaction, user.id),
            'delete': () => handleInteractiveMenu(interaction, user.id, 'delete'),
            'toggle': () => handleInteractiveMenu(interaction, user.id, 'toggle'),
            'edit': () => handleInteractiveMenu(interaction, user.id, 'edit'),
        }[subcommand];

        if (handler) {
            await handler();
        } else {
            await interaction.reply({ content: '❌ 未知的子指令。', ephemeral: true });
        }
    },
    handleSelectMenu,
    handleModalSubmit,
};