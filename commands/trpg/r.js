const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const config = require("../../config.js");

module.exports = {
    name: "r",
    description: "擲骰並計算複雜的結果 (例如: 1d8+3-2, 2d6+5+1)。",
    permissions: "0x0000000000000800",

    options: [
        {
            name: 'expression', // 輸入框名稱
            description: '擲骰表示法 (例如: 1d8+3-2, 2d6+5+1, 1d20)',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ],

    run: async (client, interaction, lang) => {
        try {
            const expression = interaction.options.getString('expression').toLowerCase();

            // 正則表達式來匹配所有的骰子部分 (NdS) 和所有的修正值 (+/-M)
            // 例子: "1d8+3-2"
            // diceMatch: ["1d8", "3", "2"]
            // signsMatch: ["+", "-"]
            const diceMatch = expression.match(/(\d+d\d+)/g); // 找到所有的 "NdS" 部分
            const modifiersMatch = expression.match(/([+\-])(\d+)/g); // 找到所有的 "+M" 或 "-M" 部分

            if (!diceMatch || diceMatch.length === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ 錯誤的表示法')
                    .setDescription('請使用正確的格式，至少需要包含一個骰子部分 (例如 `1d20`、`2d6+3`)。');
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            let totalResult = 0;
            let processDetails = []; // 儲存計算過程的詳細步驟

            // --- 處理所有骰子部分 ---
            for (const dicePart of diceMatch) {
                const [numDiceStr, numSidesStr] = dicePart.split('d');
                const numDice = parseInt(numDiceStr, 10);
                const numSides = parseInt(numSidesStr, 10);

                // 限制骰子數量和面數
                if (numDice <= 0 || numDice > 100) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('❌ 骰子數量無效')
                        .setDescription(`骰子數量必須在 1 到 100 之間 (${dicePart})。`);
                    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
                if (numSides <= 1 || numSides > 1000) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('❌ 骰子面數無效')
                        .setDescription(`骰子面數必須在 2 到 1000 之間 (${dicePart})。`);
                    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

                let currentDiceSum = 0;
                const individualRolls = [];
                for (let i = 0; i < numDice; i++) {
                    const roll = Math.floor(Math.random() * numSides) + 1;
                    individualRolls.push(roll);
                    currentDiceSum += roll;
                }
                totalResult += currentDiceSum;
                processDetails.push(`(${individualRolls.join(' + ')}) = ${currentDiceSum}`);
            }

            // --- 處理所有修正值部分 ---
            if (modifiersMatch) {
                for (const modifierPart of modifiersMatch) {
                    const operator = modifierPart.charAt(0); // 獲取 '+', '-'
                    const modifierValue = parseInt(modifierPart.substring(1), 10); // 獲取數字

                    if (operator === '+') {
                        totalResult += modifierValue;
                        processDetails.push(`+ ${modifierValue}`);
                    } else if (operator === '-') {
                        totalResult -= modifierValue;
                        processDetails.push(`- ${modifierValue}`);
                    }
                }
            }

            // 創建並發送嵌入訊息
            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#0099ff')
                .setTitle(`🎲 通用擲骰：${expression.toUpperCase()}`)
                .setDescription(
                    `**計算過程：** ${processDetails.join(' ')}\n` +
                    `\n**最終結果：${totalResult}**`
                );

            await interaction.reply({ embeds: [embed] });

        } catch (e) {
            console.error('執行 /r 指令時發生錯誤:', e);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ 計算錯誤')
                .setDescription('執行指令時發生未預期的錯誤，請稍後再試。');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};
