//commands/entertainment/draw.js
const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const config = require("../../config.js");
const deckManager = require('../../utils/entertainment/deckManager.js'); 

module.exports = {
    name: "draw",
    description: "從指定牌堆中抽取。",
    permissions: "0x0000000000000800",

 options: [
    {
        name: 'deck',
        description: '選擇要抽取的牌堆',
        type: ApplicationCommandOptionType.String,
        required: true,
        autocomplete: true 
    }
],

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        const availableDecks = deckManager.getAvailableDeckNames(); 

        
        const choices = availableDecks.map(name => ({
            name: name, 
            value: name  
        }));

        // 模糊匹配
        const filtered = choices.filter(choice =>
            choice.name.toLowerCase().includes(focusedValue.toLowerCase()) 
        );


        await interaction.respond(
            filtered.slice(0, 25) 
        );
    },

    run: async (client, interaction, lang) => {
        try {
            const deckName = interaction.options.getString('deck'); 
            let drawnItem = deckManager.drawFromDeck(deckName);

            if (!drawnItem) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ 錯誤')
                    .setDescription(`找不到牌堆 "${deckName}" 或它目前是空的。請確認你選擇了正確的牌堆。`);
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

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
