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
        // 【修正點 1】處理按鈕互動時，立即延遲更新，避免超時
        await interaction.deferUpdate().catch(() => {}); // 使用 deferUpdate 因為是組件互動

      const customId = interaction.customId;

      if (customId.startsWith("library|")) {
        const libraryCommand = client.commands.get("library"); 
        if (libraryCommand && typeof libraryCommand.handleButton === "function") {
          try {
            await libraryCommand.handleButton(interaction);
          } catch (e) {
            console.error(`❌ library handleButton 在 interactionCreate 中發生錯誤: ${e.stack || e}`);
            // 由於已 deferUpdate，這裡應使用 followUp 或 editReply
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
//                      【排程處理】
// =================================================================
else if (interaction.isStringSelectMenu()) {
    const customId = interaction.customId;
    const [actionType, menuId, userId] = customId.split(':');

    // 這段邏輯旨在決定是否 deferUpdate
    if (actionType !== 'edit-task-menu') {
        await interaction.deferUpdate().catch(() => {}); // <--- 這裡會 deferUpdate
    }

    if (customId.startsWith('delete-task-menu') || customId.startsWith('toggle-task-menu') || customId.startsWith('edit-task-menu')) {
        const taskCommand = client.commands.get('task'); 
        
        if (taskCommand && typeof taskCommand.handleSelectMenu === "function") {
            try {
                await taskCommand.handleSelectMenu(client, interaction, actionType, userId); 
            } catch (e) { // <--- 如果 taskCommand.handleSelectMenu 拋出錯誤
                console.error(`❌ task 選單處理函數在 interactionCreate 中發生錯誤: ${e.stack || e}`);
                // 這裡的回覆邏輯：如果 defer 或 reply 過，就 followUp；否則就 reply。
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ content: lang.errors.generalSelectMenuError, ephemeral: true }).catch(console.error); // <--- 可能導致 InteractionNotReplied (如果你從未 defer)
                } else {
                    await interaction.reply({ content: lang.errors.generalSelectMenuError, ephemeral: true }).catch(console.error); // <--- 可能導致 InteractionAlreadyAcknowledged (如果你已經 defer 了)
                }
            }
        }
        // ...
    }
    // ...
}

    // 自動補全（Autocomplete）處理
    // Autocomplete 不需要 defer，因為它必須在 3 秒內直接回覆 options
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
        // 【修正點 3】指令處理，由指令本身的 run 函數來 deferReply
        // 此處不需要 deferReply，因為指令執行會調用 command.run，由 command.run 內部來處理 deferReply
        // 這樣可以讓指令自行決定是否需要 deferReply，以及是 ephemeral 還是 public

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