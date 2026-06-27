const colors = require('../UI/colors/colors');

module.exports = async (client, member) => {

    const welcomeMessage = `歡迎來到基地，${member.user.tag}！這裡供應美國水壺玉米屋`;

    const welcomeChannelId = '1519372557109821581'; 

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
