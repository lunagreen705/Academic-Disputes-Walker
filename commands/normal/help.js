const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require("../../config.js");
const musicIcons = require('../../UI/icons/musicicons.js');

// 遞迴抓指令 + 附上分類（來源資料夾）
function getCategorizedCommands(dir, category = "") {
  let results = {};

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat && stat.isDirectory()) {
      const subCategory = file;
      const subResults = getCategorizedCommands(fullPath, subCategory);
      for (const key in subResults) {
        results[key] = (results[key] || []).concat(subResults[key]);
      }
    } else if (file.endsWith('.js')) {
      try {
        const command = require(fullPath);
        if (!command.name) continue;

        const cmdLine = `\`/${command.name}\` - ${command.description || "（無描述）"}`;
        const catKey = category || "其他";

        if (!results[catKey]) results[catKey] = [];
        results[catKey].push(cmdLine);
      } catch (err) {
        console.warn(`⚠️ 無法載入指令：${fullPath}`);
      }
    }
  }

  return results;
}

module.exports = {
  name: "help",
  description: "取得機器人相關幫助",
  permissions: "0x0000000000000800",
  options: [],

  run: async (client, interaction, lang) => {
    try {
      const botName = client.user.username;
      const commandsRoot = path.join(__dirname, "../");

      const categorized = getCategorizedCommands(commandsRoot);
      const totalCommands = Object.values(categorized).reduce((sum, cmds) => sum + cmds.length, 0);

      const totalServers = client.guilds.cache.size;
      const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

      const uptime = process.uptime();
      const days = Math.floor(uptime / (3600 * 24));
      const hours = Math.floor((uptime % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      const ping = client.ws.ping;

      const embed = new EmbedBuilder()
        .setColor(config.embedColor || "#7289DA")
        .setTitle(lang.help.embed.title.replace("{botName}", botName))
        .setAuthor({
          name: lang.help.embed.author,
          iconURL: musicIcons.alertIcon,
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setDescription(lang.help.embed.description
          .replace("{botName}", botName)
          .replace("{totalCommands}", totalCommands)
          .replace("{totalServers}", totalServers)
          .replace("{totalUsers}", totalUsers)
          .replace("{uptimeString}", uptimeString)
          .replace("{ping}", ping)
        )
        .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
        .setTimestamp();

      // 🔍 為每一分類加入欄位
      for (const [category, commands] of Object.entries(categorized)) {
        embed.addFields({
          name: `📁 ${category}`,
          value: commands.join('\n'),
        });
      }

      return interaction.reply({ embeds: [embed] });

    } catch (e) {
      console.error("❌ /help 錯誤：", e);
      return interaction.reply({
        content: lang.help.embed.error,
        ephemeral: true,
      });
    }
  },
};
