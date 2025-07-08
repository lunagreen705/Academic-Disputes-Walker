//commands/trpg/pi.js
const sc = require('../../utils/trpgManager/cocManager/sc.js');
const config = require('../../config.js');
module.exports = {
    name: "pi",
    description: "抽一個恐懼症狀，用於角色遭遇恐怖事件後的長期反應。",
    permissions: "0x0000000000000800",
    options: [],
    run: async (client, interaction, lang) => {
        try {
            const embed = sc.handlePhobiaCommand();
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('執行 /pi 指令錯誤：', err);
            await interaction.reply({
                embeds: [{
                    color: 0xff0000,
                    title: '❌ 系統錯誤',
                    description: '無法抽取恐懼症狀，請稍後再試。'
                }],
                ephemeral: true
            });
        }
    },
};