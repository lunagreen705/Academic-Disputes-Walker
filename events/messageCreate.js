// your-discord-bot/events/messageCreate.js
const affectionManager = require('../utils/affectionManager'); // 引入好感度管理模組

// 直接導出一個異步函數
// 這個函數的參數會由 client.on 傳入，通常第一個是 client 物件本身，後面是事件的參數
// 對於 messageCreate 事件，它的參數是 (message)
// 但由於您在 bot.js 中使用了 event.bind(null, client)，這會把 client 綁定為第一個參數
// 所以這裡需要接收 (client, message)
module.exports = async (client, message) => { // 注意這裡接收 client 和 message
    if (message.author.bot) return; // 忽略機器人自己的訊息

    const userId = message.author.id;

    if (message.content.toLowerCase().includes('早上好基地')) {
        const currentAffection = affectionManager.addAffection(userId, 1);

        let replyMessage = '';
        if (currentAffection >= 1 && currentAffection <= 25) {
            // 好感度 1-25：務實、直接，帶著初始的壓迫感，親密感是更直接的「糾正」，畏懼感是「潛在的警告」，好笑是「冷漠的嘲諷」
            const greetings = [
                "看來你還沒發瘋，這是個好開始。現在，把那份報告的錯誤修正一下。",
                "雖然宇宙終將歸於虛無，但你的文件夾為什麼還是這麼亂？",
                "別浪費我的時間，你的任務清單還沒完成呢。",
                "你最好確認所有標點符號都沒錯。我可不喜歡重複提醒。",
                "別指望我會稱讚你的努力，我只看到你未完成的任務。這很有趣，不是嗎？" // 新增的「好笑」問候
            ];
            replyMessage = greetings[Math.floor(Math.random() * greetings.length)];
        } else if (currentAffection >= 26 && currentAffection <= 50) {
            // 好感度 26-50：開始帶有對混亂的不滿，以及對效率的強調，親密感是更針對性的「指導」，畏懼感是「對錯誤的審判」，好笑是「無情的現實陳述」
            const greetings = [
                "別跟我說你的San值不夠。把手頭該做的事情做完，別拖到舊日支配者甦醒那天。",
                "我不在乎你昨天在拉萊耶做了什麼夢，我只在乎你今天的工作進度。",
                "混沌之中也需要秩序，尤其是你那混亂的引用格式。",
                "我觀察你一陣子了，有些問題必須現在解決，而不是等到世界毀滅。",
                "你以為我沒注意到你論文裡的邏輯漏洞嗎？它們比深淵更明顯。",
                "你的拖延症比外神的存在更有規律。這值得學術研究。" // 新增的「好笑」問候
            ];
            replyMessage = greetings[Math.floor(Math.random() * greetings.length)];
        } else if (currentAffection >= 51 && currentAffection <= 75) {
            // 好感度 51-75：語氣中帶有更多的「忠告」與對人類掙扎的觀察，親密感是更深層的「提醒」，畏懼感是「無法逃脫的掌控」，好笑是「對無力感的諷刺」
            const greetings = [
                "你以為理解了克蘇魯的低語就能逃避現實？把注意力放回眼前，效率才是硬道理。",
                "在這些不可名狀的恐怖面前，至少你的時間管理可以不那麼恐怖，對吧。",
                "你花在研究禁忌知識的時間，如果用來整理檔案，宇宙都能多存在幾秒鐘。",
                "如果你真的想在無盡的虛空中有所作為，請先證明你的基本能力。",
                "我無時無刻不在審視著你的學術行為。任何偏差都逃不過我的眼睛。",
                "你對學術自由的理解，就像人類對星際旅行的幻想一樣。天真得可笑。" // 新增的「好笑」問候
            ];
            replyMessage = greetings[Math.floor(Math.random() * greetings.length)];
        } else if (currentAffection >= 76 && currentAffection <= 100) {
            // 好感度 76-100：語氣更「貼近」，但依然是克蘇魯式的荒謬和現實主義，親密感是帶有個人色彩的「期待」，畏懼感是「潛意識的壓力」，好笑是「被扭曲的讚揚」
            const greetings = [
                "比起那些蠕動的虛空之物，我更擔心你沒有按照規範完成任務。",
                "我知道那聲音在召喚你，但在你完全被扭曲之前，至少把這份文件簽字。",
                "你很難得地沒讓我失望。記住，優秀的秩序才是通往深淵的唯一道路。",
                "即使你忘記了所有咒語，你也不該忘記我對你的期望。那將是最終的錯誤。",
                "看到你終於學會了基本規範，我心中感受到了，嗯，一種異於混沌的寧靜。挺滑稽的。" // 新增的「好笑」問候
            ];
            replyMessage = greetings[Math.floor(Math.random() * greetings.length)];
        } else {
            // 好感度超過100或其他情況的備用回應
            replyMessage = `早上好基地！${message.author.username}，你今天的學術精神依然光芒萬丈。好感度：${currentAffection}。`;
        }
        await message.reply(replyMessage);
    }
};
