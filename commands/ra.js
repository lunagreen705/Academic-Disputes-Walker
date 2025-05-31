const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const config = require("../config.js"); // 假設你需要 config 檔案

module.exports = {
    // 指令的名稱和描述
    name: "ra",
    description: "擲百面骰來檢定技能或屬性。",

    // permissions 屬性只是為了模仿現有的結構，它不會影響斜線指令的部署行為。
    permissions: "0x0000000000000800",

    // 定義指令的選項，現在只有 skill 和 value
    options: [
        {
            name: 'skill', // 第一個選項：技能名稱
            description: '要檢定的技能或屬性名稱 (例如: 偵查, 力量)',
            type: ApplicationCommandOptionType.String, // 文字輸入
            required: true // 這個選項是必須的
        },
        {
            name: 'value', // 第二個選項：目標數值
            description: '技能或屬性的目標數值 (0-100)',
            type: ApplicationCommandOptionType.Integer, // 數字輸入
            required: true, // 這個選項是必須的
            minValue: 0,
            maxValue: 100
        }
    ],

    // 指令的執行邏輯
    run: async (client, interaction, lang) => {
        try {
            // 從斜線指令互動中獲取選項值
            const skillName = interaction.options.getString('skill');
            const targetValue = interaction.options.getInteger('value');

            // 驗證輸入（即使 Discord 已有 min/max 限制，這裡再檢查一下是好習慣）
            if (targetValue < 0 || targetValue > 100) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000') // 紅色
                    .setTitle('❌ 錯誤的數值')
                    .setDescription('目標數值必須在 0 到 100 之間。');
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // 固定擲百面骰
            const roll = Math.floor(Math.random() * 100) + 1; // 擲 1 到 100

            let resultText = '';
            let embedColor = config.embedColor || '#0099ff'; // 預設藍色

            if (roll <= targetValue) {
                // 成功
                resultText = `**成功！** (擲出 ${roll} ≤ 目標 ${targetValue})`;
                embedColor = '#00ff00'; // 綠色
            } else {
                // 失敗
                resultText = `**失敗！** (擲出 ${roll} > 目標 ${targetValue})`;
                embedColor = '#ff0000'; // 紅色
            }

            // 處理特殊情況：大成功 (Critical Success) 和 大失敗 (Critical Failure)
            if (roll === 1) {
                resultText = `🎉 **大成功！** (擲出 ${roll} ≤ 目標 ${targetValue})`;
                embedColor = '#ffff00'; // 黃色
            } else if (roll === 100) {
                resultText = `💀 **大失敗！** (擲出 ${roll} > 目標 ${targetValue})`;
                embedColor = '#8b0000'; // 深紅色
            }

            // 創建並發送嵌入訊息
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`📊 ${skillName} 檢定 (d100)`) // 標題直接顯示 d100
                .setDescription(`你擲了 **百面骰**，目標數值為 **${targetValue}**。\n\n**擲骰結果：${roll}**\n${resultText}`);

            await interaction.reply({ embeds: [embed] });

        } catch (e) {
            console.error('執行 /ra 指令時發生錯誤:', e);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ 檢定錯誤')
                .setDescription('執行指令時發生未預期的錯誤，請稍後再試。');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};
