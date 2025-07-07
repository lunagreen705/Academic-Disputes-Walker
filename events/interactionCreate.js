const config = require("../config.js");
const { InteractionType } = require("discord.js");
const path = require("path");

module.exports = async (client, interaction) => {
  try {
    if (!interaction?.guild) {
      return interaction?.reply({
        content: "This command can only be used in a server.", // 考慮多語言支援
        ephemeral: true,
      }).catch(() => {});
    }

    const languageFile = path.join(__dirname, `../languages/${config.language}.js`);
    const lang = require(languageFile);

    // 處理按鈕互動
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // 【修正點 1】處理 'open-edit-modal' 按鈕互動 (這個按鈕會彈出 Modal)
      if (customId.startsWith('open-edit-modal:')) {
          // 這個互動將直接彈出 Modal，所以這裡不需要 deferUpdate 或 deferReply
          const parts = customId.split(':');
          if (parts.length < 3) { // 檢查格式是否正確 open-edit-modal:taskId:userId
              console.error(`[ERROR] Invalid customId format for open-edit-modal button: ${customId}`);
              return interaction.reply({ content: lang.errors.unknownButton, ephemeral: true }).catch(console.error);
          }
          const taskId = parts[1];
          const userIdFromCustomId = parts[2];

          const taskCommand = client.commands.get('task');
          if (taskCommand && typeof taskCommand.handleModalTriggerButton === "function") {
              try {
                  // 這個函式會直接呼叫 interaction.showModal()
                  await taskCommand.handleModalTriggerButton(interaction, taskId, userIdFromCustomId);
              } catch (e) {
                  console.error(`❌ taskModalTriggerButton 在 interactionCreate 中發生錯誤: ${e.stack || e}`);
                  // 如果這裡發生錯誤，且 interaction 尚未被回覆，就回覆錯誤訊息
                  if (!interaction.replied && !interaction.deferred) {
                      await interaction.reply({ content: lang.errors.generalError.replace("{error}", e.message), ephemeral: true }).catch(console.error);
                  } else {
                      // 否則，表示可能已經回覆過，嘗試 followUp
                      await interaction.followUp({ content: lang.errors.generalError.replace("{error}", e.message), ephemeral: true }).catch(console.error);
                  }
              }
          } else {
              console.error(`[ERROR] Task command or handleModalTriggerButton not found for customId: ${customId}`);
              // 同樣，確保回覆方式正確
              if (!interaction.replied && !interaction.deferred) {
                  await interaction.reply({ content: lang.errors.buttonHandlerNotFound, ephemeral: true }).catch(console.error);
              } else {
                  await interaction.followUp({ content: lang.errors.buttonHandlerNotFound, ephemeral: true }).catch(console.error);
              }
          }
          return;
      }

      // 【修正點 2】對於其他所有按鈕互動，統一 deferUpdate
      await interaction.deferUpdate().catch(() => {}); 

      if (customId.startsWith("library|")) {
        const libraryCommand = client.commands.get("library"); 
        if (libraryCommand && typeof libraryCommand.handleButton === "function") {
          try {
            await libraryCommand.handleButton(interaction);
          } catch (e) {
            console.error(`❌ library handleButton 在 interactionCreate 中發生錯誤: ${e.stack || e}`);
            await interaction.followUp({ content: lang.errors.generalButtonError, ephemeral: true }).catch(console.error);
          }
        } else {
          console.error(`[ERROR] Library command or handleButton not found for customId: ${customId}`);
          await interaction.followUp({ content: lang.errors.buttonHandlerNotFound, ephemeral: true }).catch(console.error);
        }
        return;
      } else {
        console.warn(`[WARN] Unhandled button interaction with customId: ${customId}`);
        await interaction.followUp({ content: lang.errors.unknownButton, ephemeral: true }).catch(console.error);
        return;
      }
    }
// =================================================================
//                      【排程處理 - 下拉選單】
// =================================================================
     if (interaction.isStringSelectMenu()) {
      // ✨【修正】✨ 移除這一行通用的 deferUpdate。
      // 讓每個指令的 handleSelectMenu 函式自己決定何時以及如何回應。
      // await interaction.deferUpdate().catch(() => {}); // <--- 刪除或註解掉此行

      const customId = interaction.customId;

      // 1. 優先處理塔羅牌的選單
      if (customId === 'tarot_spread_select') {
        const tarotCommand = client.commands.get('塔羅'); 
        if (tarotCommand && typeof tarotCommand.handleSelectMenu === "function") {
          try {
            // 現在 tarot.js 裡的 handleSelectMenu 將會是第一次回應，不再有衝突
            await tarotCommand.handleSelectMenu(client, interaction, lang);
          } catch (e) {
            console.error(`❌ tarot 選單處理錯誤: ${e.stack || e}`);
            await interaction.followUp({ content: lang.errors.generalSelectMenuError, ephemeral: true }).catch(console.error);
          }
        } else {
          console.error(`[ERROR] 找不到 tarot 指令或 handleSelectMenu 函式`);
          await interaction.followUp({ content: lang.errors.selectMenuHandlerNotFound, ephemeral: true }).catch(console.error);
        }
        return; // 處理完畢
      }
      
      // 2. 接著處理 task 相關的選單
      const parts = customId.split(':');
      const actionType = parts[0];
      const userIdFromCustomId = parts[1];

      if (['delete-task-menu', 'toggle-task-menu', 'edit-task-menu'].includes(actionType)) {
        const taskCommand = client.commands.get('task');
        if (taskCommand && typeof taskCommand.handleSelectMenu === "function") {
          try {
            await taskCommand.handleSelectMenu(client, interaction, actionType, userIdFromCustomId);
          } catch (e) {
            console.error(`❌ task 選單處理錯誤: ${e.stack || e}`);
            await interaction.followUp({ content: lang.errors.generalSelectMenuError, ephemeral: true }).catch(console.error);
          }
        } else {
          console.error(`[ERROR] 找不到 task 指令或 handleSelectMenu 函式`);
          await interaction.followUp({ content: lang.errors.selectMenuHandlerNotFound, ephemeral: true }).catch(console.error);
        }
        return; // 處理完畢
      }

      // 3. 如果有其他未知的選單
      console.warn(`[WARN] 未處理的下拉選單互動: ${customId}`);
      await interaction.followUp({ content: lang.errors.unknownSelectMenu, ephemeral: true }).catch(console.error);
      return;
    }
// =================================================================
//                      【Modal 提交處理】
// =================================================================
else if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    // 【修正點 5】更正 Modal customId 的解析方式，確保 taskId 和 userId 正確提取
    const parts = customId.split(':');
    if (parts.length < 3) { // 檢查格式 edit-task-modal:taskId:userId
        console.error(`[ERROR] Invalid customId format for modal submit: ${customId}`);
        await interaction.reply({ content: lang.errors.unknownModal, ephemeral: true }).catch(console.error); // Modal 提交後如果錯了可以直接 reply
        return;
    }
    const actionType = parts[0];
    const taskId = parts[1];
    const userIdFromCustomId = parts[2];

    // 【修正點 6】統一 deferReply，因為 Modal 提交通常需要後續處理
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    if (actionType.startsWith('edit-task-modal')) {
        const taskCommand = client.commands.get('task');
        if (taskCommand && typeof taskCommand.handleModalSubmit === "function") {
            try {
                await taskCommand.handleModalSubmit(client, interaction, actionType, taskId, userIdFromCustomId);
            } catch (e) {
                console.error(`❌ task Modal 處理函數在 interactionCreate 中發生錯誤: ${e.stack || e}`);
                await interaction.followUp({ content: lang.errors.generalError.replace("{error}", e.message), ephemeral: true }).catch(console.error);
            }
        } else {
            console.error(`[ERROR] Task command or handleModalSubmit not found for customId: ${customId}`);
            await interaction.followUp({ content: lang.errors.modalHandlerNotFound, ephemeral: true }).catch(console.error);
        }
        return;
    } else {
        console.warn(`[WARN] Unhandled modal submit interaction with customId: ${customId}`);
        await interaction.followUp({ content: lang.errors.unknownModal, ephemeral: true }).catch(console.error);
        return;
    }
}
// ... (Autocomplete 和 Slash 指令處理部分保持不變)

    // 自動補全（Autocomplete）處理
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      const command = client.commands.get(interaction.commandName);
      if (command && typeof command.autocomplete === "function") {
        try {
          await command.autocomplete(interaction); // Autocomplete 必須直接回覆
        } catch (e) {
          console.error("❌ Autocomplete 發生錯誤:", e);
        }
      }
      return;
    }

    // Slash 指令處理
    if (interaction.type === InteractionType.ApplicationCommand) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: lang.errors.commandNotFound, ephemeral: true });
      }

      try {
        const defaultPermissions = '0x0000000000000800'; 
        const requiredPermissions = command.permissions || defaultPermissions;

        const hasPermission = interaction?.member?.permissions?.has(requiredPermissions); 
        if (!hasPermission) {
          return interaction.reply({ content: lang.errors.noPermission, ephemeral: true });
        }
        await command.run(client, interaction, lang);
      } catch (e) {
        console.error(`❌ 指令執行錯誤: ${e.stack || e}`);

        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({
            content: lang.errors.generalError.replace("{error}", e.message),
            embeds: [],
            components: [],
          }).catch(console.error);
        } else {
          return interaction.reply({
            content: lang.errors.generalError.replace("{error}", e.message),
            ephemeral: true,
          }).catch(console.error);
        }
      }
    }
  } catch (e) {
    console.error("❌ 總處理器發生嚴重錯誤:", e.stack || e);
  }
};