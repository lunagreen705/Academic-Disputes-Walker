const { EmbedBuilder } = require('discord.js');
const logModule = require('../../utils/trpgManager/logManager'); // 根據您的結構調整路徑
const config = require('../../config'); // 【修改點 1】引入設定檔

module.exports = {
    name: 'log',
    description: 'TRPG 日誌記錄相關指令 (僅限擁有者)。', // 修改描述以反映權限
    // 遵循您的架構，使用物件陣列來定義選項
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
    ],

    /**
     * 執行斜線指令的函數
     * @param {import('discord.js').Client} client
     * @param {import('discord.js').CommandInteraction} interaction
     * @param {object} lang - 語言文件
     */
    run: async (client, interaction, lang) => {
        // 【修改點 2】將權限檢查改為擁有者 ID 檢查
        if (!config.ownerID.includes(interaction.user.id)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('❌ 只有機器人擁有者才能使用這個指令。')
                ],
                ephemeral: true,
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const logName = interaction.options.getString('log-name') || null;
        
        // 建立一個適配器 (adapter)，讓 logModule 可以統一處理來自不同來源的請求
        const sourceAdapter = {
            guild: interaction.guild,
            channel: interaction.channel,
            user: interaction.user,
            interaction: interaction, // 將 interaction 傳入，方便 logModule 進行複雜的回覆
        };

        // 將子指令和參數傳遞給我們統一的處理器
        // logModule 內部會處理回覆，因此這裡不需要再 await
        logModule.handleLogCommand(sourceAdapter, [subcommand, logName].filter(n => n !== null));
    }
};
