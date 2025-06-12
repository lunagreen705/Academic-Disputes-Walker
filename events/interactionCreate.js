// modules/event_handlers/interactionCreate.js
// 注意：這個文件應該是作為一個模組被引入並在主文件（例如 index.js 或 bot.js）中調用

const config = require("../config.js");
const { InteractionType } = require('discord.js');
const fs = require("fs"); // 可能不再需要在這裡直接使用 fs
const path = require("path");

module.exports = async (client, interaction) => {
  try {
    if (!interaction?.guild) {
      return interaction?.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    const languageFile = path.join(__dirname, `../languages/${config.language}.js`);
    const lang = require(languageFile);

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
          ephemeral: true
        });
      }
    }
  } catch (e) {
    console.error("❌ 總處理器錯誤:", e);
  }
};