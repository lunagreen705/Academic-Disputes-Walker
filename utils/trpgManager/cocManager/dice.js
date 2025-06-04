// utils/trpgManager/cocManager/dice.js

// 只需要引入與擲骰邏輯相關的模組
const { EmbedBuilder } = require('discord.js');
const config = require("../../../config.js"); // 注意這裡 config 路徑的變化：退三層到 utils/trpgManager/cocManager/ -> utils/trpgManager/ -> utils/ -> config.js

// --- 擲骰功能：/rd 指令的核心邏輯 ---
async function rollDiceRd(interaction, numSidesString) {
    const numSides = parseInt(numSidesString, 10);

    if (isNaN(numSides) || numSides <= 0 || numSides > 10000) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ 錯誤的數值')
            .setDescription('請輸入一個 1 到 10000 之間的有效數字作為骰子面數。');
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
    }

    const roll = Math.floor(Math.random() * numSides) + 1;

    const embed = new EmbedBuilder()
        .setColor(config.embedColor || '#0099ff')
        .setTitle(`🎲 擲骰結果 (d${numSides})`)
        .setDescription(`你擲出了：**${roll}**`);

    await interaction.reply({ embeds: [embed] });
}

// --- 擲骰功能：/r 指令的核心邏輯 ---
async function rollDiceR(interaction, expression) {
    const processedExpression = expression.toLowerCase();

    const diceMatch = processedExpression.match(/(\d+d\d+)/g);
    const modifiersMatch = processedExpression.match(/([+\-])(\d+)/g);

    if (!diceMatch || diceMatch.length === 0) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ 錯誤的表示法')
            .setDescription('請使用正確的格式，至少需要包含一個骰子部分 (例如 `1d20`、`2d6+3`)。');
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
    }

    let totalResult = 0;
    let processDetails = [];

    for (const dicePart of diceMatch) {
        const [numDiceStr, numSidesStr] = dicePart.split('d');
        const numDice = parseInt(numDiceStr, 10);
        const numSides = parseInt(numSidesStr, 10);

        if (numDice <= 0 || numDice > 100) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ 骰子數量無效')
                .setDescription(`骰子數量必須在 1 到 100 之間 (${dicePart})。`);
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }
        if (numSides <= 1 || numSides > 1000) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ 骰子面數無效')
                .setDescription(`骰子面數必須在 2 到 1000 之間 (${dicePart})。`);
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
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

    if (modifiersMatch) {
        for (const modifierPart of modifiersMatch) {
            const operator = modifierPart.charAt(0);
            const modifierValue = parseInt(modifierPart.substring(1), 10);

            if (operator === '+') {
                totalResult += modifierValue;
                processDetails.push(`+ ${modifierValue}`);
            } else if (operator === '-') {
                totalResult -= modifierValue;
                processDetails.push(`- ${modifierValue}`);
            }
        }
    }

    const embed = new EmbedBuilder()
        .setColor(config.embedColor || '#0099ff')
        .setTitle(`🎲 通用擲骰：${expression.toUpperCase()}`)
        .setDescription(
            `**計算過程：** ${processDetails.join(' ')}\n` +
            `\n**最終結果：${totalResult}**`
        );

    await interaction.reply({ embeds: [embed] });
}

// --- 擲骰功能：/ra 指令的核心邏輯 ---
async function rollAbilityRa(interaction, skillName, targetValue) {
    if (targetValue < 0 || targetValue > 100) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ 錯誤的數值')
            .setDescription('目標數值必須在 0 到 100 之間。');
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
    }

    const roll = Math.floor(Math.random() * 100) + 1;

    let resultText = '';
    let embedColor = config.embedColor || '#0099ff';

    if (roll === 1) {
        resultText = `**大成功！** (擲出 ${roll}) **你掌握了超出常理的運勢。局面已定，繼續推進！**`;
        embedColor = '#8B0000'; // 深紅色
    } else if (roll >= 96 && roll <= 100) {
        resultText = `**大失敗！** (擲出 ${roll}) **完全的失控。你浪費了時間，現在局面更糟了。立即修正，否則後果自負。**`;
        embedColor = '#000000'; // 黑色
    } else if (roll <= Math.floor(targetValue / 5)) {
        resultText = `**極限成功！** (擲出 ${roll}) **極致的精確。你的判斷無懈可擊，執行得完美。現在，把這優勢維持下去。**`;
        embedColor = '#6A0DAD'; // 紫色
    } else if (roll <= Math.floor(targetValue / 2)) {
        resultText = `**艱難成功！** (擲出 ${roll}) **結果尚可。你克服了挑戰，但仍需提高效率。下次必須做得更好。**`;
        embedColor = '#4B0082'; // 靛藍
    } else if (roll <= targetValue) {
        resultText = `**一般成功。** (擲出 ${roll}) **完成了任務。這是基本要求，沒有值得誇耀之處。**`;
        embedColor = '#1E90FF'; // 道奇藍
    } else {
        resultText = `**失敗。** (擲出 ${roll}) **效率低下，未能達成目標。這不是一個可接受的結果。找出問題，重新評估。**`;
        embedColor = '#CC0000'; // 深紅
    }

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`📊 ${skillName} 檢定 (d100)`)
        .setDescription(
            `擲骰結果：**${roll}** / 目標數值：**${targetValue}**\n\n` +
            `${resultText}`
        );

    await interaction.reply({ embeds: [embed] });
}

// --- 模組匯出 ---
module.exports = {
    rollDiceRd,
    rollDiceR,
    rollAbilityRa,
};
