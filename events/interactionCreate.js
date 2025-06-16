const config = require("../config.js");
const { InteractionType } = require("discord.js");
const path = require("path");

module.exports = async (client, interaction) => {
  try {
    if (!interaction?.guild) {
      return interaction?.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
    }

    const languageFile = path.join(__dirname, `../languages/${config.language}.js`);
    const lang = require(languageFile);

    // ✅ 處理按鈕互動（如 library 分頁）
    if (interaction.isButton?.() || interaction.type === InteractionType.MessageComponent) {
      const customId = interaction.customId;

      // 處理 library 指令的分頁按鈕
      if (customId.startsWith("library_")) {
        const libraryCommand = client.commands.find(cmd => cmd.name === "library");
        if (libraryCommand && typeof libraryCommand.handleButton === "function") {
          try {
            await libraryCommand.handleButton(interaction);
          } catch (e) {
            console.error("❌ library handleButton 發生錯誤:", e);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: "❌ 處理按鈕時出錯", ephemeral: true });
            }
          }
        }
        return;
      }

      // 👇 可在此處擴充更多按鈕 prefix，如 confirm_, paginator_ 等
    }

    // ✅ 自動補全（Autocomplete）
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

    // ✅ Slash 指令處理
    if (interaction.type === InteractionType.ApplicationCommand) {
      const command = client.commands.find(cmd => cmd.name === interaction.commandName);
      if (!command) {
        return interaction.reply({ content: "找不到此指令", ephemeral: true });
      }

      try {
        const hasPermission = interaction?.member?.permissions?.has(command?.permissions || "0x0000000000000800");
        if (!hasPermission) {
          return interaction.reply({ content: lang.errors.noPermission, ephemeral: true });
        }

        await command.run(client, interaction, lang);
      } catch (e) {
        console.error(`❌ 指令執行錯誤: ${e}`);
        return interaction.reply({
          content: lang.errors.generalError.replace("{error}", e.message),
          ephemeral: true,
        });
      }
    }
  } catch (e) {
    console.error("❌ 總處理器錯誤:", e);
  }
};