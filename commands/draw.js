// your-discord-bot/commands/draw.js
const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const config = require("../config.js");
const deckManager = require('../utils/deckManager'); // 引入牌堆管理模組

// 不再需要 deckNameMap，因為我們直接顯示原始英文名稱

module.exports = {
    name: "draw",
    description: "從指定的牌堆中抽取一個項目。",
    permissions: "0x0000000000000800",

    options: [
        {
            name: 'deck', // 輸入框名稱
            description: '選擇要抽取的牌堆',
            type: ApplicationCommandOptionType.String,
            required: true,
        }
    ],

    // Discord.js v13/v14 的 slash command 支援 autocomplete 功能
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const availableDecks = deckManager.getAvailableDeckNames(); // 從 deckManager 獲取所有可用牌堆名稱

        // 直接將牌堆的英文名稱作為選項的 name 和 value
        const choices = availableDecks.map(name => ({
            name: name, // 直接使用原始英文名稱
            value: name  // value 仍然是英文檔案名
        }));

        const filtered = choices.filter(choice =>
            choice.name.toLowerCase().includes(focusedValue.toLowerCase()) // 使用 includes 讓模糊匹配更好
        );

        await interaction.respond(
            filtered.slice(0, 25) // Discord 限制最多 25 個選項
        );
    },

    run: async (client, interaction, lang) => {
        try {
            const deckName = interaction.options.getString('deck');
            let drawnItem = deckManager.drawFromDeck(deckName);

            if (!drawnItem) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ 錯誤')
                    .setDescription(`找不到牌堆 "${deckName}" 或它目前是空的。請確認你選擇了正確的牌堆。`);
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // 標題也直接使用原始英文名稱
            const embedTitle = `✨ 抽取結果：${deckName} 牌堆`;
            const embedDescription = `你抽到了：**${drawnItem}**`;

            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#0099ff')
                .setTitle(embedTitle)
                .setDescription(embedDescription);

            await interaction.reply({ embeds: [embed] });

        } catch (e) {
            console.error('執行 /draw 指令時發生錯誤:', e);
            const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ 抽取錯誤')
                    .setDescription('執行指令時發生未預期的錯誤，請稍後再試。');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};
