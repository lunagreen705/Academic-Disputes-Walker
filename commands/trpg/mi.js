const sc = require('../../utils/trpgManager/cocManager/sc.js');
const config = require('../../config.js');
module.exports = {
    name: "mi",
    description: "抽一個狂躁症狀，用於角色喪失理智時的衝動表現。",
    permissions: "0x0000000000000800",
    options: [],
    run: async (client, interaction, lang) => {
        try {
            const embed = sc.handleManiaCommand();
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('執行 /mi 指令錯誤：', err);
            await interaction.reply({
                embeds: [{
                    color: 0xff0000,
                    title: '❌ 系統錯誤',
                    description: '無法抽取狂躁症狀，請稍後再試。'
                }],
                ephemeral: true
            });
        }
    },
};