    if (greetCount === 0) {
        const result = affectionManager.addAffection(userId, 1); 
        
        if (result === false) {
             replyMessage = '你今天已經問候過我了。';
        } else {
            const level = affectionManager.getAffectionLevel(result.newAffection);
            const response = level === 11 
                ? affectionManager.getRandomResponse(11) 
                : affectionManager.getRandomResponse(level); 

            replyMessage = response;

            // 如果有秘密透露語句，將其附加到回覆中
            if (result.optionalSecretReveal) {
                replyMessage += `\n\n突然間他的話語突然軟化了些，混雜著一絲猶豫與更深的信任，像是從心底抽出一句話，輕輕地向你說道：「${result.optionalSecretReveal}」`;
            }

            // 🌟 新增：隨機任務完成度 + San值顯示區
            const taskCompletion = Math.floor(Math.random() * 51) + 50; // 50%~100%
            const san = Math.max(0, 70 - result.newAffection); // San = 70 - 好感度（下限為 0）
            replyMessage += `\n\n---\n🎯 今日任務完成度：${taskCompletion}%\n🧠 San值：${san}`;
        }
        await message.reply(replyMessage);
        return;
    }
