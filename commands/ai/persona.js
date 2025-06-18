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
      description: '選擇你想切換到的人格（例如 default、sultry）',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: '冷靜理性密大教授', value: 'default' },
        { name: '高情商女僕', value: 'sultry' },
        { name: '沒有道德攝影機', value: 'camera' },
        { name: '貼吧老哥', value: 'bro' },
      ],
    },
  ],

  run: async (client, interaction, lang) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const userId = interaction.user.id;

      // ✅ 檢查是否為 bot owner（從 config 讀取）
      if (!config.ownerID.includes(userId)) {
        const noPermEmbed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('🚫 權限不足')
          .setDescription('只有機器人的主人才能切換人格。');

        return await interaction.editReply({ embeds: [noPermEmbed] });
      }

      const selectedPersona = interaction.options.getString('persona');

      personaManager.setPersona(userId, selectedPersona);

      const embed = new EmbedBuilder()
        .setColor(config.embedColor || '#00ff99')
        .setTitle('🧠 人格切換成功')
        .setDescription(`已成功將你的 AI 人格切換為：**${selectedPersona}**。`);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('執行 /人格面具 指令時發生錯誤:', error);

      // 判斷是否已回覆或延遲回覆
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('❌ 指令錯誤')
              .setDescription('切換人格時發生錯誤，請稍後再試。'),
          ],
        });
      } else {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('❌ 指令錯誤')
              .setDescription('切換人格時發生錯誤，請稍後再試。'),
          ],
          ephemeral: true,
        });
      }
    }
  },
};
