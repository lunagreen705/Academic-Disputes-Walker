//commands/entertainment/checkaffection.js
const { EmbedBuilder } = require('discord.js');
const config = require("../../config.js");
const affectionManager = require('../../utils/entertainment/affectionManager.js'); 

module.exports = {
    name: "checkaffection",
    description: "查看機器人對你的好感度。",
    permissions: "0x0000000000000800",
    options: [],

    run: async (client, interaction, lang) => {
        try {
            const userId = interaction.user.id; // 獲取發送指令的用戶 ID

            // 從 affectionManager 模組獲取用戶當前的好感度
            const currentAffection = affectionManager.getAffection(userId);

            // 創建並發送嵌入式訊息來回覆用戶
            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#0099ff') 
                .setTitle(`💖 好感度查詢：${interaction.user.username}`)
                .setDescription(`學術糾紛對你的的好感度目前為：**${currentAffection} 點**。`);

            await interaction.reply({ embeds: [embed] });

        } catch (e) {
            console.error('執行 /checkaffection 指令時發生錯誤:', e);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000') // 紅色
                .setTitle('❌ 錯誤')
                .setDescription('執行指令時發生未預期的錯誤，請稍後再試。');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};
