const colors = require('../UI/colors/colors');

module.exports = async (client, member) => {
    // 您可以在這裡自訂您的歡迎訊息
    const welcomeMessage = `歡迎來到基地，${member.user.tag}！這裡供應美國水壺玉米屋`;

    // 請將 'YOUR_WELCOME_CHANNEL_ID' 替換為您實際的歡迎頻道 ID
    // 要獲取頻道 ID，請在 Discord 中啟用開發者模式（使用者設定 > 進階），
    // 然後右鍵點擊頻道並選擇「複製 ID」。
    const welcomeChannelId = '1065244409802788879'; 

    try {
        const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);

        if (welcomeChannel) {
            await welcomeChannel.send(welcomeMessage);
            console.log(`${colors.cyan}[ WELCOME ]${colors.reset} ${colors.green}已向 ${colors.yellow}${member.user.tag}${colors.reset} 在 ${colors.magenta}#${welcomeChannel.name}${colors.reset} 發送歡迎訊息`);
        } else {
            console.log(`${colors.cyan}[ WELCOME ]${colors.reset} ${colors.red}在伺服器 ${member.guild.name} 中找不到 ID 為 ${welcomeChannelId} 的歡迎頻道。${colors.reset}`);
        }
    } catch (error) {
        console.error(`${colors.cyan}[ WELCOME ]${colors.reset} ${colors.red}發送 ${member.user.tag} 歡迎訊息時發生錯誤：${colors.reset}`, error);
    }
};
