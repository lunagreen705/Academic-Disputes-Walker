const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js'); // 確保引入 SlashCommandBuilder
const config = require("../config.js");
const musicIcons = require('../UI/icons/musicicons.js'); // 如果這個指令不需要，可以移除

// 這是處理 /rd 指令的執行邏輯
async function rdCommandLogic(interaction) { // 這裡只需 interaction，因為它是 Slash Command
    const numSides = interaction.options.getInteger('sides'); // 從 Slash Command 選項中獲取面數

    // --- 輸入驗證與錯誤處理 ---
    if (numSides <= 0 || numSides > 10000) { // 限制骰子面數在 1 到 10000 之間
        return interaction.reply({
            content: '請輸入一個有效的骰子面數 (1 到 10000 之間)。',
            ephemeral: true // 只讓執行指令的用戶看到這條錯誤訊息
        });
    }

    // --- 執行擲骰邏輯 ---
    const roll = Math.floor(Math.random() * numSides) + 1; // 在這裡定義 roll 變數

    // --- 回覆訊息給用戶 ---
    let replyMessage = `你擲出了一個 **d${numSides}** 骰子：\n`;
    replyMessage += `結果是：**${roll}** 🎲`; // 添加骰子表情符號增加視覺效果

    await interaction.reply(replyMessage);
}

// 這是指令的定義部分，使用 SlashCommandBuilder
module.exports = {
    data: new SlashCommandBuilder()
        .setName('rd') // 指令名稱
        .setDescription('擲一個指定面數的骰子 (例如: /rd 100 擲百分骰)。')
        .addIntegerOption(option => // 為指令添加一個整數選項
            option.setName('sides') // 選項的內部名稱
                .setDescription('骰子的面數 (例如: 20, 100)')
                .setRequired(true)), // 將此選項設置為必填

    // Slash Command 的執行方法就是 execute
    async execute(interaction) {
        // 直接調用上面的邏輯函式
        await rdCommandLogic(interaction);
    },
};
