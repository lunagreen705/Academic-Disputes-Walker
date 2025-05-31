const { SlashCommandBuilder, EmbedBuilder } = require('discord.js'); // 引入 SlashCommandBuilder
const config = require("../config.js"); // 假設你需要 config 檔案

module.exports = {
    data: new SlashCommandBuilder() // 使用 SlashCommandBuilder 來定義指令
        .setName("rd") // 指令名稱
        .setDescription("擲一個指定面數的骰子。") // 指令的簡短描述
        .addIntegerOption(option => // 加入一個整數輸入框作為選項
            option.setName('sides') // 選項的內部名稱 (在程式碼中使用)
                .setDescription('骰子的面數 (1-10000)') // 選項在 Discord 中顯示的描述
                .setRequired(true) // 設定為必填選項
                .setMinValue(1) // 設定輸入的最小值
                .setMaxValue(10000)), // 設定輸入的最大值
    permissions: "0x0000000000000800", // 這裡你可以根據你的需求設定權限

    // 指令的執行部分，當用戶使用 /rd 指令時會運行這裡的程式碼
    run: async (client, interaction, lang) => {
        try {
            // 從 interaction 的參數中直接獲取整數，Discord.js 會自動處理
            const numSides = interaction.options.getInteger('sides');

            // 由於在 SlashCommandBuilder 中已設定 min/max 值，
            // 這裡的額外檢查在正常情況下是不必要的，但作為保險可以保留。
            if (numSides <= 0 || numSides > 10000) {
                return interaction.reply({
                    content: '請輸入一個 1 到 10000 之間的有效數字作為骰子面數。',
                    ephemeral: true // 只有指令使用者看得到這條回覆
                });
            }

            // 擲骰子邏輯
            const roll = Math.floor(Math.random() * numSides) + 1;

            // 回覆結果給用戶
            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#0099ff') // 使用 config.embedColor 或預設值
                .setTitle(`🎲 擲骰結果 (d${numSides})`)
                .setDescription(`你擲出了：**${roll}**`);

            await interaction.reply({ embeds: [embed] });

        } catch (e) {
            console.error('執行 /rd 指令時發生錯誤:', e);
            await interaction.reply({
                content: '執行指令時發生錯誤。請稍後再試。',
                ephemeral: true
            });
        }
    },
};
