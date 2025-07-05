const { 
    ModalBuilder, 
    TextInputBuilder, 
    ActionRowBuilder, 
    TextInputStyle, 
    ApplicationCommandOptionType,
    ChannelType 
} = require('discord.js');
const config = require("../../config.js");

module.exports = {
  name: "say",
  description: "透過輸入框將訊息發送到指定頻道 (僅限開發者)",
  permissions: "0x0000000000000800",
  options: [
    {
      name: "channel",
      description: "選擇要發送訊息的頻道",
      type: ApplicationCommandOptionType.Channel, // 選項類型為頻道
      channelTypes: [ChannelType.GuildText], // 限制只能選擇文字頻道
      required: true,
    },
  ],
  run: async (client, interaction, lang) => {
    try {
      // 1. 檢查使用者ID是否為開發者ID
   if (!config.ownerID.includes(interaction.user.id)) {
        return interaction.reply({
          content: "❌ 你沒有權限使用此指令。",
          ephemeral: true // 僅有該使用者可見
        }).catch(e => console.error(e));
      }

      // 從指令選項中獲取目標頻道
      const targetChannel = interaction.options.getChannel('channel');

      // 2. 建立一個 Modal (彈出式輸入框)
      const modal = new ModalBuilder()
        .setCustomId(`say-modal-${interaction.id}`) // 給 Modal 一個唯一的 ID
        .setTitle(`發送到 #${targetChannel.name}`);

      // 3. 建立一個文字輸入框
      const messageInput = new TextInputBuilder()
        .setCustomId('message-input')
        .setLabel("請輸入要發送的訊息內容")
        .setStyle(TextInputStyle.Paragraph) // Paragraph 樣式支援多行文字
        .setPlaceholder("在這裡輸入訊息...")
        .setRequired(true);

      // 4. 將文字輸入框加到 Modal 中
      // 每個 ActionRow 只能放一個 TextInput
      const actionRow = new ActionRowBuilder().addComponents(messageInput);
      modal.addComponents(actionRow);

      // 5. 對使用者顯示 Modal
      await interaction.showModal(modal);

      // 6. 等待使用者提交 Modal
      // 設置 5 分鐘的等待時間 (300000 毫秒)
      const modalSubmit = await interaction.awaitModalSubmit({ 
        time: 300000,
        filter: i => i.customId === `say-modal-${interaction.id}` && i.user.id === interaction.user.id,
      }).catch(err => {
        // 如果使用者沒有在時間內提交，會觸發 catch
        console.log("Modal submit timeout.");
        return null;
      });

      // 如果沒有成功提交 (例如超時)
      if (!modalSubmit) {
        return; // 直接結束
      }

      // 7. 獲取使用者在 Modal 中輸入的內容
      const messageToSend = modalSubmit.fields.getTextInputValue('message-input');

      // 8. 將訊息發送到指定的頻道
      await targetChannel.send(messageToSend);

      // 9. 回覆使用者，告知訊息已成功發送
      await modalSubmit.reply({
        content: `✅ 訊息已成功發送到 ${targetChannel.toString()}`,
        ephemeral: true
      });

    } catch (e) {
      console.error(e);
      // 如果過程中發生任何錯誤，嘗試回覆一個錯誤訊息
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `執行此命令時發生錯誤: ${e.message}`,
          ephemeral: true
        }).catch(err => console.error("無法回應互動:", err));
      }
    }
  },
};