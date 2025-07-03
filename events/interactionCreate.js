const config = require("../config.js");
const { InteractionType } = require("discord.js");
const path = require("path");

module.exports = async (client, interaction) => {
  try {
    if (!interaction?.guild) {
      return interaction?.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      }).catch(() => {}); // 加上 catch 以防萬一
    }

    // 語言檔案載入
    const languageFile = path.join(__dirname, `../languages/${config.language}.js`);
    const lang = require(languageFile);

    // 處理按鈕互動
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // 將 "library|" 開頭的按鈕轉交給 library 指令的 handleButton 處理
      if (customId.startsWith("library|")) {
        const libraryCommand = client.commands.find(cmd => cmd.name === "library");
        if (libraryCommand && typeof libraryCommand.handleButton === "function") {
          try {
            await libraryCommand.handleButton(interaction);
          } catch (e) {
            console.error(`❌ library handleButton 在 interactionCreate 中發生錯誤: ${e.stack || e}`);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: "❌ 處理按鈕時發生嚴重錯誤", ephemeral: true }).catch(console.error);
            } else {
              await interaction.editReply({ content: "❌ 處理按鈕時發生嚴重錯誤", embeds: [], components: [] }).catch(console.error);
            }
          }
        } else {
          console.error(`[ERROR] Library command or handleButton not found for customId: ${customId}`);
          await interaction.reply({ content: "❌ 找不到按鈕處理程式", ephemeral: true }).catch(console.error);
        }
        return;
      } else {
        console.warn(`[WARN] Unhandled button interaction with customId: ${customId}`);
        await interaction.reply({ content: "❌ 未識別的按鈕操作", ephemeral: true }).catch(console.error);
        return;
      }
    }

    // 自動補全（Autocomplete）處理
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      const command = client.commands.find(cmd => cmd.name === interaction.commandName);
      if (command && typeof command.autocomplete === "function") {
        try {
          await command.autocomplete(interaction);
        } catch (e) {
          console.error("❌ Autocomplete 發生錯誤:", e);
        }
      }
      return;
    }

    // Slash 指令處理
    if (interaction.type === InteractionType.ApplicationCommand) {
      const command = client.commands.find(cmd => cmd.name === interaction.commandName);
      if (!command) {
        return interaction.reply({ content: "找不到此指令", ephemeral: true });
      }

      try {
        const hasPermission = interaction?.member?.permissions?.has(command?.permissions || "0x0000000000000800"); // 預設檢查 "SEND_MESSAGES" 權限
        if (!hasPermission) {
          return interaction.reply({ content: lang.errors.noPermission, ephemeral: true });
        }
        // 執行指令檔中的 run 函式
        await command.run(client, interaction, lang);
      } catch (e) {
        console.error(`❌ 指令執行錯誤: ${e.stack || e}`);

        // 【關鍵修正】根據互動狀態決定使用 editReply 還是 reply，防止崩潰
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({
            content: lang.errors.generalError.replace("{error}", e.message),
            embeds: [],
            components: [],
          });
        } else {
          return interaction.reply({
            content: lang.errors.generalError.replace("{error}", e.message),
            ephemeral: true,
          });
        }
      }
    }
  } catch (e) {
    console.error("❌ 總處理器發生嚴重錯誤:", e.stack || e);
  }
};
