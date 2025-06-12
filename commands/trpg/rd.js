const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const config = require("../../config.js");

module.exports = {
    // 這是舊版指令的結構，直接暴露屬性
    name: "rd", // 指令名稱
    description: "擲一個指定面數的骰子。", // 指令的簡短描述

    // permissions 屬性通常用於舊版前綴指令的權限檢查，
    // 對於斜線指令，權限應在 Discord Developer Portal 或透過程式碼中的權限覆蓋來管理。
    // 在這裡保留它是為了模仿 play.js 的結構，但它不會影響斜線指令的部署行為。
    permissions: "0x0000000000000800",

    // options 屬性在這裡定義，但這個結構不會被你的 bot.js 識別為需要部署為斜線指令的選項。
    // 如果 /rd 仍然在 Discord 中顯示輸入框，那是 Discord 記住了它過去的部署。
    options: [{
        name: 'sides',
        description: '骰子的面數 (1-10000)',
        type: ApplicationCommandOptionType.String, // 這裡使用 String，因為它會被手動解析
        required: true
    }],

    run: async (client, interaction, lang) => {
        try {
            // 注意：這裡仍然假設 interaction 是一個斜線指令互動，
            // 並且你可以使用 interaction.options.getString 來獲取選項。
            // 這是因為如果 /rd 能在 Discord 中作為斜線指令運行，
            // 那麼 Discord 會自動處理輸入並將其提供給 interaction 物件。
            const numSidesString = interaction.options.getString('sides');
            const numSides = parseInt(numSidesString, 10);

            if (isNaN(numSides) || numSides <= 0 || numSides > 10000) {
                return interaction.reply({
                    content: '請輸入一個 1 到 10000 之間的有效數字作為骰子面數。',
                    ephemeral: true
                });
            }

            const roll = Math.floor(Math.random() * numSides) + 1;

            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#0099ff')
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
