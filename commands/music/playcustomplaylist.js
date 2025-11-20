const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { getCollections } = require('../../utils/db/mongodb.js');
const config = require("../../config.js");
const musicIcons = require('../../UI/icons/musicicons.js');

/**
 * 清理 YouTube URL
 * - 將 youtu.be 轉成 youtube.com/watch?v=
 * - 移除 ?si= 與多餘參數，只保留 videoId
 */
function cleanYouTubeURL(url) {
    if (!url) return null;
    url = url.trim();

    // 1. 處理 youtu.be 短網址
    if (url.includes('youtu.be/')) {
        const idMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (idMatch) return `https://www.youtube.com/watch?v=${idMatch[1]}`;
    }

    // 2. 處理 youtube.com 長網址 (包含 v=...)
    if (url.includes('v=')) {
        const idMatch = url.match(/v=([a-zA-Z0-9_-]{11})/);
        if (idMatch) return `https://www.youtube.com/watch?v=${idMatch[1]}`;
    }

    // 3. 如果都不是，回傳原字串（可能是歌名）
    return url;
}

async function playCustomPlaylist(client, interaction, lang) {
    try {
        const { playlistCollection } = getCollections();
        const playlistName = interaction.options.getString('name');
        const userId = interaction.user.id;
        const guildId = interaction.guildId; // Discord 這裡叫 guildId

        await interaction.deferReply({ ephemeral: true });

        if (!interaction.member.voice.channelId) {
            // ... (省略錯誤 Embed，保持原樣) ...
            return await interaction.editReply({ content: "❌ 請先加入語音頻道！" });
        }

        // 🔧 修正點 1：對應資料庫的 "serverId" 欄位
        const playlist = await playlistCollection.findOne({ 
            name: playlistName, 
        });

        if (!playlist) {
            // ... (省略錯誤 Embed，保持原樣) ...
            return await interaction.editReply({ content: `❌ 找不到名為 \`${playlistName}\` 的歌單。` });
        }

        // 權限檢查
        if (playlist.isPrivate && playlist.userId !== userId) {
            return await interaction.editReply({ content: "❌ 這是一個私人歌單，你沒有權限播放。" });
        }

        if (!playlist.songs || !playlist.songs.length) {
            return await interaction.editReply({ content: "❌ 歌單內沒有歌曲。" });
        }

        // 建立 Lavalink 連線
        const player = client.riffy.createConnection({
            guildId: interaction.guildId,
            voiceChannel: interaction.member.voice.channelId,
            textChannel: interaction.channelId,
            deaf: true
        });

        // 使用 Promise.all 加速讀取 (不再一首首等)
        const promises = playlist.songs.map(async (song) => {
            try {
                // 判斷 song 是物件(DB) 還是舊格式
                let rawInput = song.url || song.name || song; 
                let query;

                // 判斷是否為網址 (包含 http 且不含空格)
                const isUrl = /^https?:\/\/\S+/.test(rawInput);

                if (isUrl) {
                    // 嘗試清理網址
                    const cleanUrl = cleanYouTubeURL(rawInput);
                    query = cleanUrl || rawInput; // 如果清理失敗就用原網址
                } else {
                    // 不是網址就當作歌名搜尋
                    query = `ytsearch:${rawInput}`;
                }

                const resolve = await client.riffy.resolve({
                    query: query,
                    requester: interaction.user.username
                });

                if (!resolve || !resolve.tracks || resolve.tracks.length === 0) return null;
                return resolve.tracks[0]; // 取第一首
            } catch (e) {
                console.error(`解析失敗: ${song.url || song.name}`, e);
                return null;
            }
        });

        // 等待所有歌曲解析完成
        const resolvedTracks = await Promise.all(promises);
        const validTracks = resolvedTracks.filter(track => track !== null);

        if (validTracks.length > 0) {
            for (const track of validTracks) {
                player.queue.add(track);
            }
            
            if (!player.playing && !player.paused) player.play();
            
            // 只有第一次播放時設定音量
            // player.setVolume(50); 

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({ name: lang.playCustomPlaylist.embed.playingPlaylist, iconURL: musicIcons.beats2Icon })
                .setDescription(lang.playCustomPlaylist.embed.playlistPlaying
                    .replace("{playlistName}", playlistName)
                    .replace("{count}", validTracks.length)) // 建議你在語系檔增加 {count} 參數
                .setFooter({ text: `已載入 ${validTracks.length} 首歌曲`, iconURL: musicIcons.heartIcon });

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({ content: "❌ 無法載入任何歌曲 (可能網址格式錯誤或無法搜尋)。" });
        }

    } catch (error) {
        console.error('Error playing custom playlist:', error);
        await interaction.editReply({ content: "❌ 發生未知錯誤，請查看後台日誌。" }).catch(() => {});
    }
}

module.exports = {
    name: 'playcustomplaylist',
    description: '播放自訂歌單',
    permissions: '0x0000000000000800',
    options: [
        { name: 'name', description: '輸入歌單名字', type: ApplicationCommandOptionType.String, required: true }
    ],
    run: playCustomPlaylist
};
