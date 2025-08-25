const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { getCollections } = require('../../utils/db/mongodb.js');
const config = require("../../config.js");
const musicIcons = require('../../UI/icons/musicicons.js');

/**
 * 清理 YouTube URL
 * - 把 youtu.be 轉成 youtube.com/watch?v=
 * - 移除 ?si= 及多餘參數
 */
function cleanYouTubeURL(url) {
    if (!url) return url;
    if (url.includes('youtu.be')) {
        url = url.split('?')[0];
        return url.replace('youtu.be/', 'https://www.youtube.com/watch?v=');
    } else if (url.includes('youtube.com/watch')) {
        return url.split('&')[0];
    }
    return url;
}

/**
 * Lavalink 相容 v3/v4
 * 根據 resolve 的結果取得音軌陣列
 */
function getTracksFromResolve(resolve) {
    if (!resolve) return [];
    if (Array.isArray(resolve.tracks)) return resolve.tracks; // 舊版
    if (Array.isArray(resolve.data)) return resolve.data;     // 新版
    return [];
}


async function playCustomPlaylist(client, interaction, lang) {
    try {
        const { playlistCollection } = getCollections();
        const playlistName = interaction.options.getString('name');
        const userId = interaction.user.id;

        // --- 基本檢查 ---
        if (!interaction.member.voice.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.noVoiceChannel);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const playlist = await playlistCollection.findOne({ name: playlistName });
        if (!playlist) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.playlistNotFound);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (playlist.isPrivate && playlist.userId !== userId) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.accessDenied, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.noPermission);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!playlist.songs || !playlist.songs.length) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.emptyPlaylist);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply();

        // 建立連線
        const player = await client.riffy.createConnection({
            guildId: interaction.guildId,
            voiceChannel: interaction.member.voice.channelId,
            textChannel: interaction.channelId,
            deaf: true
        });

        let tracksAdded = 0;

        // --- 修正後的歌曲處理迴圈 ---
        for (const song of playlist.songs) {
            try {
                const query = cleanYouTubeURL(song.url || song.name);

                const resolve = await client.riffy.resolve({
                    query: query,
                    requester: interaction.user.username
                });

                const tracks = getTracksFromResolve(resolve);

                if (!tracks || tracks.length === 0) {
                    console.log(`無法解析歌曲: ${query}`);
                    continue; // 跳過這首歌，繼續處理下一首
                }

                const track = tracks.shift();
                track.info.requester = interaction.user.username; // 設定點播者
                
                player.queue.add(track);
                console.log(`已加入歌曲: ${track.info.title}`);
                tracksAdded++;

            } catch (err) {
                console.error(`解析歌曲失敗 "${song.name || song.url}":`, err);
            }
        }

        console.log('Total tracks added:', tracksAdded);

        // --- 結果回覆 ---
        if (tracksAdded > 0) {
            if (!player.playing && !player.paused) {
                player.play();
            }
            player.volume = 50; // 預設音量 50%

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({ name: lang.playCustomPlaylist.embed.playingPlaylist, iconURL: musicIcons.beats2Icon, url: config.SupportServer })
                .setDescription(lang.playCustomPlaylist.embed.playlistPlaying.replace("{playlistName}", playlistName).replace("{count}", tracksAdded))
                .setFooter({ text: `由 ${interaction.user.username} 點播`, iconURL: interaction.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [embed] });

        } else {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription('播放列表中的所有歌曲都無法解析播放。');
            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error playing custom playlist:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
            .setDescription(lang.playCustomPlaylist.embed.errorPlayingPlaylist);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
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