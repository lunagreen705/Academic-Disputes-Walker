const sc = require('../../utils/trpgManager/cocManager/sc.js');
const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: "ti",
    description: "抽一個即時症狀，用於角色臨場反應與精神狀態描寫。",
    permissions: "0x0000000000000800",
    options: [],

    run: async (client, interaction, lang) => {
        try {
            const result = sc.handleTICommand();

            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#7289DA')
                .setTitle('🎭 即時症狀')
                .setDescription(result)
                .setFooter({ text: '請於 1D10 輪內進行角色描寫與影響。' });

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('執行 /ti 指令錯誤：', err);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ 系統錯誤')
                .setDescription('無法抽取即時症狀，請稍後再試。');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};