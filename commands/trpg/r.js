//commands/trpg/r.js
const { ApplicationCommandOptionType } = require('discord.js');
const { rollDiceR } = require('../../utils/trpgManager/cocManager/dice.js'); 

module.exports = {
    name: "r",
    description: "擲骰並計算複雜的結果 (例如: 1d8+3-2, 2d6+5+1)",
    permissions: "0x0000000000000800",

    options: [
        {
            name: 'expression',
            description: '擲骰表示法 (例如: 1d8+3-2, 2d6+5+1)',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ],

    run: async (client, interaction, lang) => {
        const expression = interaction.options.getString('expression');
        await rollDiceR(interaction, expression); // 呼叫擲骰邏輯
    },
};
