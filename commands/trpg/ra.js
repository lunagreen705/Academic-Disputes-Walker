const { ApplicationCommandOptionType } = require('discord.js');
const { rollAbilityRa } = require('../../utils/trpgManager/cocManager/dice.js'); 

module.exports = {
    name: "ra",
    description: "技能檢定 (d100擲骰與目標值比較)",
    permissions: "0x0000000000000800",

    options: [
        {
            name: 'skill',
            description: '技能名稱',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'target',
            description: '目標數值 (0-100)',
            type: ApplicationCommandOptionType.Integer,
            required: true,
        }
    ],

    run: async (client, interaction, lang) => {
        const skillName = interaction.options.getString('skill');
        const targetValue = interaction.options.getInteger('target');
        await rollAbilityRa(interaction, skillName, targetValue);
    },
};
