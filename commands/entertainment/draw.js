// your-discord-bot/commands/draw.js
const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const config = require("../../config.js");
const deckManager = require('../../utils/entertainment/deckManager.js'); // 引入牌堆管理模組

// 不再需要 deckNameMap，因為我們直接顯示原始英文名稱

module.exports = {
    name: "draw",
    description: "從指定的牌堆中抽取一個項目。",
    permissions: "0x0000000000000800",

 options: [
    {
        name: 'deck',
        description: '選擇要抽取的牌堆',
        type: ApplicationCommandOptionType.String,
        required: true,
        autocomplete: true // 🔥 關鍵就在這一行
    }
],

    // Discord.js v13/v14 的 slash command 支援 autocomplete 功能
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        // 從 deckManager 獲取所有可用牌堆名稱，這些名稱就是 .json 檔案的名稱（不含副檔名）
        const availableDecks = deckManager.getAvailableDeckNames(); 

        // 直接將牌堆的原始英文名稱作為選項的 name 和 value
        const choices = availableDecks.map(name => ({
            name: name, // 直接使用原始英文名稱作為顯示名稱
            value: name  // value 仍然是英文檔案名，deckManager 處理時需要這個
        }));

        // 根據用戶輸入過濾選項，使用 includes 實現模糊匹配
        const filtered = choices.filter(choice =>
            choice.name.toLowerCase().includes(focusedValue.toLowerCase()) 
        );

        // 回應 Discord，最多顯示 25 個選項
        await interaction.respond(
            filtered.slice(0, 25) 
        );
    },

    run: async (client, interaction, lang) => {
        try {
            const deckName = interaction.options.getString('deck'); // 這裡拿到的是用戶選擇的原始英文值
            let drawnItem = deckManager.drawFromDeck(deckName);

            if (!drawnItem) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ 錯誤')
                    .setDescription(`找不到牌堆 "${deckName}" 或它目前是空的。請確認你選擇了正確的牌堆。`);
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // 標題也直接使用原始英文名稱
            const embedTitle = `✨ ${deckName} 牌堆，經過深淵的探索`;
            const embedDescription = `你抽到了：**${drawnItem}**`;

            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#0099ff')
                .setTitle(embedTitle)
                .setDescription(embedDescription);

            await interaction.reply({ embeds: [embed] });

        } catch (e) {
            console.error('執行 /draw 指令時發生錯誤:', e);
            const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ 抽取錯誤')
                    .setDescription('執行指令時發生未預期的錯誤，請稍後再試。');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};
