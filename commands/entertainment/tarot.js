const { 
    EmbedBuilder, 
    ApplicationCommandOptionType, 
    StringSelectMenuBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
} = require('discord.js');
const { getTarotAIResponse } = require('../../utils/ai/aiManager');
const allCards = require('../../data/entertainment/tarot/cards.json'); 
const allSpreads = require('../../data/entertainment/tarot/spreads.json');
const config = require("../../config.js");

// --- 常數設定---
const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 分鐘等待牌陣選擇
const RESULT_CACHE_MS = 10 * 60 * 1000;  // 10 分鐘結果快取，供按鈕互動
const DEFAULT_QUESTION = "請給我現在最需要的綜合指引。";
const AI_FALLBACK_RESPONSE = "解讀時遇到了一些困難，塔羅師累了，暫時沒有給出回應。";
const MISSING_QUESTION_ERROR = "找不到您最初的問題。可能因為等待時間過長或機器人重啟，請重新發起占卜。";
const SPREAD_NOT_FOUND_ERROR = "找不到對應的牌陣資訊。";
const AI_SPLIT_TOKEN = '---SPLIT---'; // AI 風格分隔符
// ---

// Map暫存快取
const pendingReadings = new Map(); // Key: userId - 儲存等待選單的狀態
const resultCache = new Map();    // Key: originalInteractionId - 儲存占卜結果，用於按鈕切換

/**
 * 抽牌函式 (優化版：只進行 K 次交換，O(K) 效率更高)
 */
function drawCards(numToDraw) {
    const deck = [...allCards];
    const drawn = [];
    const N = deck.length;

    // Fisher-Yates 變體，只洗牌 K 次
    for (let i = 0; i < numToDraw; i++) {
        // 從 [i] 到 [N-1] 之間隨機選一個索引 j
        const j = Math.floor(Math.random() * (N - i)) + i;
        
        // 將選中的牌 (deck[i]) 換到第 i 個位置
        [deck[i], deck[j]] = [deck[j], deck[i]];

        // 將換到第 i 個位置的牌抽出，並決定正逆位
        const card = deck[i];
        drawn.push({
            card: card,
            isReversed: Math.random() < 0.5
        });
    }
    return drawn;
}

/**
 * AI Prompt
 */
