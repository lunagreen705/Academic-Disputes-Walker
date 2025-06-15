const sc = require('../../utils/trpgManager/cocManager/sc.js');
const { EmbedBuilder } = require('discord.js');
const config = require('../../config.js');
module.exports = {
    name: "mi",
    description: "抽一個狂躁症狀，用於角色精神亢奮時的描寫。",
    permissions: "0x0000000000000800",
    options: [],

    run: async (client, interaction, lang) => {
        try {
            const result = sc.handleManiaCommand();

            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#7289DA')
                .setTitle('🤪 狂躁症狀')
                .setDescription(result)
                .setFooter({ text: '請描寫角色的狂躁狀態與行動。' });

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('執行 /mi 指令錯誤：', err);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ 系統錯誤')
                .setDescription('無法抽取狂躁症狀，請稍後再試。');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};