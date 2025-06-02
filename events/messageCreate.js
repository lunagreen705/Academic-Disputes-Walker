const affectionManager = require('../utils/affectionManager');

module.exports = async (client, message) => {
    // 忽略機器人自身的訊息
    if (message.author.bot) return;

    const userId = message.author.id;
    const content = message.content.toLowerCase();

    // 只有包含「早上好基地」才觸發
    if (!content.includes('早上好基地')) return;

    // *** 移除此行：affectionManager.loadData() 不再需要手動呼叫 ***
    // 數據在 affectionManager 模組載入時就已經自動載入
    
    const greetCount = affectionManager.getGreetCount(userId);

    // 第一次問候：正常增加好感度並回應
    if (greetCount === 0) {
        const affection = affectionManager.addAffection(userId, 1); // addAffection 內部會處理數據保存
        const level = affectionManager.getAffectionLevel(affection);
        const response = affectionManager.getRandomResponse(level);
        await message.reply(response);
        return;
    }

    // 第二次問候：警告語氣（克蘇魯式 ESTJ）
    if (greetCount === 1) {
        const warningResponses = [
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
        const reply = warningResponses[Math.floor(Math.random() * warningResponses.length)];
        await message.reply(reply);
        
        // 雖然好感度不再增加，但可以記錄這次問候次數 (即使不影響好感度邏輯)
        // 這會觸發 ensureUserData -> saveData。如果你只希望記錄但不觸發數據保存，需調整 addAffection
        affectionManager.addAffection(userId, 0); // 傳入 0 避免好感度增加但仍更新 greetCountToday
        return;
    }

    // 第三次問候：冷淡疏離語氣
    if (greetCount === 2) {
        const indifferentResponses = [
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
        const reply = indifferentResponses[Math.floor(Math.random() * indifferentResponses.length)];
        await message.reply(reply);
        
        // 記錄這次問候次數
        affectionManager.addAffection(userId, 0);
        return;
    }

    // 第四次以上：壓迫式威脅語氣
    if (greetCount >= 3) {
        const oppressiveResponses = [
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
        const reply = oppressiveResponses[Math.floor(Math.random() * oppressiveResponses.length)];
        await message.reply(reply);
        
        // 記錄這次問候次數
        affectionManager.addAffection(userId, 0);
        return;
    }
};
