// /commands/entertainment/tarot.js

const { EmbedBuilder, ApplicationCommandOptionType, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { getTarotAIResponse } = require('../../utils/ai/aiManager');
const allCards = require('../../data/entertainment/tarot/cards.json');
const allSpreads = require('../../data/entertainment/tarot/spreads.json');
const config = require("../../config.js");

// 將牌陣 JSON 物件轉換為下拉選單的選項格式
const spreadOptions = Object.keys(allSpreads).map(key => ({
    label: `${allSpreads[key].name} (${allSpreads[key].cards_to_draw}張牌)`,
    description: allSpreads[key].description.substring(0, 100),
    value: key,
}));

/**
 * 抽牌函式 (無需修改)
 */
function drawCards(numToDraw) {
    // ... 內容不變
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
 * 建構給 AI 的 Prompt (無需修改)
 */
function buildPrompt(question, spread, drawnCards) {
    // ... 內容不變
    const currentTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    let prompt = `你是一位專業、富有同理心且直覺敏銳的塔羅牌解讀師...`; // (為了簡潔省略)
    return prompt;
}

module.exports = {
    name: "tarot",
    description: "進行一次塔羅牌占卜，尋求宇宙的指引。",
    permissions: "0x0000000000000800",

    // ✨ 1. 指令選項簡化，只剩下選填的「問題」
    options: [
        {
            name: 'question',
            description: '你想要問的問題是什麼？（可選，留空則為綜合指引）',
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ],

    /**
     * ✨ run 函式的職責是發送「帶有下拉選單的初始訊息」
     */
    run: async (client, interaction, lang) => {
        try {
            let userQuestion = interaction.options.getString('question');
            if (!userQuestion) {
                userQuestion = "請給我指引。";
            }

            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#8A2BE2')
                .setTitle('🔮 塔羅占卜')
                .setDescription(`**你的問題是：**\n> ${userQuestion}\n\n請從下方的選單中，選擇一個你想要的牌陣來進行抽牌。`)
                .setFooter({ text: '請在 60 秒內做出選擇' });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('tarot_spread_select') // 這個 ID 會被 interactionCreate.js 用來識別
                .setPlaceholder('點我選擇牌陣...')
                .addOptions(spreadOptions.slice(0, 25)); // 下拉選單最多只能有 25 個選項

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: false
            });

        } catch (e) {
            console.error('❌ 執行 /tarot 指令時發生錯誤:', e);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: lang.errors.generalError.replace("{error}", e.message), ephemeral: true });
            }
        }
    },

    /**
     * ✨ 4. 新增 handleSelectMenu 函式，處理使用者選擇牌陣後的邏輯
     */
    handleSelectMenu: async (client, interaction, lang) => {
        try {
            // 立即更新訊息，防止超時並提供良好UX
            await interaction.update({
                content: '🔮 正在為您洗牌抽牌，請稍候...',
                embeds: [],
                components: []
            });

            // --- 獲取資訊 ---
            const originalEmbed = interaction.message.embeds[0];
            if (!originalEmbed || !originalEmbed.description) {
                throw new Error("無法從原始訊息中找到問題。");
            }
            const userQuestion = originalEmbed.description.split('\n> ')[1].split('\n\n')[0];

            const spreadKey = interaction.values[0];
            const spread = allSpreads[spreadKey];
            if (!spread) {
                throw new Error("找不到對應的牌陣資訊。");
            }

            // --- 執行核心邏輯 ---
            const drawnCards = drawCards(spread.cards_to_draw);
            const promptForAI = buildPrompt(userQuestion, spread, drawnCards);
            const aiInterpretation = await getTarotAIResponse(promptForAI);

            // --- 建立最終回應 ---
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
                .addFields({ name: '🧠 綜合解讀', value: aiInterpretation || "似乎累了，沒有給出回應。" })
                .setFooter({ text: `由 ${interaction.user.username} 占卜`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            // 編輯訊息，顯示最終結果
            await interaction.editReply({ content: '占卜完成！', embeds: [resultEmbed] });

        } catch (e) {
            console.error("❌ 處理塔羅選單時發生錯誤:", e);
            await interaction.editReply({
                content: lang.errors.generalError.replace("{error}", e.message),
                embeds: [],
                components: []
            }).catch(console.error);
        }
    }
};