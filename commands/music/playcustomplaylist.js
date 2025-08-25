const { EmbedBuilder } = require("discord.js");
const ytsearch = require("yt-search");

function cleanYouTubeURL(url) {
    if (!url) return url;
    url = url.trim();

    // 防止重複 https://https://
    if (url.startsWith("https://https://")) {
        url = url.replace("https://https://", "https://");
    }

    // youtu.be 短網址轉換
    if (url.includes("youtu.be")) {
        url = url.split("?")[0];
        return url.replace("youtu.be/", "www.youtube.com/watch?v=");
    }

    // youtube 正常網址，去掉 & 後面的參數
    if (url.includes("youtube.com/watch")) {
        return url.split("&")[0];
    }

    return url;
}

module.exports = {
    name: "playcustomplaylist",
    description: "播放自訂播放清單",
    run: async (client, interaction) => {
        try {
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return await interaction.reply({
                    content: "❌ 請先加入語音頻道！",
                    ephemeral: true
                });
            }

            // 假設你的播放清單 URL 存在資料庫或固定陣列
            const playlist = [
                "https://www.youtube.com/watch?v=YmSDDslA__M",
                "https://youtu.be/Y-rAi-2hZ6U"
            ];

            if (!playlist || playlist.length === 0) {
                return await interaction.reply({
                    content: "❌ 找不到播放清單。",
                    ephemeral: true
                });
            }

            // ⚠️ 進入主要流程 → deferReply()
            await interaction.deferReply();

            let tracksAdded = 0;

            for (const url of playlist) {
                const query = cleanYouTubeURL(url);
                const searchResult = await ytsearch({ query, pageStart: 1, pageEnd: 1 });

                if (searchResult && searchResult.videos && searchResult.videos.length > 0) {
                    const video = searchResult.videos[0];

                    // 用 riffy 播放
                    const player = client.riffy.createConnection({
                        guildId: interaction.guild.id,
                        voiceChannel: voiceChannel.id,
                        textChannel: interaction.channel.id,
                        deaf: true
                    });

                    await player.play(video.url);
                    tracksAdded++;
                } else {
                    console.warn(`無法解析歌曲: ${url}`);
                }
            }

            if (tracksAdded > 0) {
                const embed = new EmbedBuilder()
                    .setColor("Green")
                    .setDescription(`✅ 已加入播放清單，共 ${tracksAdded} 首歌曲！`);
                await interaction.editReply({ embeds: [embed] });
            } else {
                const embed = new EmbedBuilder()
                    .setColor("Red")
                    .setDescription("❌ 播放清單中沒有成功加入的歌曲。");
                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error("Error playing custom playlist:", error);
            try {
                await interaction.editReply({
                    content: "❌ 播放清單時發生錯誤！"
                });
            } catch (e) {
                console.error("二次錯誤:", e);
            }
        }
    }
};