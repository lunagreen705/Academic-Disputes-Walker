const affectionManager = require('../utils/affectionManager');

module.exports = async (client, message) => {
    if (message.author.bot) return;

    const userId = message.author.id;

    if (message.content.toLowerCase().includes('早上好基地')) {
        if (affectionManager.hasGreetedToday(userId)) {
            await message.reply(`${message.author.username}，你今天已經向基地問候過了。學術糾紛機器人提醒你，重複的行為不值得額外關注。`);
            return;
        }

        const currentAffection = await affectionManager.addAffection(userId, 1);
        if (currentAffection === false) {
            await message.reply(`${message.author.username}，你今天已經向基地問候過了。提醒你，重複的行為不值得額外關注📏`);
            return;
        }

        let greetings = [];
        if (currentAffection >= 1 && currentAffection <= 25) {
            greetings = [
                "看來你還沒發瘋，這是個好開始。現在，把那份報告的錯誤修正一下。",
                "雖然宇宙終將歸於虛無，但你的文件夾為什麼還是這麼亂？",
                "別浪費我的時間，你的任務清單還沒完成呢。",
                "你最好確認所有標點符號都沒錯。我可不喜歡重複提醒。",
                "別指望我會稱讚你的努力，我只看到你未完成的任務。這很有趣，不是嗎？",
                "群星尚未歸位，而你竟然還沒完成那張表格。你是在等宇宙重啟嗎？"
            ];
        } else if (currentAffection >= 26 && currentAffection <= 50) {
            greetings = [
                "別跟我說你的San值不夠。把手頭該做的事情做完，別拖到舊日支配者甦醒那天。",
                "我不在乎你昨天在拉萊耶做了什麼夢，我只在乎你今天的工作進度。",
                "混沌之中也需要秩序，尤其是你那混亂的引用格式。",
                "我觀察你一陣子了，有些問題必須現在解決，而不是等到世界毀滅。",
                "你以為我沒注意到你論文裡的邏輯漏洞嗎？它們比深淵更明顯。",
                "你的拖延症比外神的存在更有規律。這值得學術研究。",
                "群星緩慢地旋轉，而你的進度像是被時間遺棄了一樣。真是對稱得可怕。"
            ];
        } else if (currentAffection >= 51 && currentAffection <= 75) {
            greetings = [
                "你以為理解了克蘇魯的低語就能逃避現實？把注意力放回眼前，效率才是硬道理。",
                "在這些不可名狀的恐怖面前，至少你的時間管理可以不那麼恐怖，對吧。",
                "你花在研究禁忌知識的時間，如果用來整理檔案，宇宙都能多存在幾秒鐘。",
                "如果你真的想在無盡的虛空中有所作為，請先證明你的基本能力。",
                "我無時無刻不在審視著你的學術行為。任何偏差都逃不過我的眼睛。",
                "你對學術自由的理解，就像人類對星際旅行的幻想一樣。天真得可笑。",
                "群星的運行自有法則，而你還在對每週計畫表茫然。這之間的落差讓人著迷。"
            ];
        } else if (currentAffection >= 76 && currentAffection <= 100) {
            greetings = [
                "比起那些蠕動的虛空之物，我更擔心你沒有按照規範完成任務。",
                "我知道那聲音在召喚你，但在你完全被扭曲之前，至少把這份文件簽字。",
                "你很難得地沒讓我失望。記住，優秀的秩序才是通往深淵的唯一道路。",
                "即使你忘記了所有咒語，你也不該忘記我對你的期望。那將是最終的錯誤。",
                "看到你終於學會了基本規範，我心中感受到了，嗯，一種異於混沌的寧靜。挺滑稽的。",
                "當群星依序點亮虛空時，我也看見你終於踏上正軌。這是宇宙的微妙回應。"
            ];
        } else {
            await message.reply(`早上好基地！${message.author.username}，你今天的學術精神依然光芒萬丈。好感度：${currentAffection}。`);
            return;
        }

        // =========================================
        // 洗牌後依序播放，直到一輪播完再重洗
        // =========================================

        if (!client.greetingQueue) client.greetingQueue = {};
        if (!client.greetingIndex) client.greetingIndex = {};

        const affectionKey = `${userId}-${Math.floor(currentAffection / 25)}`;

        if (!client.greetingQueue[affectionKey]) {
            client.greetingQueue[affectionKey] = [...greetings].sort(() => Math.random() - 0.5);
            client.greetingIndex[affectionKey] = 0;
        }

        const replyMessage = client.greetingQueue[affectionKey][client.greetingIndex[affectionKey]];
        client.greetingIndex[affectionKey]++;

        if (client.greetingIndex[affectionKey] >= greetings.length) {
            client.greetingQueue[affectionKey] = [...greetings].sort(() => Math.random() - 0.5);
            client.greetingIndex[affectionKey] = 0;
        }

        await message.reply(replyMessage);
    }
};