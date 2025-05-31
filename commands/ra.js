const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const config = require("../config.js"); // 假設你需要 config 檔案

module.exports = {
    // 指令的名稱和描述
    name: "ra",
    description: "擲骰來檢定技能或屬性，判斷成功程度。",

    // permissions 屬性只是為了模仿現有的結構，它不會影響斜線指令的部署行為。
    permissions: "0x0000000000000800",

    // 定義指令的選項，現在只有 skill 和 value
    options: [
        {
            name: 'skill', // 第一個選項：技能名稱
            description: '檢定的技能或屬性名稱 (例如: 偵查, 力量)',
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

            // 驗證輸入（儘管 Discord 已有 min/max 限制，這裡再檢查一下是好習慣）
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

            // --- 根據擲骰結果和目標數值判斷成功程度 ---
            if (roll === 1) {
                // 大成功（critical）：1！奇蹟式的表現。
                resultText = `**大成功！** (擲出 ${roll}) **你掌握了超出常理的運勢。局面已定，繼續推進！**`;
                embedColor = '#8B0000'; // 深紅色 (克蘇魯風格的勝利，帶有不祥感)
            } else if (roll >= 96 && roll <= 100) { // 96~00 (00 通常指 100)
                // 大失敗（fumble）：擲出 96~00 （或 00）。呃，事情還能被你搞得更糟嗎？
                resultText = `**大失敗！** (擲出 ${roll}) **完全的失控。你浪費了時間，現在局面更糟了。立即修正，否則後果自負。**`;
                embedColor = '#000000'; // 黑色 (徹底的絕望與混亂)
            } else if (roll <= Math.floor(targetValue / 5)) {
                // 極限（extreme）：小於五分之一數值。接近人類極限的表現。
                resultText = `**極限成功！** (擲出 ${roll}) **極致的精確。你的判斷無懈可擊，執行得完美。現在，把這優勢維持下去。**`;
                embedColor = '#6A0DAD'; // 紫色 (非凡的控制力)
            } else if (roll <= Math.floor(targetValue / 2)) {
                // 艱難（hard）：小於二分之一數值。令人讚嘆的表現。
                resultText = `**艱難成功！** (擲出 ${roll}) **結果尚可。你克服了挑戰，但仍需提高效率。下次必須做得更好。**`;
                embedColor = '#4B0082'; // 靛藍 (努力達成，但仍有改善空間)
            } else if (roll <= targetValue) {
                // 一般（regular）：小於該數值。順利完成了你的任務。
                resultText = `**一般成功。** (擲出 ${roll}) **完成了任務。這是基本要求，沒有值得誇耀之處。**`;
                embedColor = '#1E90FF'; // 道奇藍 (中規中矩的結果)
            } else {
                // 失敗（failure）：普通地擲出大於該數值。這件事情難倒你了。
                resultText = `**失敗。** (擲出 ${roll}) **效率低下，未能達成目標。這不是一個可接受的結果。找出問題，重新評估。**`;
                embedColor = '#CC0000'; // 深紅 (直接的失敗，不容置疑)
            }

            // 創建並發送嵌入訊息
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`📊 ${skillName} 檢定 (d100)`) // 標題直接顯示 d100
                .setDescription(
                    `擲骰結果：**${roll}** / 目標數值：**${targetValue}**\n\n` +
                    `${resultText}` // 這裡直接使用 resultText
                );

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
