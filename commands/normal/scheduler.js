const { EmbedBuilder } = require('discord.js');
// 假設您的 manager 已經更新以支援使用者ID
const schedulerManager = require('../../utils/normal/schedulerManager'); 

module.exports = {
    // data 部分已更新，移除了管理員權限和 'reload' 子指令
    data: new SlashCommandBuilder()
        .setName('task') // 將指令名稱改為更貼近個人任務的 'task' 或 'reminder'
        .setDescription('管理您的個人排程任務')
        .setDMPermission(true) // 個人任務應允許在私訊中使用

        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('列出您所有的個人排程任務')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('檢視您某個排程任務的詳細資訊')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('要檢視的任務 ID')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('新增或更新您的個人排程任務')
                .addStringOption(option => option.setName('id').setDescription('任務的唯一 ID (在您的任務中需唯一)').setRequired(true))
                .addStringOption(option => option.setName('name').setDescription('任務的顯示名稱').setRequired(true))
                .addStringOption(option => option.setName('cron').setDescription('任務的 Cron 表達式 (e.g., "0 9 * * *")').setRequired(true))
                .addStringOption(option => option.setName('action').setDescription('要執行的動作名稱').setRequired(true))
                .addBooleanOption(option => option.setName('enabled').setDescription('是否啟用此任務 (預設為 true)'))
                .addStringOption(option => option.setName('args').setDescription('任務函式需要的參數 (JSON 格式)'))
                .addStringOption(option => option.setName('timezone').setDescription('任務的時區 (e.g., "Asia/Taipei")'))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('刪除您的一個個人排程任務')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('要刪除的任務 ID')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const { client, user } = interaction; // 取得使用者物件
        if (!client.taskActionFunctions) {
            return interaction.reply({
                content: '❌ 錯誤：機器人設定不完整，無法執行任務。',
                ephemeral: true,
            });
        }
        
        const subcommand = interaction.options.getSubcommand();

        try {
            // 所有處理函式都傳入 user.id 進行驗證
            switch (subcommand) {
                case 'list':
                    await handleList(interaction, user.id);
                    break;
                case 'view':
                    await handleView(interaction, user.id);
                    break;
                case 'set':
                    await handleSet(interaction, user.id, client.taskActionFunctions);
                    break;
                case 'delete':
                    await handleDelete(interaction, user.id, client.taskActionFunctions);
                    break;
            }
        } catch (error) {
            console.error(`[Personal Task Command] 執行指令時發生錯誤:`, error);
            const replyOptions = { content: `❌ 執行指令時發生未預期的錯誤: ${error.message}`, ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(replyOptions);
            } else {
                await interaction.reply(replyOptions);
            }
        }
    },
};


// --- 處理函式 (已更新以包含 userId 邏輯) ---

async function handleList(interaction, userId) {
    const allTasks = schedulerManager.getAllTasks();
    const userTasks = allTasks.filter(task => task.userId === userId); // 只過濾出該使用者的任務

    if (userTasks.length === 0) {
        return interaction.reply({ content: 'ℹ️ 您目前沒有設定任何個人排程任務。', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle(`🗓️ ${interaction.user.username} 的排程任務`)
        .setColor('#0099ff')
        .setTimestamp();

    userTasks.forEach(task => {
        embed.addFields({
            name: `${task.enabled ? '🟢' : '🔴'} ${task.name} (\`${task.id}\`)`,
            value: `表达式: \`${task.cronExpression}\`\n动作: \`${task.action}\``,
        });
    });

    await interaction.reply({ embeds: [embed] });
}

async function handleView(interaction, userId) {
    const taskId = interaction.options.getString('id');
    const task = schedulerManager.getTask(taskId);

    // !! 關鍵安全檢查 !!
    if (!task || task.userId !== userId) {
        return interaction.reply({ content: `🔍 找不到 ID 為 \`${taskId}\` 的任務，或您沒有權限檢視它。`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle(`📝 任務詳情: ${task.name}`)
        .setColor(task.enabled ? '#57F287' : '#ED4245')
        .addFields(
            // ... 欄位內容與之前相同
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleSet(interaction, userId, taskActionFunctions) {
    await interaction.deferReply({ ephemeral: true });

    const taskConfig = {
        id: interaction.options.getString('id'),
        name: interaction.options.getString('name'),
        cronExpression: interaction.options.getString('cron'),
        action: interaction.options.getString('action'),
        enabled: interaction.options.getBoolean('enabled') ?? true,
        timezone: interaction.options.getString('timezone') || 'Asia/Taipei',
        userId: userId, // !! 將使用者 ID 綁定到任務配置中 !!
    };

    const argsString = interaction.options.getString('args');
    if (argsString) {
        try {
            taskConfig.args = JSON.parse(argsString);
        } catch (e) {
            return interaction.followUp({ content: `❌ 參數 (args) 格式錯誤，必須是有效的 JSON 字串。` });
        }
    }

    // !! 假設 manager 的函式已更新 !!
    const success = await schedulerManager.addOrUpdateTask(taskConfig, taskActionFunctions);

    if (success) {
        await interaction.followUp({ content: `✅ 您的任務 \`${taskConfig.id}\` 已成功儲存。` });
    } else {
        await interaction.followUp({ content: '❌ 操作失敗。請檢查主控台的錯誤日誌。' });
    }
}

async function handleDelete(interaction, userId, taskActionFunctions) {
    const taskId = interaction.options.getString('id');
    await interaction.deferReply({ ephemeral: true });
    
    // !! 假設 manager 的函式已更新，需要傳入 userId 進行驗證 !!
    const success = await schedulerManager.deleteTask(taskId, userId, taskActionFunctions);

    if (success) {
        await interaction.followUp({ content: `✅ 您的任務 \`${taskId}\` 已成功刪除。` });
    } else {
        await interaction.followUp({ content: `❌ 操作失敗。找不到任務 \`${taskId}\`，您沒有權限刪除它，或無法將變更推送到 GitHub。` });
    }
}