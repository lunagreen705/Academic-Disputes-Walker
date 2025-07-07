const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { getTarotAIResponse } = require('../../utils/ai/aiManager'); 
const allCards = require('../../data/entertainment/tarot/cards.json'); 
const allSpreads = require('../../data/entertainment/tarot/spreads.json');

// 將牌陣 JSON 物件轉換為下拉選單的選項格式 (無需修改)
const spreadOptions = Object.keys(allSpreads).map(key => ({
    label: allSpreads[key].name,
    description: allSpreads[key].description.substring(0, 100),
    value: key,
}));

/**
 * 抽牌函式 (無需修改)
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
 * 建構給 AI 的 Prompt (優化)
 */
function buildPrompt(question, spread, drawnCards) {
    // ✨ 優化：加入當前時間，給 AI 更多情境
    const currentTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

    let prompt = `你是一位專業、富有同理心且直覺敏銳的塔羅牌解讀師。請根據使用者提供的資訊，整合所有線索，提供一個全面且深入的分析。請不要只單純複述牌義，而是要將它們串連成一個有意義的故事來回答使用者的問題。

# 背景資訊
- **占卜時間：** ${currentTime}

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
    name: '塔羅', // ✨ 請確保這個名稱和 interactionCreate.js 中 get 的名稱一致
    description: '進行一次塔羅牌占卜',

    /**
     * 主要指令執行函式 (優化)
     */
    run: async (client, interaction, lang) => {
        try {
            // ✨ 優化：整合問題選填邏輯
            let userQuestion = interaction.options.getString('question');
            if (!userQuestion) {
                userQuestion = "請給我關於我目前整體狀況的綜合指引。";
            }

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
        } catch (error) {
            console.error("❌ 執行指令時發生錯誤:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: lang.errors.generalError.replace("{error}", error.message), ephemeral: true });
            }
        }
    },

    /**
     * 處理下拉選單互動的函式 (優化)
     */
    handleSelectMenu: async (client, interaction, lang) => {
        try {
            // ✨ 優化 (非常重要！): 立即更新訊息，防止互動超時，並提供更好的使用者體驗
            await interaction.update({ 
                content: '🔮 正在為您洗牌抽牌，請稍候...', 
                embeds: [], 
                components: [] 
            });

            // 從原始訊息中安全地獲取問題
            const originalEmbed = interaction.message.embeds[0];
            if (!originalEmbed || !originalEmbed.description) {
                throw new Error("無法從原始訊息中找到問題。");
            }
            const userQuestion = originalEmbed.description.split('\n> ')[1].split('\n\n')[0];

            // 獲取牌陣資訊
            const spreadKey = interaction.values[0];
            const spread = allSpreads[spreadKey];
            if (!spread) {
                throw new Error("找不到對應的牌陣資訊。");
            }

            // --- 核心邏輯開始 ---
            const drawnCards = drawCards(spread.cards_to_draw);
            const promptForAI = buildPrompt(userQuestion, spread, drawnCards);
            const aiInterpretation = await getTarotAIResponse(promptForAI);
            // --- 核心邏輯結束 ---

            // 建立最終結果的描述
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
                .addFields({ name: '🧠 綜合解讀', value: aiInterpretation || "似乎累了，沒有給出回應。" })
                .setFooter({ text: `由 ${interaction.user.username} 占卜`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();
            
            // ✨ 優化：使用 editReply 更新訊息，顯示最終結果
            await interaction.editReply({ content: '占卜完成！', embeds: [resultEmbed] });

        } catch (error) {
            console.error("❌ 處理塔羅選單時發生錯誤:", error);
            // 如果出錯，嘗試用 editReply 回覆錯誤訊息
            await interaction.editReply({ 
                content: lang.errors.generalError.replace("{error}", error.message),
                embeds: [],
                components: []
            }).catch(console.error); // 如果連 editReply 都失敗，只在後台記錄
        }
    }
};