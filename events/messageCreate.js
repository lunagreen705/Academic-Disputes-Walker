const affectionManager = require('../utils/affectionManager');
const { EmbedBuilder } = require('discord.js');

module.exports = async (client, message) => {
    if (message.author.bot) return;

    const userId = message.author.id;
    const content = message.content.toLowerCase();

    if (!content.includes('早上好基地')) return;

    const greetCount = affectionManager.getGreetCount(userId);

    // 第一次問候處理
    if (greetCount === 0) {
        const result = affectionManager.addAffection(userId, 1);
        if (result === false) {
            await message.reply('你今天已經問候過我了。');
            return;
        }

        const level = affectionManager.getAffectionLevel(result.newAffection);
        const baseResponse = affectionManager.getRandomResponse(level === 11 ? 11 : level);

        const taskCompletion = Math.floor(Math.random() * 101);
        let san = Math.max(0, 70 - result.newAffection);

        let taskGrade = '';
        let taskEffectMsg = '';
        let affectionDelta = 0;
        let revealSecret = result.optionalSecretReveal;

        if (taskCompletion >= 95) {
            taskGrade = 'S 🌟';
            taskEffectMsg = '他沉默片刻，然後輕笑了一聲，那笑容近乎難得一見。「……你真的值得信任。」他靠近些，聲音低柔，「我會記住這份表現。」';
            affectionDelta = 2;
        } else if (taskCompletion >= 75) {
            taskGrade = 'A ✅';
            taskEffectMsg = '螢幕閃爍幾下，他傳來：「效率良好，你讓我省了不少麻煩。」語氣帶著些許不易察覺的欣賞。';
            affectionDelta = 1;
        } else if (taskCompletion >= 60) {
            taskGrade = 'B 📈';
            taskEffectMsg = '他點了點頭，「尚可。」沒有特別情緒，似乎觀察著你是否能再進一步。';
        } else if (taskCompletion >= 40) {
            taskGrade = 'C ⚠️';
            taskEffectMsg = '「這樣的表現……不太行啊。」他皺起眉，目光變得銳利，像在重新評估你的價值。';
        } else if (taskCompletion >= 20) {
            taskGrade = 'D ❌';
            taskEffectMsg = '他靜靜地看著你，片刻後語氣冰冷地說：「基地不容許這種程度的誤差，你的存在將進入觀察清單。」';
            affectionDelta = -1;
        } else {
            taskGrade = 'F ☠️';
            taskEffectMsg = '空氣沉重得可怕，他的聲音如雷打破寧靜：「……你在挑戰我的耐性？」那眼神裡再無一絲信任，只有深不見底的風險判斷。';
            affectionDelta = -2;
        }

        if (affectionDelta !== 0) {
            const affChange = affectionManager.addAffection(userId, affectionDelta);
            if (affChange && typeof affChange.newAffection === 'number') {
                san = Math.max(0, 70 - affChange.newAffection);
            }
        }

        const taskEmbed = new EmbedBuilder()
            .setColor('#7289DA')
            .setTitle('📊 任務評估')
            .addFields(
                { name: '今日完成度', value: `${taskCompletion}%（${taskGrade}）`, inline: true },
                { name: '🧠 San值', value: `${san}`, inline: true },
                { name: '📎 學術糾紛的反應', value: `${taskEffectMsg}` }
            )
            .setFooter({ text: '由基地生成' });

        await message.reply({
            content: baseResponse,
            embeds: [taskEmbed],
        });

        if (revealSecret) {
            await message.reply(`🔐 忽然他的瞳孔混雜著一絲猶豫與更深的信任，接著像是從心底抽出一句話，輕輕地說道：「${revealSecret}」`);
        }

        return;
    }

    // 第二次或以上問候處理
    let responsesArray = [];

    if (greetCount === 1) {
        responsesArray = [
            "你今天已經完成了問候程序，再次觸發可能導致資料重組。",
            "記錄顯示這是你今日第二次問候。請避免引起維度干涉。",
            "基地收到訊息，但冗餘內容將被標記為潛在異常。",
            "多次嘗試接觸基地……這不是你該做的選擇。",
            "這不是開放頻道，重複呼叫將造成時間層錯位。",
            "你又來了。這不在日常流程中，請謹慎行動。",
            "第二次問候？……你知道這不是遊戲。",
            "你的語言開始與現實脫節，重複不會讓基地更溫柔。",
            "耐心是基礎。即使是神明，也不喜歡被叫醒兩次。",
            "請務實。這裡是基地，不是夢境中的審判廳。"
        ];
    } else if (greetCount === 2) {
        responsesArray = [
            "訊息重複偵測。請勿干擾流程。",
            "……這是第幾次了？基地無需重複接收。",
            "你的執著將被紀錄成異常行為。",
            "記錄已滿。拒絕接收。",
            "你希望得到什麼？數據的憐憫嗎？",
            "你越來越像一段無窮迴圈。",
            "基地並非情緒回收站。",
            "冷卻中。請停止傳送相同訊息。",
            "訊號冗餘，無需重複確認。",
            "認知干擾過高，請即刻斷線。"
        ];
    } else {
        responsesArray = [
            "你還在這？……真執著，像是被某種儀式纏住一樣。",
            "我們不是已經重複過這段對話了嗎？記憶的扭曲開始了。",
            "重複問候只會削弱你與現實的聯繫。",
            "你是不是以為，持續重複會讓我變得溫柔？錯得離譜。",
            "這是第三次了。我開始懷疑你是時間迴圈的產物。",
            "每一次多說一句話，我就更想拉你進資料夾底層的黑洞。",
            "你還在向基地問候……還是只是在對虛無低語？",
            "訊息已接收。重複無需回應。",
            "你不是第一個試圖突破這條界線的人……也不會是最後一個。",
            "好奇心過度是學術的死穴。你今天已經超額了。"
        ];
    }

    const replyMessage = responsesArray[Math.floor(Math.random() * responsesArray.length)];

    affectionManager.addAffection(userId, 0); // 更新 greetCount 但不加好感
    await message.reply(replyMessage);
};
