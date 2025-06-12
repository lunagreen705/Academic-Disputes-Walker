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

        // 確保語言文件只加載一次，或者在每次互動時安全加載
        const languageFile = path.join(__dirname, `../languages/${config.language}.js`);
        const lang = require(languageFile); // 注意：每次互動都 require 可能有性能影響，但在這裡為了簡潔暫時保留。
                                           // 更優雅的做法是將語言包預加載到 client 實例中。

        // --- 🧠 Autocomplete 支援 ---
        if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
            try {
                // Autocomplete 尋找指令的方式沒問題，因為它只需找到一個
                const command = client.commands.find(cmd => cmd.name === interaction.commandName); // 從已加載的指令中查找

                if (command && typeof command.autocomplete === "function") {
                    await command.autocomplete(interaction);
                } else {
                    // 如果沒有找到對應的 autocomplete 處理器，可以選擇不回應或記錄
                    // console.log(`沒有找到 ${interaction.commandName} 的 Autocomplete 處理器`);
                }
            } catch (e) {
                console.error("❌ Autocomplete 發生錯誤:", e);
            }
            return; // 處理完 autocomplete 要結束流程
        }

        // --- 🎯 Slash 指令處理 ---
        if (interaction.type === InteractionType.ApplicationCommand) {
            // !!! 重點修改 !!!
            // 直接從 client.commands 中查找指令，而不是每次都讀取文件系統
            const command = client.commands.find(cmd => cmd.name === interaction.commandName);

            if (!command) {
                // 如果找不到指令，可能是快取問題或指令已被移除
                console.warn(`⚠️ 收到未知斜線指令: ${interaction.commandName}`);
                return interaction.reply({ content: lang.errors.unknownCommand || '未知指令或指令已過期！', ephemeral: true });
            }

            try {
                const hasPermission = interaction?.member?.permissions?.has(command?.permissions || "0x0000000000000800"); // 默認權限檢查
                if (!hasPermission) {
                    return interaction.reply({ content: lang.errors.noPermission || '你沒有足夠的權限執行此指令。', ephemeral: true });
                }

                // 確保你的指令文件導出的是 .run 方法，而不是 .execute
                await command.run(client, interaction, lang); // 注意：這裡應該使用 await

            } catch (e) {
                console.error(`❌ 執行指令 ${interaction.commandName} 時發生錯誤:`, e);
                // 向用戶回覆錯誤訊息
                await interaction.reply({
                    content: lang.errors.generalError ? lang.errors.generalError.replace("{error}", e.message) : `執行此指令時發生錯誤: ${e.message}`,
                    ephemeral: true
                });
            }
        }

    } catch (e) {
        console.error("❌ 總處理器錯誤:", e);
    }
};