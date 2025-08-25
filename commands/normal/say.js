//commands/normal/say.js
const { 
    ApplicationCommandOptionType,
    ChannelType 
} = require('discord.js');
const config = require("../../config.js");

module.exports = {
  name: "say",
  description: "將訊息發送到指定頻道 (開發者)",
  permissions: "0x0000000000000800",
  options: [
    {
      name: "channel",
      description: "選擇要發送訊息的頻道",
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
      required: true,
    },
    {
      name: "message",
      description: "要發送的訊息內容",
      type: ApplicationCommandOptionType.String, // 選項類型為字串
      required: true,
    }
  ],
  run: async (client, interaction, lang) => {
    try {
      // 1. 檢查使用者ID是否為開發者ID
      if (!config.ownerID.includes(interaction.user.id)) {
        return interaction.reply({
          content: "❌ 你沒有權限使用此指令。",
          ephemeral: true
        });
      }

      // 2. 從選項中獲取目標頻道和訊息內容
      const targetChannel = interaction.options.getChannel('channel');
      const messageToSend = interaction.options.getString('message');

      // 檢查訊息是否為空 (雖然 required: true 已經擋掉，但多一層保險)
      if (!messageToSend) {
        return interaction.reply({
            content: "❌ 訊息內容不能為空。",
            ephemeral: true
        });
      }

      // 3. 將訊息發送到指定的頻道
      await targetChannel.send(messageToSend);

      // 4. 回覆使用者，告知訊息已成功發送
      await interaction.reply({
        content: `✅ 訊息已成功發送到 ${targetChannel.toString()}`,
        ephemeral: true
      });

    } catch (e) {
      console.error(e);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `執行此命令時發生錯誤: ${e.message}`,
          ephemeral: true
        }).catch(err => console.error("無法回應互動:", err));
      }
    }
  },
};