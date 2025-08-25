//commands/entertainment/tarot.js
const { EmbedBuilder, ApplicationCommandOptionType, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { getTarotAIResponse } = require('../../utils/ai/aiManager');
const allCards = require('../../data/entertainment/tarot/cards.json');
const allSpreads = require('../../data/entertainment/tarot/spreads.json');
const config = require("../../config.js");

// --- 常數設定區，方便統一管理 ---
const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 分鐘
const DEFAULT_QUESTION = "請給我現在最需要的綜合指引。";
const AI_FALLBACK_RESPONSE = "解讀時遇到了一些困難，塔羅師累了，暫時沒有給出回應。";
const MISSING_QUESTION_ERROR = "找不到您最初的問題。可能因為等待時間過長或機器人重啟，請重新發起占卜。";
const SPREAD_NOT_FOUND_ERROR = "找不到對應的牌陣資訊。";
// ---

// 使用 Map 物件作為暫存快取，處理多使用者同時占卜的狀態
const pendingReadings = new Map();

/**
 * 抽牌函式
 */
function drawCards(numToDraw) {
    const deck = [...allCards];
    const drawn = [];
    // Fisher-Yates Shuffle 演算法
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
請綜合以上所有的資訊——包含使用者的問題、牌陣中每個位置的意義、抽到的牌以及其正逆位牌義——為使用者提供兩種風格的綜合解讀，記住語氣風格不要混在一起，並且格式要整齊劃一不要不同。`;
    return prompt;
}

module.exports = {
    name: "塔羅",
    description: "進行塔羅牌占卜，尋求指引。",
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
            const userQuestion = interaction.options.getString('question') || DEFAULT_QUESTION;

            // 【改善點】設定5分鐘後自動清除的計時器
            const timeoutId = setTimeout(() => {
                if (pendingReadings.has(interaction.user.id)) {
                    pendingReadings.delete(interaction.user.id);
                    console.log(`已自動清除超時的占卜請求: ${interaction.user.id}`);
                }
            }, PENDING_TIMEOUT_MS);

            // 【改善點】將問題和計時器ID都存入暫存
            pendingReadings.set(interaction.user.id, {
                question: userQuestion,
                timeout: timeoutId,
            });
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#8A2BE2')
                .setTitle('🔮 塔羅占卜')
                .setDescription(`**你的問題是：**\n> ${userQuestion}\n\n請從下方的選單中，選擇一個你想要的牌陣來進行抽牌。`)
                .setFooter({ text: `請在 ${PENDING_TIMEOUT_MS / 60 / 1000} 分鐘內做出選擇` });

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
            console.error('❌ 執行指令時發生錯誤:', e);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `執行指令時發生錯誤: ${e.message}`, ephemeral: true });
            }
        }
    },

    handleSelectMenu: async (client, interaction, lang) => {
        try {
            // 【改善點】提供更明確的等待訊息，改善使用者體驗
            await interaction.update({
                content: '🔮 洗牌完畢，正在為您召喚塔羅師進行解讀，請靜心等候...',
                embeds: [],
                components: []
            });

            const readingData = pendingReadings.get(interaction.user.id);

            if (!readingData) {
                throw new Error(MISSING_QUESTION_ERROR);
            }
            const userQuestion = readingData.question;

            const spreadKey = interaction.values[0];
            const spread = allSpreads[spreadKey];
            if (!spread) {
                throw new Error(SPREAD_NOT_FOUND_ERROR);
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
                // 提示：若能確保 AI 回應格式，可將 aiInterpretation 字串分割後放入多個 Field，排版更佳
                .addFields({ name: '🧠 綜合解讀', value: aiInterpretation || AI_FALLBACK_RESPONSE })
                .setFooter({ text: `由 ${interaction.user.username} 占卜`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ content: '占卜完成！', embeds: [resultEmbed] });

        } catch (e) {
            console.error("❌ 處理塔羅選單時發生錯誤:", e);
            await interaction.editReply({
                content: e.message || "處理您的請求時發生錯誤。",
                embeds: [],
                components: []
            }).catch(console.error); // 避免在錯誤處理中再次拋出錯誤
        } finally {
            // 【改善點】無論成功或失敗，都清除計時器並刪除暫存資料
            const readingData = pendingReadings.get(interaction.user.id);
            if (readingData) {
                // 清除先前設定的自動刪除計時器，防止記憶體洩漏
                clearTimeout(readingData.timeout);
            }
            // 從暫存中刪除該次占卜的資料
            pendingReadings.delete(interaction.user.id);
        }
    }
};