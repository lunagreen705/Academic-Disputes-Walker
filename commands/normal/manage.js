// commands/normal/manage.js
const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
  name: 'manage',
  description: '伺服器管理',
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
    {
      name: 'test',
      description: '調試模式',
      type: 1, // SUB_COMMAND
      options: [
        {
          name: 'guild_id',
          description: '伺服器 ID',
          type: 3, // STRING
          required: true,
        },
      ],
    },
    {
      name: 'clear',
      description: '清除頻道前五條訊息',
      type: 1, // SUB_COMMAND
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

    if (subCommand === 'test') {
      const guildId = interaction.options.getString('guild_id');
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return interaction.reply({
          content: `❌ 找不到 ID 為 \`${guildId}\` 的伺服器，請確認是否輸入錯誤。`,
          ephemeral: true,
        });
      }

      try {
        const members = await guild.members.fetch();
        const names = members.map(m => m.user.tag);
        const list = names.join('\n');

        if (list.length > 2000) {
          return interaction.reply({
            content: `📜 **${guild.name}** 有 ${names.length} 名成員，太長無法完整顯示。`,
            ephemeral: true,
          });
        }

        return interaction.reply({
          content: `📜 **${guild.name}** 成員名單（${names.length}人）：\n${list}`,
          ephemeral: true,
        });
      } catch (err) {
        return interaction.reply({
          content: `⚠️ 無法取得成員名單：${err.message}，請確認已開啟 SERVER MEMBERS INTENT。`,
          ephemeral: true,
        });
      }
    }

    if (subCommand === 'clear') {
      try {
        const fetched = await interaction.channel.messages.fetch({ limit: 5 });
        await interaction.channel.bulkDelete(fetched, true);
        return interaction.reply({
          content: `🧹 已清除頻道前五條訊息。`,
          ephemeral: true,
        });
      } catch (err) {
        return interaction.reply({
          content: `⚠️ 清除訊息失敗：${err.message}`,
          ephemeral: true,
        });
      }
    }
  },
};