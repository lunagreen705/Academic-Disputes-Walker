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
    if (!url) return url;
    url = url.trim();
    if (url.startsWith('https://https://')) url = url.replace('https://https://', 'https://');

    try {
        if (url.includes('youtu.be')) {
            const id = url.split('youtu.be/')[1].split(/[?&]/)[0];
            url = `https://www.youtube.com/watch?v=${id}`;
        } else if (url.includes('youtube.com/watch')) {
            const urlObj = new URL(url);
            const v = urlObj.searchParams.get("v");
            if (v) url = `https://www.youtube.com/watch?v=${v}`;
        }
    } catch (e) {
        console.error("URL parse failed:", e);
    }

    return url;
}

async function playCustomPlaylist(client, interaction, lang) {
    try {
        const { playlistCollection } = getCollections();
        const playlistName = interaction.options.getString('name');
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // ⚠️ 避免超時：一開始就 defer
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.member.voice.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.noVoiceChannel);
            return await interaction.editReply({ embeds: [embed] });
        }

        // 查詢加上 guildId，避免不同伺服器互相干擾
        const playlist = await playlistCollection.findOne({ name: { $regex: new RegExp(`^${playlistName}$`, 'i') } });
        if (!playlist) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.playlistNotFound);
            return await interaction.editReply({ embeds: [embed] });
        }

        if (playlist.isPrivate && playlist.userId !== userId) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.accessDenied, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.noPermission);
            return await interaction.editReply({ embeds: [embed] });
        }

        if (!playlist.songs || !playlist.songs.length) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.emptyPlaylist);
            return await interaction.editReply({ embeds: [embed] });
        }

        // 建立 Lavalink 連線
        const player = await client.riffy.createConnection({
            guildId: interaction.guildId,
            voiceChannel: interaction.member.voice.channelId,
            textChannel: interaction.channelId,
            deaf: true
        });

        if (!player) {
            return await interaction.editReply({ content: "❌ 無法建立播放器，請確認 Lavalink 是否正常。", ephemeral: true });
        }

        let tracksAdded = 0;

        for (const song of playlist.songs) {
            try {
                const query = cleanYouTubeURL(song.url || song.name);
                console.log('Resolving URL:', query);

                const resolve = await client.riffy.resolve({
                    query: query,
                    requester: interaction.user.username
                });

                if (!resolve?.tracks?.length) {
                    console.log(`無法解析歌曲: ${query}`);
                    continue;
                }

                const track = resolve.tracks[0]; // 使用第一首歌曲
                player.queue.add(track);

                console.log(`已加入歌曲: ${track.info?.title || "未知歌曲"}`);
                tracksAdded++;

            } catch (err) {
                console.error(`解析歌曲失敗 "${song.name || song.url}":`, err);
            }
        }

        console.log('Total tracks added:', tracksAdded);

        if (tracksAdded > 0) {
            if (!player.playing && !player.paused && player.queue.length > 0) player.play();
            player.setVolume(50);

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({ name: lang.playCustomPlaylist.embed.playingPlaylist, iconURL: musicIcons.beats2Icon, url: config.SupportServer })
                .setDescription(lang.playCustomPlaylist.embed.playlistPlaying.replace("{playlistName}", playlistName))
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.editReply({ embeds: [embed] });

        } else {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription('播放列表中沒有可播放的歌曲');

            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error playing custom playlist:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
            .setDescription(lang.playCustomPlaylist.embed.errorPlayingPlaylist);

        await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
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
