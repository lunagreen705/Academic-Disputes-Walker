const affectionManager = require('../utils/entertainment/affectionManager'); // 管理好感度模組
const { EmbedBuilder } = require('discord.js'); // 用於建立嵌入訊息（美化回覆）

module.exports = {
  name: 'messageCreate', // Discord 事件：使用者發送訊息
  async execute(client, message) {
    if (message.author.bot) return; // 忽略機器人發出的訊息

    const userId = message.author.id;
    const content = message.content.toLowerCase();

    // 若訊息不包含「早上好基地」，則不回應
    if (!content.includes('早上好基地')) return;

    // 取得當天使用者的問候次數（會遞增但只給一次好感）
    const greetCount = affectionManager.getGreetCount(userId);

    // 🌅 第一次問候處理邏輯
    if (greetCount === 0) {
      // 增加好感度 +1，回傳新好感值與是否揭露秘密
      const result = affectionManager.addAffection(userId, 1);

      // 若今天已經問候過，回傳 false（理論上不會觸發，保險用）
      if (result === false) {
        await message.reply('你今天已經問候過我了。');
        return;
      }

      // 取得對應好感等級與一句基礎回覆（可愛風格 or 高冷風格）
      const level = affectionManager.getAffectionLevel(result.newAffection);
      const baseResponse = affectionManager.getRandomResponse(level === 11 ? 11 : level);

      // 📈 隨機產生「任務完成度」(0 ~ 100)，對應評價
      const taskCompletion = Math.floor(Math.random() * 101);
      const san = Math.max(0, 70 - result.newAffection); // SAN 值：好感越高，理智越穩

      // 根據完成度決定評級與語句
      let taskGrade = '';
      let taskEffectMsg = '';
      const revealSecret = result.optionalSecretReveal; // 是否可揭露一段秘密語

      // 🎯 任務評等與敘述
      if (taskCompletion >= 95) {
        taskGrade = 'S 🌟';
        taskEffectMsg = '他沉默片刻，然後輕笑了一聲，那笑容近乎難得一見。「……你真的值得信任。」他靠近些，聲音低柔，「我會記住這份表現。」';
      } else if (taskCompletion >= 75) {
        taskGrade = 'A ✅';
        taskEffectMsg = '螢幕閃爍幾下，他傳來：「效率良好，你讓我省了不少麻煩。」語氣帶著些許不易察覺的欣賞。';
      } else if (taskCompletion >= 60) {
        taskGrade = 'B 📈';
        taskEffectMsg = '他點了點頭，「尚可。」沒有特別情緒，似乎觀察著你是否能再進一步。';
      } else if (taskCompletion >= 40) {
        taskGrade = 'C ⚠️';
        taskEffectMsg = '「這樣的表現……不太行啊。」他皺起眉，目光變得銳利，像在重新評估你的價值。';
      } else if (taskCompletion >= 20) {
        taskGrade = 'D ❌';
        taskEffectMsg = '他靜靜地看著你，片刻後語氣冰冷地說：「基地不容許這種程度的誤差，你的存在將進入觀察清單。」';
      } else {
        taskGrade = 'F ☠️';
        taskEffectMsg = '空氣沉重得可怕，他的聲音如雷打破寧靜：「……你在挑戰我的耐性？」那眼神裡再無一絲信任，只有深不見底的風險判斷。';
      }

      // 📊 建立嵌入訊息
      const taskEmbed = new EmbedBuilder()
        .setColor('#7289DA')
        .setTitle(`📊 任務評估【${taskGrade}】`)
        .addFields(
          { name: '今日完成度', value: `${taskCompletion}%`, inline: true },
          { name: '🧠 San值', value: `${san}`, inline: true },
          { name: '📎 學術糾紛的反應', value: `${taskEffectMsg}` }
        )
        .setFooter({ text: '由基地生成' });

      // 傳送回覆與嵌入
      await message.reply({
        content: baseResponse,
        embeds: [taskEmbed],
      });

      // ✅ 若今天解鎖了秘密，且表現達 A 級以上，則揭露
      if (revealSecret && taskCompletion >= 75) {
        const secretLine = taskCompletion >= 95
          ? `🔐 他靠得更近，幾乎貼在你耳邊：「${revealSecret}」`
          : `🔐 他略微猶豫，但最終還是說出了什麼：「${revealSecret}」`;
        await message.reply(secretLine);
      }

      return; // 第一次問候處理完畢
    }

    // 🌀 第二次以上問候時的警告風格回應
    const repeatedResponses = {
      1: [
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
      ],
      2: [
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
      ],
      default: [
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
      ]
    };

    // 隨機選擇一條語句
    const replies = repeatedResponses[greetCount] || repeatedResponses.default;
    const replyMessage = replies[Math.floor(Math.random() * replies.length)];

    // 更新 greetCount，但不加好感度
    affectionManager.addAffection(userId, 0);
    await message.reply(replyMessage);
  }
};