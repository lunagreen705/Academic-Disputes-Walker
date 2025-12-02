module.exports = {
    name: 'messageCreate', 
    async execute(client, message) {
        if (message.author.bot) return;
        const PREFIX = '隨機'; 
        const content = message.content.trim();

        // 快速判斷，如果不以指定前綴開始，立即退出。
        if (!content.startsWith(PREFIX)) return;

        // --- 核心隨機選擇邏輯 ---

        // 2. 【極限壓縮】切片、去除前綴、分割多個空格、濾掉空值。O(N) 輸入處理。
        // content.slice(PREFIX.length) -> 截掉 '!選'
        // .trim() -> 去除多餘空格
        // .split(/\s+/) -> 用正則表達式分割，處理多個空格為分隔符
        // .filter(Boolean) -> 濾掉切割後可能產生的空字串 (e.g., "a  b" -> ["a", "", "b"] -> ["a", "b"])
        const choices = content.slice(PREFIX.length).trim().split(/\s+/).filter(Boolean);

        // 3. 【防呆】選項數量檢查。低於兩個，直接報錯。
        if (choices.length < 2) {
            // 不用 try...catch，這種本地運算不會拋出網路異常。
            await message.reply('**[ERROR]** 候選名單項目太少。你讓我選空氣嗎？');
            return;
        }

        // 4. 【O(1) 核心運算】執行隨機選擇。
        const choice = choices[Math.floor(Math.random() * choices.length)];

        const replyMessage = `
**[RNG-COMPLETED]** 學術糾紛奧術核心計算已完成。
候選名單：\`${choices.join(', ')}\`
最終選擇：**🎯 ${choice}**
        `.trim();
        
        await message.reply(replyMessage);
        
    }
};