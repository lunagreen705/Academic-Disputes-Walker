const config = require("../config.js");
const { InteractionType } = require('discord.js');
const fs = require("fs");
const path = require("path");

module.exports = async (client, interaction) => {
  try {
    if (!interaction?.guild) {
      return interaction?.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    const languageFile = path.join(__dirname, `../languages/${config.language}.js`);
    const lang = require(languageFile);

    // --- 🧠 Autocomplete 支援 ---
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      try {
        const commandPath = path.join(__dirname, "..", config.commandsDir, `${interaction.commandName}.js`);
        if (fs.existsSync(commandPath)) {
          const command = require(commandPath);
          if (typeof command.autocomplete === "function") {
            await command.autocomplete(interaction);
          }
        }
      } catch (e) {
        console.error("❌ Autocomplete 發生錯誤:", e);
      }
      return; // 注意！處理完 autocomplete 要結束流程
    }

    // --- 🎯 Slash 指令處理 ---
    if (interaction.type === InteractionType.ApplicationCommand) {
      fs.readdir(path.join(__dirname, "..", config.commandsDir), (err, files) => {
        if (err) throw err;

        files.forEach(async (file) => {
          if (!file.endsWith(".js")) return;

          const command = require(path.join(__dirname, "..", config.commandsDir, file));
          if (interaction.commandName === command.name) {
            try {
              const hasPermission = interaction?.member?.permissions?.has(command?.permissions || "0x0000000000000800");
              if (!hasPermission) {
                return interaction.reply({ content: lang.errors.noPermission, ephemeral: true });
              }

              return command.run(client, interaction, lang);

            } catch (e) {
              console.error(`❌ 指令執行錯誤: ${e}`);
              return interaction.reply({
                content: lang.errors.generalError.replace("{error}", e.message),
                ephemeral: true
              });
            }
          }
        });
      });
    }

  } catch (e) {
    console.error("❌ 總處理器錯誤:", e);
  }
};
