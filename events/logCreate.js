// ./events/logCreate.js

const logModule = require("../utils/trpgManager/logManager"); // 引入日誌模組，請確保路徑正確

// 定義日誌指令的前綴
const LOG_PREFIX = "log";
const DOT_PREFIX = "/";

module.exports = {
    name: 'messageCreate',
    /**
     * @param {import('discord.js').Client} client
     * @param {import('discord.js').Message} message
     */
    async execute(client, message) {
        // --- 基本的防禦性檢查 ---
        // 忽略來自機器人的指令請求，但允許記錄其發出的嵌入面板
        if (message.author.bot) return;
        // 忽略私訊
        if (!message.inGuild()) return;

        // ========================================================
        // ===            步驟 1: 傳遞訊息給日誌記錄器            ===
        // ========================================================
        // 記錄器內部會自行判斷該伺服器是否處於記錄狀態
        // 這一部分會記錄所有非機器人的訊息
        await logModule.recordMessage(message);
        // ========================================================


        // ========================================================
        // ===            步驟 2: 解析並執行日誌指令            ===
        // ========================================================
        const contentLower = message.content.toLowerCase();
        const isLogCommand = contentLower.startsWith(LOG_PREFIX + ' ');
        const isDotCommand = contentLower.startsWith(DOT_PREFIX);

        // 如果不是日誌相關指令，則直接結束，不繼續處理
        if (!isLogCommand && !isDotCommand) return;
        
        // --- 指令解析邏輯 ---
        if (isLogCommand) {
            // 處理 'log ...' 格式，例如 "log new 我的日誌"
            const args = message.content.slice(LOG_PREFIX.length).trim().split(/ +/);
            // 直接呼叫 handleLogCommand
            await logModule.handleLogCommand(message, args);
            return; // 處理完畢，結束
        }

        if (isDotCommand) {
            // 處理 '.' 前綴格式，例如 ".log end" 或 ".stat log"
            const args = message.content.slice(DOT_PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            // 處理複合指令
            if ((command === 'log' && args[0] === 'end')) {
                // 將 '.log end' 轉換為 handleLogCommand(message, ['end'])
                await logModule.handleLogCommand(message, ['end']);
                return; // 處理完畢，結束
            }
            if ((command === 'stat' && args[0] === 'log')) {
                // 將 '.stat log <名稱>' 轉換為 handleLogCommand(message, ['stat', '<名稱>'])
                const logName = args.slice(1).join(' ');
                await logModule.handleLogCommand(message, ['stat', logName]);
                return; // 處理完畢，結束
            }
        }
        // ========================================================
    }
};
