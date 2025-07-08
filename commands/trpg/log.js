const { EmbedBuilder, PermissionFlagsBits } = require('discord.js'); // 【修正點 1】重新引入 PermissionFlagsBits
const logModule = require('../../utils/trpgManager/logManager'); // 根據您的結構調整路徑
const config = require('../../config');

module.exports = {
    name: 'log',
    description: 'TRPG 日誌記錄相關指令。',
    options: [
        {
            name: 'new',
            description: '✅ 新建一份日誌，並且開始記錄。',
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: 'log-name',
                    description: '新日誌的名稱。',
                    type: 3, // STRING
                    required: true,
                },
            ],
        },
        {
            name: 'on',
            description: '▶️ 繼續記錄指定的日誌。',
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: 'log-name',
                    description: '要繼續記錄的日誌名稱（可選，預設為當前日誌）。',
                    type: 3, // STRING
                    required: false,
                },
            ],
        },
        {
            name: 'off',
            description: '⏸️ 暫停記錄當前日誌。',
            type: 1, // SUB_COMMAND
        },
        {
            name: 'halt',
            description: '⏹️ 停止記錄當前日誌。',
            type: 1, // SUB_COMMAND
        },
        {
            name: 'end',
            description: '🔚 停止記錄並產生染色器連結。',
            type: 1, // SUB_COMMAND
        },
        {
            name: 'list',
            description: '📄 列出本群的所有日誌記錄。',
            type: 1, // SUB_COMMAND
        },
        {
            name: 'get',
            description: '🔗 重新獲取指定日誌的渲染器連結。',
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: 'log-name',
                    description: '要獲取連結的日誌名稱。',
                    type: 3, // STRING
                    required: true,
                },
            ],
        },
        {
            name: 'del',
            description: '🗑️ 刪除指定的日誌。',
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: 'log-name',
                    description: '要刪除的日誌名稱。',
                    type: 3, // STRING
                    required: true,
                },
            ],
        },
        {
            name: 'stat',
            description: '📊 統計指定日誌的數據。',
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: 'log-name',
                    description: '要統計的日誌名稱（可選，預設為當前日誌）。',
                    type: 3, // STRING
                    required: false,
                },
            ],
        },
        {
            name: 'export',
            description: '📄 將指定的日誌匯出成 .docx 檔案。',
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: 'log-name',
                    description: '要匯出的日誌名稱。',
                    type: 3, // STRING
                    required: true,
                },
            ],
        },
    ],

    /**
     * 執行斜線指令的函數
     * @param {import('discord.js').Client} client
     * @param {import('discord.js').CommandInteraction} interaction
     * @param {object} lang - 語言文件
     */
    run: async (client, interaction, lang) => {
        // 【修正點 2】修正後的權限檢查邏輯
        const isOwner = config.ownerID.includes(interaction.user.id);
        const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

        // 如果使用者既不是擁有者，也沒有管理訊息的權限，則拒絕
        if (!isOwner && !hasPermission) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('❌ 您需要「管理訊息」權限或為機器人擁有者才能使用此指令。')
                ],
                ephemeral: true,
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const logName = interaction.options.getString('log-name') || null;
        
        const sourceAdapter = {
            guild: interaction.guild,
            channel: interaction.channel,
            user: interaction.user,
            interaction: interaction,
        };

        // 確保等待後端模組執行完畢
        await logModule.handleLogCommand(sourceAdapter, [subcommand, logName].filter(n => n !== null));
    }
};