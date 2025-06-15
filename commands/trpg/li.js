const sc = require('../../utils/trpgManager/cocManager/sc.js');

module.exports = {
    name: "li",
    description: "抽一個總結症狀，用於角色事件結束時的精神狀態總結。",
    permissions: "0x0000000000000800",
    options: [],

    run: async (client, interaction, lang) => {
        try {
            const result = sc.handleLICommand();

            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#7289DA')
                .setTitle('🧠 總結症狀')
                .setDescription(result)
                .setFooter({ text: '請於事件結束時描寫精神狀態。' });

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('執行 /li 指令錯誤：', err);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ 系統錯誤')
                .setDescription('無法抽取總結症狀，請稍後再試。');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};