function buildPrompt(question, spread, drawnCards) {
    let prompt = `
**任務：** 根據抽牌結果，請提供以下兩種風格的分析：
1. **[神棍老師傅]**：扮演神棍中國老師傅進行解讀。風格是**神棍、翻譯腔、帶動作、著重於命運玄學**。
2. **[專業塔羅師]**：扮演專業、富有同理心且直覺敏銳的現代塔羅師。風格是**柔性、心理學導向、著重於內在探索和成長建議**。
**輸出要求：** 
1. **嚴格使用分隔符號 \`${AI_SPLIT_TOKEN}\` 區分兩種風格。
2. **每種風格的解讀內容，嚴格限制500 中文字。
3. **禁止單純複述牌義，必須將其串連成有意義的故事回答問題。

# 問題與牌陣
- **使用者問題：** "${question}"
- **牌陣名稱：** ${spread.name} (${spread.description})

# 抽牌結果
`;
    drawnCards.forEach((item, index) => {
        const position = spread.positions[index];
        const orientation = item.isReversed ? '逆位' : '正位';
        
   
        prompt += `
## ${index + 1}. **${position.position_name}**
- **位置含義：** ${position.description}
- **抽到的牌：** ${item.card.name_zh} (${orientation})
`;
    });
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

    customIdPrefixes: ['tarot_spread_select', 'tarot_switch_'], 

    run: async (client, interaction, lang) => {
        try {
            const userQuestion = interaction.options.getString('question') || DEFAULT_QUESTION;
            const userId = interaction.user.id;

            // 清除先前可能的超時計時器，防止記憶體洩漏
            const existingReading = pendingReadings.get(userId);
            if (existingReading) {
                 clearTimeout(existingReading.timeout);
            }

            // 設定5分鐘後自動清除的計時器
            const timeoutId = setTimeout(() => {
                if (pendingReadings.has(userId)) {
                    pendingReadings.delete(userId);
                    console.log(`已自動清除超時的占卜請求: ${userId}`);
                }
            }, PENDING_TIMEOUT_MS);

            // 將問題和計時器ID都存入暫存
            pendingReadings.set(userId, {
                userId: userId, 
                question: userQuestion,
                timeout: timeoutId,
            });
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#8A2BE2')
                .setTitle('🔮 塔羅占卜：請選擇牌陣')
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
                .addOptions(spreadOptions.slice(0, 25));

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });

        } catch (e) {
            console.error('❌ 執行指令時發生錯誤:', e);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `執行指令時發生錯誤: ${e.message}`, ephemeral: true });
            }
        }
    },

    handleSelectMenu: async (client, interaction, lang) => {
        const userId = interaction.user.id;
        const readingData = pendingReadings.get(userId);
        const originalInteractionId = interaction.message.interaction.id; 

        try {
            // 1. 驗證與狀態清理
            if (!readingData || readingData.userId !== userId) {
                return interaction.reply({ content: MISSING_QUESTION_ERROR, ephemeral: true });
            }
            clearTimeout(readingData.timeout);
            
            // 2. 更新等待訊息 (UX 優化)
            await interaction.update({
                content: '🔮 洗牌完畢，正在為您召喚塔羅師進行解讀，請靜心等候... (約需 10-30 秒)',
                embeds: [],
                components: []
            });
            
            const userQuestion = readingData.question;
            const spreadKey = interaction.values[0];
            const spread = allSpreads[spreadKey];
            
            if (!spread) {
                throw new Error(SPREAD_NOT_FOUND_ERROR);
            }
            
            // 3. 抽牌與生成 Prompt
            const drawnCards = drawCards(spread.cards_to_draw);
            const promptForAI = buildPrompt(userQuestion, spread, drawnCards);
            
            // 4. AI 呼叫與解析
            const aiInterpretation = await getTarotAIResponse(promptForAI);
            const [styleA, styleB] = aiInterpretation.split(AI_SPLIT_TOKEN, 2).map(s => s.trim());
            
            // 5. 建立基礎描述
            let baseDescription = `**❓ 你的問題：**\n> ${userQuestion}\n\n`;
            baseDescription += `**🃏 使用的牌陣：**\n> ${spread.name}\n\n`;
            baseDescription += "**抽出的牌組：**\n";
            drawnCards.forEach((card, index) => {
                const position = spread.positions[index].position_name;
                baseDescription += `> **${position}：** ${card.card.name_zh} (${card.isReversed ? '逆位' : '正位'})\n`;
            });
            baseDescription += "\n---\n點擊下方按鈕切換解讀風格。"; 

            // 6. 儲存到結果快取 (實現分頁邏輯的核心)
            resultCache.set(originalInteractionId, {
                userId: userId,
                baseDesc: baseDescription,
                style1: styleA || AI_FALLBACK_RESPONSE,
                style2: styleB || AI_FALLBACK_RESPONSE,
                currentStyle: 1 // 預設顯示風格 1
            });
            
    
            const firstEmbed = new EmbedBuilder()
                .setColor('#4E9F3D')
                .setTitle('🔮 塔羅占卜結果 - [風格一：神棍老師傅]') 
                .setDescription(baseDescription)
                .addFields({ name: '🎴 老師傅的預言', value: styleA || AI_FALLBACK_RESPONSE, inline: false }) 
                .setFooter({ text: `由 ${interaction.user.username} 占卜 | 結果快取 ${RESULT_CACHE_MS / 60 / 1000} 分鐘`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            const switchButton = new ButtonBuilder()
                .setCustomId(`tarot_switch_${originalInteractionId}`) 
                .setLabel('切換到 風格二：專業塔羅師分析 🧠')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(switchButton);

    
            await interaction.editReply({ content: '占卜完成！', embeds: [firstEmbed], components: [row] });
            
            setTimeout(() => {
                resultCache.delete(originalInteractionId);
                console.log(`已自動清除超時的結果快取: ${originalInteractionId}`);
            }, RESULT_CACHE_MS);


        } catch (e) {
            console.error("❌ 處理塔羅選單時發生錯誤:", e);
            await interaction.editReply({
                content: e.message || "處理您的請求時發生錯誤。",
                embeds: [],
                components: []
            }).catch(console.error);
        } finally {
         
            pendingReadings.delete(userId); 
        }
    },

    /**
     * 處理按鈕切換邏輯
     */
    handleButton: async (client, interaction, lang) => {
        const originalInteractionId = interaction.customId.split('_').pop();
        const data = resultCache.get(originalInteractionId);

        // 1. 驗證與快取檢查
        if (!data) {
            // 數據過期，移除按鈕組件
            return interaction.update({ 
                content: "❌ 占卜結果數據已過期，請重新發起占卜。",
                embeds: interaction.message.embeds, 
                components: [] 
            });
        }
        
        // 驗證是否為發起者
        if (interaction.user.id !== data.userId) {
            return interaction.reply({ 
                content: "這不是你的占卜結果，別亂點！", 
                ephemeral: true 
            });
        }
        
        // 2. 決定切換風格與內容
        const newStyle = data.currentStyle === 1 ? 2 : 1;
        
        // 根據新風格更新標題和欄位
        const newTitle = newStyle === 2 
            ? '🔮 塔羅占卜結果 - [風格二：專業塔羅師]' 
            : '🔮 塔羅占卜結果 - [風格一：神棍老師傅]';
        
        const fieldName = newStyle === 2 ? '🧠 專業分析與建議' : '🎴 老師傅的預言';
        const fieldValue = newStyle === 2 ? data.style2 : data.style1;
        
        const buttonLabel = newStyle === 2
            ? '切換回 風格一：神棍老師傅預言 🎴'
            : '切換到 風格二：專業塔羅師分析 🧠';
        const newColor = newStyle === 2 ? '#FF7F50' : '#4E9F3D';

        // 3. 更新狀態
        data.currentStyle = newStyle;
        resultCache.set(originalInteractionId, data); 

        // 4. 構造新的 Embed
        const newEmbed = new EmbedBuilder()
            .setColor(newColor) 
            .setTitle(newTitle)
            .setDescription(data.baseDesc)
            // 確保每次只顯示當前風格的 Field
            .addFields({ name: fieldName, value: fieldValue, inline: false })
            .setFooter({ text: `由 ${interaction.user.username} 占卜 | 結果快取 ${RESULT_CACHE_MS / 60 / 1000} 分鐘`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        // 5. 構造新的 Button
        const newButton = new ButtonBuilder()
            .setCustomId(`tarot_switch_${originalInteractionId}`) 
            .setLabel(buttonLabel)
            .setStyle(ButtonStyle.Primary);

        const newRow = new ActionRowBuilder().addComponents(newButton);

        // 6. 更新原訊息
        await interaction.update({ 
            embeds: [newEmbed], 
            components: [newRow] 
        });
    }
};