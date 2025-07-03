const sc = require('../../utils/trpgManager/cocManager/sc.js');
const config = require('../../config.js');
module.exports = {
    name: "ti",
    description: "抽一個即時症狀，用於角色臨場反應與精神狀態描寫。",
    permissions: "0x0000000000000800",
    options: [],

    run: async (client, interaction, lang) => {
        try {
            const embed = sc.handleTICommand(); 
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('執行 /ti 指令錯誤：', err);
            await interaction.reply({
                embeds: [{
                    color: 0xff0000,
                    title: '❌ 系統錯誤',
                    description: '無法抽取即時症狀，請稍後再試。'
                }],
                ephemeral: true
            });
        }
    },
};
