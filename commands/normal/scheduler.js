const { EmbedBuilder } = require('discord.js');
const schedulerManager = require('../../utils/normal/schedulerManager'); 
const config = require("../../config.js");

module.exports = {
  name: "task",
  description: "設定或管理您的個人排程提醒",
  permissions: "0x0000000000000800",
  options: [
    {
      name: 'set',
      description: '設定一個簡單的個人提醒',
      type: 1, // SUB_COMMAND
      options: [
        { name: 'message', description: '您想要提醒的內容', type: 3, required: true },
        { 
          name: 'when', 
          description: '什麼時候提醒您？例如: "明天早上9點", "10分鐘後", "每週三 20:30"', 
          type: 3, 
          required: true 
        },
      ]
    },
    {
      name: 'list',
      description: '列出您設定的所有提醒',
      type: 1, // SUB_COMMAND
    },
    {
      name: 'delete',
      description: '刪除您的一個提醒',
      type: 1, // SUB_COMMAND
      options: [
        { name: 'id', description: '要刪除的提醒 ID (可從 /task list 中查看)', type: 3, required: true }
      ]
    }
  ],

  run: async (client, interaction) => {
    const subcommand = interaction.options.getSubcommand();
    const { user } = interaction;

    try {
      switch (subcommand) {
        case 'set':
          await handleSet(interaction, user.id);
          break;
        case 'list':
          await handleList(interaction, user.id);
          break;
        case 'delete':
          await handleDelete(interaction, user.id);
          break;
      }
    } catch (e) {
      console.error("[Task Command Error]", e);
      const errorReply = { content: "執行指令時發生未預期的錯誤。", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorReply).catch(() => {});
      } else {
        await interaction.reply(errorReply).catch(() => {});
      }
    }
  },
};

// =================================================================
//                 指令處理邏輯 (Helper Functions)
// =================================================================

/**
 * 核心：解析使用者輸入的自然語言時間
 * @param {string} whenStr - 使用者輸入的時間字串
 * @returns {string|null} - 解析成功則回傳 Cron 表達式，否則回傳 null
 */
function parseWhenToCron(whenStr) {
    const now = new Date();
    let targetDate = new Date();

    // --- 處理相對時間 ---
    const inMinutesMatch = whenStr.match(/(\d+)\s*分鐘後/);
    if (inMinutesMatch) {
        const minutesLater = parseInt(inMinutesMatch[1], 10);
        targetDate.setMinutes(now.getMinutes() + minutesLater);
        return `${targetDate.getMinutes()} ${targetDate.getHours()} ${targetDate.getDate()} ${targetDate.getMonth() + 1} *`;
    }

    // --- 處理關鍵字和時間 ---
    let hour = -1, minute = 0;
    const timeMatch = whenStr.match(/(\d{1,2})[:：](\d{1,2})/);
    if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        minute = parseInt(timeMatch[2], 10);
    } else {
        const hourMatch = whenStr.match(/(\d{1,2})\s*點/);
        if(hourMatch) hour = parseInt(hourMatch[1], 10);
    }

    if (whenStr.includes('早上') && hour < 12) { /* 符合 */ }
    else if (whenStr.includes('下午') && hour < 12) { hour += 12; }
    else if (whenStr.includes('晚上') && hour < 12) { hour += 12; }

    if (hour === -1) return null; // 找不到有效的時間點

    // --- 處理重複性 ---
    if (whenStr.startsWith('每天')) {
        return `${minute} ${hour} * * *`;
    }
    const weeklyMatch = whenStr.match(/每週([一二三四五六日])/);
    if (weeklyMatch) {
        const dayOfWeekMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
        const dayOfWeek = dayOfWeekMap[weeklyMatch[1]];
        return `${minute} ${hour} * * ${dayOfWeek}`;
    }

    // --- 處理一次性任務 ---
    if (whenStr.includes('明天')) {
        targetDate.setDate(now.getDate() + 1);
    } else if (!whenStr.includes('今天')) {
        // 如果沒有指定日期，且時間已過，則預設為明天
        if (hour < now.getHours() || (hour === now.getHours() && minute <= now.getMinutes())) {
            targetDate.setDate(now.getDate() + 1);
        }
    }
    
    return `${minute} ${hour} ${targetDate.getDate()} ${targetDate.getMonth() + 1} *`;
}


async function handleSet(interaction, userId) {
  const { client, options } = interaction;
  await interaction.deferReply({ ephemeral: true });

  const message = options.getString('message');
  const whenStr = options.getString('when');
  
  const cronExpression = parseWhenToCron(whenStr);

  if (!cronExpression) {
    return interaction.followUp({ 
        content: '❌ 無法理解您輸入的時間格式。\n請試試看：`10分鐘後`, `明天早上9點`, `每天晚上10:30` 或 `每週五 20:00`',
        ephemeral: true
    });
  }

  const taskConfig = {
    id: `task-${userId.slice(-6)}-${Date.now()}`, // 自動產生一個簡短不重複的ID
    name: message.length > 30 ? message.substring(0, 27) + '...' : message,
    cronExpression: cronExpression,
    action: 'sendDirectMessage', // 固定為私訊提醒
    enabled: true,
    timezone: 'Asia/Taipei',
    userId: userId,
    args: {
      message: `⏰ **排程提醒**：\n\n>>> ${message}`
    }
  };

  const success = await schedulerManager.addOrUpdateTask(client, client.taskActionFunctions, taskConfig);
  
  if (success) {
      const successEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ 提醒設定成功！')
        .setDescription(`我將會透過私訊提醒您：\n> ${message}`)
        .addFields(
            { name: '觸發時間', value: `\`${whenStr}\``, inline: true },
            { name: '提醒ID', value: `\`${taskConfig.id}\``, inline: true }
        )
        .setFooter({ text: '您可以使用 /task delete 來刪除這個提醒' });
      await interaction.followUp({ embeds: [successEmbed], ephemeral: true });
  } else {
      await interaction.followUp({ content: '❌ 操作失敗，請稍後再試。', ephemeral: true });
  }
}

async function handleList(interaction, userId) {
  // 只列出使用者自己的任務
  const allTasks = schedulerManager.getAllTasks(userId);
  const userTasks = allTasks.filter(task => task.userId === userId);

  if (userTasks.length === 0) {
    return interaction.reply({ content: 'ℹ️ 您目前沒有設定任何個人提醒。', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(config.embedColor)
    .setAuthor({ name: `${interaction.user.username} 的個人提醒` })
    .setDescription('以下是您設定的所有排程提醒。');

  userTasks.forEach(task => {
    embed.addFields({
      name: `${task.enabled ? '🟢' : '🔴'} ${task.name}`,
      value: `ID: \`${task.id}\`\n動作: \`${task.action}\``,
    });
  });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDelete(interaction, userId) {
  const { client, options } = interaction;
  const taskId = options.getString('id');
  await interaction.deferReply({ ephemeral: true });
  
  const success = await schedulerManager.deleteTask(client, client.taskActionFunctions, taskId, userId);
  await interaction.followUp({ content: success ? `✅ 提醒 \`${taskId}\` 已成功刪除。` : `❌ 操作失敗，找不到該提醒或您無權刪除。`, ephemeral: true });
}