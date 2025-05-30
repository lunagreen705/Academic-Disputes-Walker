const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rd') // 指令名稱設定為 'rd'
        .setDescription('擲一個指定面數的骰子 (例如: /rd 100 擲百分骰)。')
        .addIntegerOption(option =>
            option.setName('sides') // 選項名稱為 'sides'
                .setDescription('骰子的面數 (例如: 20, 100)')
                .setRequired(true)), // 必須指定面數

    async execute(interaction) {
        const numSides = interaction.options.getInteger('sides'); // 獲取用戶輸入的面數

        // 錯誤處理與限制
        if (numSides <= 0 || numSides > 1000) { // 限制骰子面數，避免過大或無意義的數字
            return interaction.reply({ content: '請輸入一個有效的骰子面數 (1 到 1000 之間)。', ephemeral: true });
        }

        // 執行擲骰
        const roll = Math.floor(Math.random() * numSides) + 1;

        // 建立回覆訊息
        let replyMessage = `你擲出了一個 **d${numSides}** 骰子：\n`;
        replyMessage += `結果是：**${roll}** 🎲`; // 增加骰子表情符號

        await interaction.reply(replyMessage);
    },
};
