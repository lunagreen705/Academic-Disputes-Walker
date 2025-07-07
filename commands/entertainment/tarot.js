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
請綜合以上所有的資訊——包含使用者的問題、牌陣中每個位置的意義、抽到的牌以及其正逆位牌義——為使用者提供一段溫暖、清晰且具有指導性的綜合解讀。`;
    return prompt;
}

module.exports = {
    name: "tarot",
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

    run: async (client, interaction, lang) => {
        try {
            let userQuestion = interaction.options.getString('question');
            if (!userQuestion) {
                userQuestion = "請給我關於我目前整體狀況的綜合指引。";
            }

            // 將問題存入暫存，以使用者ID為key
            pendingReadings.set(interaction.user.id, userQuestion);
            
            // 設定5分鐘後自動清除，避免使用者未選擇而造成記憶體洩漏
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
                .setCustomId('tarot_spread_select')
                .setPlaceholder('點我選擇牌陣...')
                .addOptions(spreadOptions.slice(0, 25)); // 下拉選單最多25個選項

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: false
            });

        } catch (e) {
            console.error('❌ 執行 /tarot 指令時發生錯誤:', e);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `執行指令時發生錯誤: ${e.message}`, ephemeral: true });
            }
        }
    },

    handleSelectMenu: async (client, interaction, lang) => {
        try {
            // 立即更新訊息，防止超時並提供良好UX
            await interaction.update({
                content: '🔮 正在為您洗牌抽牌請稍候...',
                embeds: [],
                components: []
            });

            const userQuestion = pendingReadings.get(interaction.user.id);

            if (!userQuestion) {
                throw new Error("找不到您最初的問題。可能因為等待時間過長或機器人重啟，請重新發起占卜。");
            }

            const spreadKey = interaction.values[0];
            const spread = allSpreads[spreadKey];
            if (!spread) {
                throw new Error("找不到對應的牌陣資訊。");
            }
            
            const drawnCards = drawCards(spread.cards_to_draw);
            const promptForAI = buildPrompt(userQuestion, spread, drawnCards);
            const aiInterpretation = await getTarotAIResponse(promptForAI);
            
            let resultDescription = `**❓ 你的問題：**\n> ${userQuestion}\n\n`;
            resultDescription += `**🃏 使用的牌陣：**\n> ${spread.name}\n\n`;
            resultDescription += "**抽出的牌組：**\n";
            drawnCards.forEach((card, index) => {
                const position = spread.positions[index].position_name;
                resultDescription += `> **${position}：** ${card.card.name_zh} (${card.isReversed ? '逆位' : '正位'})\n`;
            });

            const resultEmbed = new EmbedBuilder()
                .setColor('#4E9F3D')
                .setTitle('🔮 塔羅占卜結果')
                .setDescription(resultDescription)
                .addFields({ name: '🧠 綜合解讀', value: aiInterpretation || "累了，沒有給出回應。" })
                .setFooter({ text: `由 ${interaction.user.username} 占卜`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ content: '占卜完成！', embeds: [resultEmbed] });

        } catch (e) {
            console.error("❌ 處理塔羅選單時發生錯誤:", e);
            await interaction.editReply({
                content: e.message || "處理您的請求時發生錯誤。",
                embeds: [],
                components: []
            }).catch(console.error);
        } finally {
            // 無論成功或失敗，最後都從暫存中刪除該次占卜的資料
            pendingReadings.delete(interaction.user.id);
        }
    }
};