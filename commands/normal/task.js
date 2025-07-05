const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const schedulerManager = require('../../utils/normal/schedulerManager'); 
const config = require("../../config.js");
const chrono = require('chrono-node');
const { DateTime } = require('luxon');
const { randomUUID } = require('crypto');

// 在模組頂層建立，供所有函式重複使用，提升效能
const customChrono = chrono.zh.casual.clone();

function parseWhenToCron(whenStr) {
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

async function handleSet(interaction, userId) {
    const { client, options } = interaction;
    await interaction.deferReply({ ephemeral: true });

    const message = options.getString('message');
    const whenStr = options.getString('when');

    let isRecurring = false;
    if (whenStr.includes('每天') || whenStr.includes('每週') || whenStr.includes('每星期')) {
        isRecurring = true;
    }

    const cronExpression = parseWhenToCron(whenStr);

    if (!cronExpression) {
        return interaction.followUp({ 
            content: '❌ 無法理解您輸入的時間格式。\n請試試看：`10分鐘後`, `明天早上9點`, `每天晚上10:30` 或 `每週五 20:00`',
            ephemeral: true
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
        args: { message: `⏰ **排程提醒**：\n\n>>> ${message}` }
    };

    if (!isRecurring) {
        taskConfig.occurrence_count = 1;
    }

    const success = await schedulerManager.addOrUpdateTask(client, client.taskActionFunctions, taskConfig);
    
    if (success) {
        const successEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ 提醒設定成功！')
            .setDescription(`學術糾紛將會透過私訊提醒您。${!isRecurring ? '\n\n**此提醒將在執行一次後自動刪除。**' : ''}`);
        await interaction.followUp({ embeds: [successEmbed], ephemeral: true });
    } else {
        await interaction.followUp({ content: '❌ 操作失敗，請稍後再試。', ephemeral: true });
    }
}

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

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDelete(interaction, userId) {
    await handleInteractiveMenu(interaction, userId, 'delete');
}

async function handleToggle(interaction, userId) {
    await handleInteractiveMenu(interaction, userId, 'toggle');
}

async function handleEdit(interaction, userId) {
    await handleInteractiveMenu(interaction, userId, 'edit');
}

async function handleInteractiveMenu(interaction, userId, action) {
    const userTasks = schedulerManager.getTasksByUserId(userId);
    if (userTasks.length === 0) {
        return interaction.reply({ content: `ℹ️ 您目前沒有可${action === 'delete' ? '刪除' : action === 'toggle' ? '切換啟用/暫停' : '編輯'}的提醒。`, ephemeral: true });
    }

    const actionVerb = { delete: '刪除', toggle: '切換啟用/暫停', edit: '編輯' };

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${action}-task-menu:${userId}`)
        .setPlaceholder(`請選擇要${actionVerb[action]}的提醒...`)
        .addOptions(
            userTasks.map(task => ({
                label: task.name.substring(0, 100),
                description: `ID: ${task.id}`,
                value: task.id,
                emoji: task.enabled ? '🟢' : '🔴'
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.reply({ content: `請從下方選單選擇您想${actionVerb[action]}的提醒：`, components: [row], ephemeral: true });
}

// --- 模組導出 (單一 module.exports 物件，包含所有指令屬性和函式) ---
module.exports = {
    name: "task",
    description: "設定或管理您的個人排程提醒",
    permissions: "0x0000000000000800",
    options: [
        {
            name: 'set',
            description: '設定一個簡單的個人提醒',
            type: 1, // SUB_COMMAND
            options: [
                { name: 'message', description: '您想要提醒的內容', type: 3, required: true },
                { 
                    name: 'when', 
                    description: '什麼時候提醒您？例如: "明天早上9點", "10分鐘後", "每週三 20:30"', 
                    type: 3, 
                    required: true 
                },
            ]
        },
        {
            name: 'list',
            description: '列出您設定的所有提醒',
            type: 1, // SUB_COMMAND
        },
        {
            name: 'delete',
            description: '刪除您的一個提醒 (使用互動式選單)', 
            type: 1, // SUB_COMMAND
            options: [] // 沒有子選項，直接觸發選單
        },
        {
            name: 'toggle',
            description: '暫停或啟用一個提醒',
            type: 1, // SUB_COMMAND
        },
        {
            name: 'edit',
            description: '編輯一個現有的提醒',
            type: 1, // SUB_COMMAND
        }
    ],

    // 指令主執行函式
    run: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();
        const { user } = interaction;

        try {
            switch (subcommand) {
                case 'set':
                    await handleSet(interaction, user.id);
                    break;
                case 'list':
                    await handleList(interaction, user.id);
                    break;
                case 'delete':
                    await handleDelete(interaction, user.id);
                    break;
                case 'toggle':
                    await handleInteractiveMenu(interaction, user.id, subcommand);
                    break;
                case 'edit': 
                    await handleInteractiveMenu(interaction, user.id, subcommand);
                    break;
            }
        } catch (e) {
            console.error("[Task Command Error]", e);
            const errorReply = { content: "執行指令時發生未預期的錯誤。", ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorReply).catch(() => {});
            } else {
                await interaction.reply(errorReply).catch(() => {});
            }
        }
    },

    // 這個是處理 interactionCreate 事件中，下拉選單互動的函式
    handleSelectMenu: async (client, interaction, actionType, userIdFromCustomId) => {
        const selectedTaskId = interaction.values[0];

        if (interaction.user.id !== userIdFromCustomId) {
            // 注意：這裡直接 reply，因為 handleSelectMenu 可能在 deferUpdate 之後或之前被呼叫。
            // 為了避免 InteractionAlreadyReplied，我們應該檢查互動是否已被回覆或延遲。
            if (interaction.deferred || interaction.replied) {
                return interaction.followUp({ content: '❌ 您無權操作此提醒。', ephemeral: true });
            } else {
                return interaction.reply({ content: '❌ 您無權操作此提醒。', ephemeral: true });
            }
        }

        // 重要：只有當 actionType 不是 'edit-task-menu' 時，才在這裡 deferUpdate
        // 因為 'edit-task-menu' 將直接使用 showModal 作為回覆，而不能預先 deferUpdate
        if (actionType !== 'edit-task-menu') {
            await interaction.deferUpdate(); 
        }

        switch (actionType) {
            case 'delete-task-menu':
                const deleteSuccess = await schedulerManager.deleteTask(client, client.taskActionFunctions, selectedTaskId, userIdFromCustomId);
                await interaction.followUp({ content: deleteSuccess ? `✅ 提醒 \`${selectedTaskId}\` 已成功刪除。` : `❌ 操作失敗，找不到該提醒或您無權刪除。`, ephemeral: true });
                break;

            case 'toggle-task-menu':
                const currentTask = schedulerManager.getTasksByUserId(userIdFromCustomId).find(task => task.id === selectedTaskId);
                if (currentTask) {
                    const newEnabledState = !currentTask.enabled;
                    const toggleSuccess = await schedulerManager.addOrUpdateTask(client, client.taskActionFunctions, {
                        ...currentTask,
                        enabled: newEnabledState
                    });
                    await interaction.followUp({ content: toggleSuccess ? `✅ 提醒 \`${selectedTaskId}\` 已成功${newEnabledState ? '啟用' : '暫停'}。` : `❌ 操作失敗。`, ephemeral: true });
                } else {
                    await interaction.followUp({ content: '❌ 找不到該提醒。', ephemeral: true });
                }
                break;

            case 'edit-task-menu':
                // 不需要再次 require，因為這些類別已經在檔案開頭引入
                // const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                const taskToEdit = schedulerManager.getTasksByUserId(userIdFromCustomId).find(task => task.id === selectedTaskId);

                if (!taskToEdit) {
                    // 如果找不到任務，由於 interactionCreate.js 可能沒有 deferUpdate，這裡可以直接 reply
                    // 或根據 interaction.deferred / interaction.replied 判斷
                    if (interaction.deferred || interaction.replied) {
                        return interaction.followUp({ content: '❌ 找不到要編輯的提醒。', ephemeral: true });
                    } else {
                        return interaction.reply({ content: '❌ 找不到要編輯的提醒。', ephemeral: true });
                    }
                }

                const modal = new ModalBuilder()
                    .setCustomId(`edit-task-modal:${selectedTaskId}:${userIdFromCustomId}`)
                    .setTitle(`編輯提醒: ${taskToEdit.name}`);

                const messageInput = new TextInputBuilder()
                    .setCustomId('editMessageInput')
                    .setLabel('新的提醒內容')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setValue(taskToEdit.args.message.replace('⏰ **排程提醒**：\n\n>>> ', '')); 

                const whenInput = new TextInputBuilder()
                    .setCustomId('editWhenInput')
                    .setLabel('新的提醒時間 (例如: 明天早上9點)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('例如: 明天早上9點, 每天20:30, 10分鐘後'); 

                const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
                const secondActionRow = new ActionRowBuilder().addComponents(whenInput);

                modal.addComponents(firstActionRow, secondActionRow);

                await interaction.showModal(modal); 
                break;

            default:
                // 如果是其他未知的操作，由於 interactionCreate.js 已經 deferUpdate，這裡使用 followUp
                await interaction.followUp({ content: '❌ 未知的提醒操作。', ephemeral: true });
                break;
        }
    },

    // 這個是處理 interactionCreate 事件中，Modal 提交的函式
    handleModalSubmit: async (client, interaction, actionType, taskId, userIdFromCustomId) => {
        if (interaction.user.id !== userIdFromCustomId) {
            return interaction.reply({ content: '❌ 您無權操作此提醒。', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true }); // 延遲回覆，因為處理可能需要時間

        if (actionType === 'edit-task-modal') {
            const newMessage = interaction.fields.getTextInputValue('editMessageInput');
            const newWhenStr = interaction.fields.getTextInputValue('editWhenInput');

            const currentTask = schedulerManager.getTasksByUserId(userIdFromCustomId).find(task => task.id === taskId);
            if (!currentTask) {
                return interaction.followUp({ content: '❌ 找不到要編輯的提醒。', ephemeral: true });
            }

            let isRecurring = false;
            if (newWhenStr.includes('每天') || newWhenStr.includes('每週') || newWhenStr.includes('每星期')) {
                isRecurring = true;
            }

            const newCronExpression = parseWhenToCron(newWhenStr);

            if (!newCronExpression) {
                return interaction.followUp({ 
                    content: '❌ 無法理解您輸入的新時間格式。\n請試試看：`10分鐘後`, `明天早上9點`, `每天晚上10:30` 或 `每週五 20:00`',
                    ephemeral: true
                });
            }

            const updatedTaskConfig = {
                ...currentTask, // 保留原任務的其他屬性
                name: newMessage.length > 30 ? newMessage.substring(0, 27) + '...' : newMessage,
                cronExpression: newCronExpression,
                args: { message: `⏰ **排程提醒**：\n\n>>> ${newMessage}` }
            };

            // 如果從重複變為非重複，或從非重複變為重複，調整 occurrence_count
            if (!isRecurring && currentTask.occurrence_count !== 1) {
                updatedTaskConfig.occurrence_count = 1;
            } else if (isRecurring && currentTask.occurrence_count === 1) {
                // 如果從一次性變為重複，移除 occurrence_count，讓它無限重複
                delete updatedTaskConfig.occurrence_count;
            }
            // 如果都是重複，或都是一次性，則保持不變

            const success = await schedulerManager.addOrUpdateTask(client, client.taskActionFunctions, updatedTaskConfig);

            if (success) {
                const successEmbed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('✅ 提醒編輯成功！')
                    .setDescription(`提醒 \`${taskId}\` 已更新。${!isRecurring ? '\n\n**此提醒將在執行一次後自動刪除。**' : ''}`);
                await interaction.followUp({ embeds: [successEmbed], ephemeral: true });
            } else {
                await interaction.followUp({ content: '❌ 編輯失敗，請稍後再試。', ephemeral: true });
            }
        } else {
            await interaction.followUp({ content: '❌ 未知的 Modal 提交操作。', ephemeral: true });
        }
    }
};