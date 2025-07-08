//commands/entertainment/tarot.js
const { EmbedBuilder, ApplicationCommandOptionType, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { getTarotAIResponse } = require('../../utils/ai/aiManager');
const allCards = require('../../data/entertainment/tarot/cards.json');
const allSpreads = require('../../data/entertainment/tarot/spreads.json');
const config = require("../../config.js");

// 使用 Map 物件作為暫存快取，處理多使用者同時占卜的狀態
const pendingReadings = new Map();

/**
 * 抽牌函式
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
 * 建構給 AI 的 Prompt
 */
function buildPrompt(question, spread, drawnCards) {
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
請綜合以上所有的資訊——包含使用者的問題、牌陣中每個位置的意義、抽到的牌以及其正逆位牌義——為使用者提供清晰且具有指導性的綜合解讀。`;
    return prompt;
}

module.exports = {
    name: "塔羅",
    description: "進行一次塔羅牌占卜，尋求宇宙的指引。",
    permissions: "0x0000000000000800",
    options: [
        {
            name: 'question',
            description: '你想要問的問題是什麼？（可選，留空則為綜合指引）',
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ],

    // run 函式 (已修改)
    run: async (client, interaction, lang) => {
        // ✅ 移除本地的 try/catch，讓錯誤向上拋出給 interactionCreate.js 統一處理
        let userQuestion = interaction.options.getString('question') || "請給我關於我目前整體狀況的綜合指引。";

        pendingReadings.set(interaction.user.id, userQuestion);
        
        setTimeout(() => {
            if (pendingReadings.has(interaction.user.id)) {
                pendingReadings.delete(interaction.user.id);
            }
        }, 5 * 60 * 1000); 

        const embed = new EmbedBuilder()
            .setColor(config.embedColor || '#8A2BE2')
            .setTitle('🔮 塔羅占卜')
            .setDescription(`**你的問題是：**\n> ${userQuestion}\n\n請從下方的選單中，選擇一個你想要的牌陣來進行抽牌。`)
            .setFooter({ text: '請在 5 分鐘內做出選擇' });

        const spreadOptions = Object.keys(allSpreads).map(key => ({
            label: `${allSpreads[key].name} (${allSpreads[key].cards_to_draw}張牌)`,
            description: allSpreads[key].description.substring(0, 100),
            value: key,
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('tarot|spread_select') // ✅ 建議為 customId 加上指令名前綴，方便路由
            .setPlaceholder('點我選擇牌陣...')
            .addOptions(spreadOptions.slice(0, 25));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // ✅ 將 reply 改為 editReply，並設定為公開訊息
        await interaction.editReply({
            embeds: [embed],
            components: [row],
            ephemeral: false // 如果希望訊息是公開的
        });
    },

    // handleSelectMenu 函式 (已修改)
    handleSelectMenu: async (client, interaction, lang) => {
        try {
            // ✅ 移除本地的 update()，改用 editReply() 來更新介面
            // interactionCreate.js 已經 deferUpdate 了，這裡直接編輯即可
            await interaction.editReply({
                content: '🔮 正在為您洗牌、抽牌並聯繫宇宙智慧，請稍候...',
                embeds: [],
                components: []
            });

            const userQuestion = pendingReadings.get(interaction.user.id);
            if (!userQuestion) {
                throw new Error("找不到您最初的問題。可能因等待時間過長或機器人重啟，請重新發起占卜。");
            }

            const spreadKey = interaction.values[0];
            const spread = allSpreads[spreadKey];
            if (!spread) {
                throw new Error("找不到對應的牌陣資訊。");
            }
            
            const drawnCards = drawCards(spread.cards_to_draw);
            const promptForAI = buildPrompt(userQuestion, spread, drawnCards);
            const aiInterpretation = await getTarotAIResponse(promptForAI);
            
            // ... (建立 resultDescription 和 resultEmbed 的邏輯不變) ...
            let resultDescription = `...`;
            const resultEmbed = new EmbedBuilder()
                .setColor('#4E9F3D')
              // ...

            // ✅ 使用 editReply 更新最終結果
            await interaction.editReply({ content: '占卜完成！', embeds: [resultEmbed] });

        } catch (e) {
            console.error("❌ 處理塔羅選單時發生錯誤:", e);
            // ✅ 錯誤處理也使用 editReply
            await interaction.editReply({
                content: `處理您的請求時發生錯誤：\n> ${e.message}`,
                embeds: [],
                components: []
            }).catch(console.error); // 防止在回報錯誤時又出錯
        } finally {
            // 這個 finally 區塊寫得很好，確保狀態被清理
            pendingReadings.delete(interaction.user.id);
        }
    }
};