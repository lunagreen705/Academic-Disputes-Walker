//commands/trpg/li.js
const sc = require('../../utils/trpgManager/cocManager/sc.js');
const config = require('../../config.js');
module.exports = {
    name: "li",
    description: "抽一個總結症狀，用於長期精神創傷的表現。",
    permissions: "0x0000000000000800",
    options: [],
    run: async (client, interaction, lang) => {
        try {
            const embed = sc.handleLICommand();
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('執行 /li 指令錯誤：', err);
            await interaction.reply({
                embeds: [{
                    color: 0xff0000,
                    title: '❌ 系統錯誤',
                    description: '無法抽取總結症狀，請稍後再試。'
                }],
                ephemeral: true
            });
        }
    },
};
