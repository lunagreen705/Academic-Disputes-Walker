// your-discord-bot/commands/checkaffection.js
const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const config = require("../../config.js");
const affectionManager = require('../../utils/entertainment/affectionManager.js'); // 確保這個路徑是正確的！

module.exports = {
    // 指令的名稱和描述
    name: "checkaffection",
    description: "查看機器人對你的好感度。",

    // permissions 屬性（為了模仿舊結構而保留，不會影響斜線指令的實際部署行為）
    permissions: "0x0000000000000800",

    // 這個指令不需要任何額外選項，因為它只是查詢發送者的好感度
    options: [],

    // 指令執行邏輯
    run: async (client, interaction, lang) => {
        try {
            const userId = interaction.user.id; // 獲取發送指令的用戶 ID

            // 從 affectionManager 模組獲取用戶當前的好感度
            const currentAffection = affectionManager.getAffection(userId);

            // 創建並發送嵌入式訊息來回覆用戶
            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#0099ff') // 使用你在 config 中定義的顏色，或預設為藍色
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
