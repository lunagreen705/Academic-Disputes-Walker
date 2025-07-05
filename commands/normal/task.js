const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const schedulerManager = require('../../utils/normal/schedulerManager'); 
const config = require("../../config.js");
const chrono = require('chrono-node');
const { randomUUID } = require('crypto');

// 在模組頂層建立，供所有函式重複使用，提升效能
const customChrono = chrono.zh.casual.clone();

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
      description: '刪除您的一個提醒 (可留空ID以使用互動式選單)',
      type: 1, // SUB_COMMAND
      options: [
        // ID 改為非必填，以支援互動式選單
        { name: 'id', description: '要刪除的提醒 ID (可從 /task list 中查看)', type: 3, required: false }
      ]
    },
    {
        name: 'toggle',
        description: '暫停或啟用一個提醒',
        type: 1, // SUB_COMMAND
    },
    {
        name: 'edit',
        description: '編輯一個現有的提醒',
        type: 1, // SUB_COMMAND
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
        case 'toggle':
        case 'edit': // edit 和 toggle 都使用選單，可以共用一個處理器
            await handleInteractiveMenu(interaction, user.id, subcommand);
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
//                         指令處理邏輯
// =================================================================

function parseWhenToCron(whenStr) {
    // 使用彈性的正規表示式
    if (/每天/.test(whenStr)) {
        const parsedResult = customChrono.parse(whenStr, new Date(), { forwardDate: true });
        if (!parsedResult || parsedResult.length === 0) return null;
        
        const hour = parsedResult[0].start.get('hour');
        const minute = parsedResult[0].start.get('minute');
        return `${minute} ${hour} * * *`;
    }
    const weeklyMatch = whenStr.match(/每(週|星期)([一二三四五六日])/);
    if (weeklyMatch) {
        const dayOfWeekMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
        const dayOfWeek = dayOfWeekMap[weeklyMatch[2]];
        
        const parsedResult = customChrono.parse(whenStr, new Date(), { forwardDate: true });
        if (!parsedResult || parsedResult.length === 0) return null;

        const hour = parsedResult[0].start.get('hour');
        const minute = parsedResult[0].start.get('minute');
        return `${minute} ${hour} * * ${dayOfWeek}`;
    }

    const results = customChrono.parse(whenStr, new Date(), { forwardDate: true });
    if (results.length === 0) return null;

    const targetDate = results[0].start.date();
    return `${targetDate.getMinutes()} ${targetDate.getHours()} ${targetDate.getDate()} ${targetDate.getMonth() + 1} *`;
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
        id: randomUUID().slice(0, 8), // 使用更穩定的 UUID
        name: message.length > 30 ? message.substring(0, 27) + '...' : message,
        cronExpression: cronExpression,
        action: 'sendDirectMessage',
        enabled: true,
        timezone: 'Asia/Taipei',
        userId: userId,
        args: { message: `⏰ **排程提醒**：\n\n>>> ${message}` }
    };

    const success = await schedulerManager.addOrUpdateTask(client, client.taskActionFunctions, taskConfig);
    
    if (success) {
        // --- 已按照您的要求修改成功訊息 ---
        const successEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ 提醒設定成功！')
            .setDescription(`學術糾紛將會透過私訊提醒您`);
        await interaction.followUp({ embeds: [successEmbed], ephemeral: true });
    } else {
        await interaction.followUp({ content: '❌ 操作失敗，請稍後再試。', ephemeral: true });
    }
}

async function handleList(interaction, userId) {
    // 已優化：直接從 schedulerManager 獲取該使用者的任務
    const userTasks = schedulerManager.getTasksByUserId(userId); 

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
            value: `ID: \`${task.id}\`\n排程: \`${task.cronExpression}\``, // 顯示cron表達式可能更有用
        });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDelete(interaction, userId) {
    const { client, options } = interaction;
    const taskId = options.getString('id');

    // 如果使用者直接提供了 ID，執行快速刪除
    if (taskId) {
        await interaction.deferReply({ ephemeral: true });
        const success = await schedulerManager.deleteTask(client, client.taskActionFunctions, taskId, userId);
        await interaction.followUp({ content: success ? `✅ 提醒 \`${taskId}\` 已成功刪除。` : `❌ 操作失敗，找不到該提醒或您無權刪除。`, ephemeral: true });
    } else {
        // 如果未提供 ID，則進入互動模式
        await handleInteractiveMenu(interaction, userId, 'delete');
    }
}

async function handleInteractiveMenu(interaction, userId, action) {
    const userTasks = schedulerManager.getTasksByUserId(userId);
    if (userTasks.length === 0) {
        return interaction.reply({ content: `ℹ️ 您沒有可${action === 'delete' ? '刪除' : action === 'toggle' ? '切換' : '編輯'}的提醒。`, ephemeral: true });
    }

    const actionVerb = { delete: '刪除', toggle: '切換啟用/暫停', edit: '編輯' };

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${action}-task-menu:${userId}`) // customId 包含動作和用戶ID
        .setPlaceholder(`請選擇要${actionVerb[action]}的提醒...`)
        .addOptions(
            userTasks.map(task => ({
                label: task.name.substring(0, 100),
                description: `ID: ${task.id}`,
                value: task.id,
                emoji: task.enabled ? '🟢' : '🔴' // 增加狀態圖示
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.reply({ content: `請從下方選單選擇您想${actionVerb[action]}的提醒：`, components: [row], ephemeral: true });

    // **重要提示**:
    // 這裡只負責發送選單。您需要在主程式的 interactionCreate 事件中監聽 customId
    // 為 'delete-task-menu', 'toggle-task-menu', 'edit-task-menu' 的互動，
    // 然後根據 value (也就是 taskId) 執行真正的刪除、切換或編輯邏輯。
}