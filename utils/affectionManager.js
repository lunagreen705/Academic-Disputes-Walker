// 假設在某個 Discord 訊息處理函式中
async function handleGreetingCommand(message, userId) {
    const result = AffectionManager.addAffection(userId, 1); // 假設每次問候加1好感度

    if (!result.success) {
        // 如果今天已經問候過，result.success 會是 false
        message.reply("今天你已經問候過艾莉絲教授了，她對你的熱情表示欣賞，但無需重複。");
        return;
    }

    const currentAffection = result.affection;
    const currentLevel = AffectionManager.getAffectionLevel(currentAffection);
    const regularResponse = AffectionManager.getRandomResponse(currentLevel);

    let finalResponse = regularResponse;

    // 如果有觸發秘密短語，將其附加到回應中
    if (result.secretPhrase) {
        finalResponse += `\n\n艾莉絲教授眼神微動，似乎不經意地低語道：「${result.secretPhrase}」`;
    }

    message.reply(`你的好感度增加了！目前好感度：${currentAffection} (等級 ${currentLevel})\n${finalResponse}`);
}
