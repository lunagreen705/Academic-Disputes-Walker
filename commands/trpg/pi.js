const sc = require('../../utils/trpgManager/cocManager/sc.js');
const { EmbedBuilder } = require('discord.js');
const config = require('../../config.js');
module.exports = {
    name: "pi",
    description: "抽一個恐懼症狀，用於角色恐懼與驚嚇時的描寫。",
    permissions: "0x0000000000000800",
    options: [],

    run: async (client, interaction, lang) => {
        try {
            const result = sc.handlePhobiaCommand();

            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#7289DA')
                .setTitle('😱 恐懼症狀')
                .setDescription(result)
                .setFooter({ text: '請描寫角色的恐懼反應與影響。' });

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('執行 /pi 指令錯誤：', err);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ 系統錯誤')
                .setDescription('無法抽取恐懼症狀，請稍後再試。');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};