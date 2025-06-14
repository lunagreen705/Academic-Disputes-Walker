const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
  name: 'guilds',
  description: '列出伺服器或讓機器人離開某個伺服器',
  options: [
    {
      name: 'list',
      description: '列出目前機器人加入的所有伺服器',
      type: 1, // SUB_COMMAND
    },
    {
      name: 'leave',
      description: '讓機器人離開指定的伺服器',
      type: 1, // SUB_COMMAND
      options: [
        {
          name: 'guild_id',
          description: '要離開的伺服器 ID',
          type: 3, // STRING
          required: true,
        },
      ],
    },
  ],

  run: async (client, interaction) => {
    const subCommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (!config.ownerID.includes(userId)) {
      return interaction.reply({
        content: '❌ 只有機器人擁有者才能使用這個指令。',
        ephemeral: true,
      });
    }

    if (subCommand === 'list') {
      const guilds = client.guilds.cache.map((guild) => {
        return `📛 **${guild.name}** | 🆔 \`${guild.id}\``;
      });

      return interaction.reply({
        content: `🤖 機器人目前在以下 ${guilds.length} 個伺服器中：\n\n${guilds.join('\n')}`,
        ephemeral: true,
      });
    }

    if (subCommand === 'leave') {
      const guildId = interaction.options.getString('guild_id');
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return interaction.reply({
          content: `❌ 找不到 ID 為 \`${guildId}\` 的伺服器，請確認是否輸入錯誤。`,
          ephemeral: true,
        });
      }

      try {
        await guild.leave();
        return interaction.reply({
          content: `👋 已成功離開伺服器：**${guild.name}** (\`${guildId}\`)`,
          ephemeral: true,
        });
      } catch (err) {
        return interaction.reply({
          content: `⚠️ 離開失敗：${err.message}`,
          ephemeral: true,
        });
      }
    }
  },
};
