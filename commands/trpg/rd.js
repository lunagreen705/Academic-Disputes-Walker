const { ApplicationCommandOptionType } = require('discord.js');
const { rollDiceRd } = require('../../utils/trpgManager/cocManager/dice.js'); 

module.exports = {
    name: "rd",
    description: "擲一顆骰子 (例如: /rd 20 代表擲 d20)",
    permissions: "0x0000000000000800",

    options: [
        {
            name: 'num',
            description: '骰子面數 (1-10000)',
            type: ApplicationCommandOptionType.String, // 你也可以用 Integer，但 String 可避免部分奇怪輸入
            required: true,
        }
    ],

    run: async (client, interaction, lang) => {
        const numSidesString = interaction.options.getString('num');
        await rollDiceRd(interaction, numSidesString);
    },
};
