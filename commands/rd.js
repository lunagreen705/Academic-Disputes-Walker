const { EmbedBuilder } = require('discord.js'); // 根據需要引入 EmbedBuilder
const config = require("../config.js"); // 假設你需要 config 檔案

module.exports = {
    name: "rd", // 指令名稱
    description: "擲一個指定面數的骰子。", // 指令的簡短描述
    permissions: "0x0000000000000800", // 這裡你可以根據你的需求設定權限，如果不需要可以移除
    options: [], // **注意：** 在這種格式下，這個 'options' 陣列不會被 Discord 自動識別為斜線指令的選項。你需要在 run 函式中手動解析參數。

    // 指令的執行部分，當用戶使用 /rd 指令時會運行這裡的程式碼
    run: async (client, interaction, lang) => { // 這裡假設你的 run 函式會接收 client, interaction 和 lang
        try {
            // 從 interaction 的參數中獲取數字
            // **重要：** 因為沒有 SlashCommandBuilder，這裡不能直接用 interaction.options.getInteger。
            // 你需要從 interaction 的內容中手動解析。
            // 對於 `/rd 100` 這樣的指令，你需要一個額外的步驟來獲取 `100`。
            // 最簡單的方法是假設用戶只輸入一個數字作為選項，並嘗試從 interaction.options.getString('選項名稱') 獲取。
            // 但如果你的 bot.js 不支援解析這種舊格式指令的選項，這會很麻煩。

            // 為了簡化並解決你先前的 `ReferenceError: roll is not defined` 錯誤，
            // 這裡我直接假設 `interaction.options.getString('sides')` 是可用的，
            // 但這需要你的 bot.js 在載入時能夠將 `options` 傳遞給 Discord API，
            // 並且 Discord API 能正確處理這種「非 SlashCommandBuilder」格式的選項定義。
            // **如果這個部分導致新的問題，那麼就必須轉換為 SlashCommandBuilder 格式。**
            const numSidesString = interaction.options.getString('sides'); // 假設你的 bot.js 能夠這樣傳遞選項
            const numSides = parseInt(numSidesString, 10); // 將字串轉換為整數

            // 簡單的輸入驗證
            if (isNaN(numSides) || numSides <= 0 || numSides > 10000) {
                return interaction.reply({
                    content: '請輸入一個 1 到 10000 之間的有效數字作為骰子面數。',
                    ephemeral: true // 只有指令使用者看得到這條回覆
                });
            }

            // 擲骰子邏輯
            const roll = Math.floor(Math.random() * numSides) + 1;

            // 回覆結果給用戶
            // 這裡可以仿效 ping.js 使用 EmbedBuilder
            const embed = new EmbedBuilder()
                .setColor(config.embedColor || '#0099ff') // 使用 config.embedColor 或預設值
                .setTitle(`🎲 擲骰結果 (d${numSides})`)
                .setDescription(`你擲出了：**${roll}**`);

            await interaction.reply({ embeds: [embed] });

        } catch (e) {
            console.error('執行 /rd 指令時發生錯誤:', e);
            await interaction.reply({
                content: '執行指令時發生錯誤。請稍後再試。',
                ephemeral: true
            });
        }
    },
};
