const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const schedulerManager = require('../../utils/normal/schedulerManager'); 
const config = require("../../config.js");
const chrono = require('chrono-node');
const { DateTime } = require('luxon');
const { randomUUID } = require('crypto');

const customChrono = chrono.zh.casual.clone();

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
      description: '刪除您的一個提醒 (使用互動式選單)', // **【已修改】描述強調使用選單**
      type: 1, // SUB_COMMAND
      options: [
        // **【已移除】不再有 'id' 輸入框**
      ]
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
            // **【已修改】直接呼叫 handleDelete，不再檢查 ID**
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
};

// ... (parseWhenToCron, handleSet, handleList 函式保持不變)

// **【已修改】handleDelete 函式：直接觸發互動式選單**
async function handleDelete(interaction, userId) {
    // 總是進入互動模式，讓使用者從選單中選擇要刪除的任務
    await handleInteractiveMenu(interaction, userId, 'delete');
}

// ... (handleToggle, handleEdit, handleInteractiveMenu 函式保持不變)

// **【已修改】module.exports.handleSelectMenu 保持不變**
// 確保這個函式包含了處理選單選擇後，刪除任務的邏輯
module.exports = {
    name: "task", // 確保這裡有 name 屬性，因為 bot.js 會用 client.commands.set(command.name, command)
    description: "設定或管理您的個人排程提醒", // 確保有 description
    options: [ /* ... */ ], // 這裡放上面的 options 陣列
    run: async (client, interaction) => { /* ... */ }, // 這裡放上面的 run 函式

    handleSelectMenu: async (client, interaction, actionType, userIdFromCustomId) => {
        // 從 customId 中提取 taskId
        const selectedTaskId = interaction.values[0];

        // 確保操作者是任務擁有者
        if (interaction.user.id !== userIdFromCustomId) {
            return interaction.reply({ content: '❌ 您無權操作此提醒。', ephemeral: true });
        }

        // 只有當 actionType 不是 'edit-task-menu' 時，才在這裡 deferUpdate
        // 因為 'edit-task-menu' 將直接使用 showModal 作為回覆，而不能預先 deferUpdate
        if (actionType !== 'edit-task-menu') {
            await interaction.deferUpdate(); // 延遲更新以避免互動超時
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
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                const taskToEdit = schedulerManager.getTasksByUserId(userIdFromCustomId).find(task => task.id === selectedTaskId);

                if (!taskToEdit) {
                    // 如果找不到任務，由於 interactionCreate.js 已經沒有 deferUpdate，這裡可以直接 reply
                    return interaction.reply({ content: '❌ 找不到要編輯的提醒。', ephemeral: true });
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

                // 【關鍵修正】直接使用 showModal 作為回覆，不再 followUp
                await interaction.showModal(modal); 
                break;

            default:
                // 如果是其他未知的操作，由於 interactionCreate.js 已經 deferUpdate，這裡使用 followUp
                await interaction.followUp({ content: '❌ 未知的提醒操作。', ephemeral: true });
                break;
        }
    }
};