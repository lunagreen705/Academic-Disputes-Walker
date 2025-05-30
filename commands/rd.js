const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js'); // 根據需要引入

async function rdCommandLogic(client, interaction, lang) { // 指令執行邏輯
    const numSides = interaction.options.getInteger('sides'); // 注意：這裡 `interaction.options.getInteger` 仍是 Slash Command 的用法
    // ... (你的擲骰邏輯) ...
    await interaction.reply({ content: `你擲出了一個 d${numSides} 骰子：**${roll}** 🎲` });
}

module.exports = {
    name: "rd", // 直接導出 name
    description: "擲一個指定面數的骰子 (例如: /rd 100 擲百分骰)。", // 直接導出 description
    permissions: "0x0000000000000800", // 如果需要權限
    options: [ // 在舊版指令中，這個 options 欄位可能不會被 Discord 認作 Slash Command 的選項
        // 對於舊版指令，通常不會在這裡定義 Slash Command 的選項。
        // 如果你需要像 /rd 100 這樣的參數，你可能需要從 interaction.content 或 message.content 中手動解析。
        // 舊版指令通常是 !rd 100
    ],
    run: rdCommandLogic // 將邏輯賦值給 run
};
