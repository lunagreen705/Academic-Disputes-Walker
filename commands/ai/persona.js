const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const personaManager = require('../../utils/ai/personaManager.js');
const config = require('../../config.js');

module.exports = {
  name: '人格面具',
  description: '切換學術糾紛人格',
  permissions: '0x0000000000000800',

  options: [
    {
      name: 'persona',
      description: '選擇你想切換到的人格',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: '冷靜理性密大教授', value: 'default' },
        { name: '傲嬌女僕', value: 'sultry' },
        { name: '無道德攝影機', value: 'camera' },
        { name: '貼吧老哥', value: 'bro' },
         { name: '惡作劇蘿莉', value: 'loli' },
          { name: '中二少女', value: 'chuunibyou' },
             { name: '慵懶腹黑大姐姐', value: 'niconico' },
      ],
    },
  ],

  run: async (client, interaction, lang) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const userId = interaction.user.id;
      const guildId = interaction.guildId;

      // ✅ 僅 bot 擁有者可以切換
      if (!config.ownerID.includes(userId)) {
        const noPermEmbed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('🚫 權限不足')
          .setDescription('只有機器人的主人才能切換人格。');
        return await interaction.editReply({ embeds: [noPermEmbed] });
      }

      const selectedPersona = interaction.options.getString('persona');

      // ✅ 儲存人格以 guild 為單位
      personaManager.setPersona(guildId, selectedPersona);

      const embed = new EmbedBuilder()
        .setColor(config.embedColor || '#00ff99')
        .setTitle('🧠 人格切換成功')
        .setDescription(`此伺服器的人格已切換為：**${selectedPersona}**`);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('執行 /人格面具 指令時發生錯誤:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ 指令錯誤')
        .setDescription('切換人格時發生錯誤，請稍後再試。');

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
};