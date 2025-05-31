// your-discord-bot/commands/draw.js
const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const config = require("../config.js");
const deckManager = require('../utils/deckManager'); // 引入牌堆管理模組

module.exports = {
    name: "draw",
    description: "從指定的牌堆中抽取一個項目 (食物、語錄、塔羅)。",
    permissions: "0x0000000000000800",

    options: [
        {
            name: 'deck', // 輸入框名稱
            description: '選擇要抽取的牌堆',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [ // 提供選項讓用戶選擇
                { name: '食物', value: 'foods' },
                { name: '語錄', value: 'quotes' },
                { name: '塔羅', value: 'tarot' }
            ]
        }
    ],

    run: async (client, interaction, lang) => {
        try {
            const deckName = interaction.options.getString('deck');
            let drawnItem = deckManager.drawFromDeck(deckName);

            if (!drawnItem) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ 錯誤')
                    .setDescription(`找不到牌堆 "${deckName}" 或它目前是空的。`);
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            let embedTitle = `✨ 抽取結果：${deckName} 牌堆`;
            let embedDescription = '';

            // 根據抽取到的項目類型來格式化輸出
            if (typeof drawnItem === 'object' && drawnItem.name && drawnItem.meaning) {
                // 如果是塔羅牌這樣的物件 (帶有 name 和 meaning 屬性)
                embedDescription = `抽到牌面：**${drawnItem.name}**\n\n**牌義：** ${drawnItem.meaning}`;
                embedTitle = `🔮 塔羅牌抽取：${drawnItem.name}`;
            } else {
                // 如果是字串（食物或語錄）
                embedDescription = `你抽到了：**${drawnItem}**`;
            }

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
