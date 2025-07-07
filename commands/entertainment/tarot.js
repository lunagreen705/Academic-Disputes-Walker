const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

// 1. 引入正確的函式
// 將 getAIResponse 更換為專為塔羅設計的 getTarotAIResponse
const { getTarotAIResponse } = require('../../utils/ai/aiManager'); 
const allCards = require('../../data/tarot/cards.json'); 
const allSpreads = require('../../data/tarot/spreads.json');

// 將牌陣 JSON 物件轉換為下拉選單的選項格式
const spreadOptions = Object.keys(allSpreads).map(key => ({
    label: allSpreads[key].name,
    description: allSpreads[key].description.substring(0, 100),
    value: key,
}));

/**
 * 抽牌函式 (此函式無需修改)
 * @param {number} numToDraw - 需要抽的牌數
 * @returns {Array<{card: object, isReversed: boolean}>}
 */
function drawCards(numToDraw) {
    const deck = [...allCards];
    const drawn = [];
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    for (let i = 0; i < numToDraw; i++) {
        const card = deck.pop();
        drawn.push({
            card: card,
            isReversed: Math.random() < 0.5
        });
    }
    return drawn;
}

/**
 * 建構給 AI 的 Prompt (此函式無需修改，寫得很好！)
 * @returns {string} - 結構化的 Prompt
 */
function buildPrompt(question, spread, drawnCards) {
    // 你的 Prompt 結構非常清晰，這有助於 AI 提供更高品質的回應
    let prompt = `你是一位專業、富有同理心且直覺敏銳的塔羅牌解讀師。請根據使用者提供的資訊，整合所有線索，提供一個全面且深入的分析。請不要只單純複述牌義，而是要將它們串連成一個有意義的故事來回答使用者的問題。

# 使用者資訊
- **他們的問題是：** "${question}"

# 牌陣資訊
- **牌陣名稱：** ${spread.name}
- **牌陣說明：** ${spread.description}

# 抽牌結果與牌義
以下是抽出的牌，以及它們在牌陣中各自的位置與基本牌義：
`;
    drawnCards.forEach((item, index) => {
        const position = spread.positions[index];
        const orientation = item.isReversed ? '逆位' : '正位';
        const meaning = item.isReversed ? item.card.meaning_rev : item.card.meaning_up;
        prompt += `
## ${index + 1}. **位置：${position.position_name}** (${position.description})
    - **抽到的牌：** ${item.card.name_zh} (${orientation})
    - **此狀態下的基本牌義：** ${meaning}
`;
    });
    prompt += `
# 你的任務
請綜合以上所有的資訊——包含使用者的問題、牌陣中每個位置的意義、抽到的牌以及其正逆位牌義——為使用者提供一段溫暖、清晰且具有指導性的綜合解讀。`;
    return prompt;
}

module.exports = {
    name: '塔羅',
    description: '進行一次塔羅牌占卜',
    // ... 其他指令屬性

    /**
     * 主要指令執行函式 (此函式無需修改)
     */
    run: async (client, interaction, lang) => {
        // 這部分的互動邏輯保持不變
        const userQuestion = interaction.options.getString('question');

        const embed = new EmbedBuilder()
            .setColor(0x8A2BE2)
            .setTitle('🔮 塔羅占卜')
            .setDescription(`**你的問題是：**\n> ${userQuestion}\n\n請從下方的選單中，選擇一個你想要的牌陣來進行抽牌。`)
            .setFooter({ text: '請在 60 秒內做出選擇' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('tarot_spread_select')
            .setPlaceholder('點我選擇牌陣...')
            .addOptions(spreadOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: false
        });
    },

    /**
     * 處理下拉選單互動的函式 (✨ 主要修改點在此)
     */
    handleSelectMenu: async (client, interaction, lang) => {
        // 從互動中獲取資訊
        const spreadKey = interaction.values[0];
        const spread = allSpreads[spreadKey];
        const originalEmbed = interaction.message.embeds[0];
        const userQuestion = originalEmbed.description.split('\n> ')[1].split('\n\n')[0];

        if (!spread || !userQuestion) {
            await interaction.editReply({ content: lang.errors.generalError.replace("{error}", "找不到原始問題或牌陣資訊"), embeds: [], components: [] });
            return;
        }

        // 執行核心邏輯
        const drawnCards = drawCards(spread.cards_to_draw);
        const promptForAI = buildPrompt(userQuestion, spread, drawnCards);

        // ✨【修改點】✨
        // 呼叫新的 getTarotAIResponse 函式。
        // 它不需要 sessionId 或 persona key，因為這些都已經在模組內部處理好了。
        // 它只接收一個參數：我們精心建構的 prompt。
        const aiInterpretation = await getTarotAIResponse(promptForAI);

        // 建立最終結果 (此部分無需修改)
        let resultDescription = `**❓ 你的問題：**\n> ${userQuestion}\n\n`;
        resultDescription += `**🃏 使用的牌陣：**\n> ${spread.name}\n\n`;
        resultDescription += "**抽出的牌組：**\n";
        drawnCards.forEach((card, index) => {
            const position = spread.positions[index].position_name;
            resultDescription += `> **${position}：** ${card.card.name_zh} (${card.isReversed ? '逆位' : '正位'})\n`;
        });

        const resultEmbed = new EmbedBuilder()
            .setColor(0x4E9F3D)
            .setTitle('🔮 塔羅占卜結果')
            .setDescription(resultDescription)
            .addFields({ name: '🧠 AI 綜合解讀', value: aiInterpretation || "AI 似乎累了，沒有給出回應。" })
            .setFooter({ text: `由 ${interaction.user.username} 占卜`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        // 編輯原始訊息，更新為最終結果
        await interaction.editReply({ content: '占卜完成！', embeds: [resultEmbed], components: [] });
    }
};