const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { getCollections } = require('../../utils/db/mongodb.js');
const config = require("../../config.js");
const musicIcons = require('../../UI/icons/musicicons.js');
const SpotifyWebApi = require('spotify-web-api-node');
const { getData } = require('spotify-url-info')(require('node-fetch'));

/**
 * 清理 YouTube URL
 * - 將 youtu.be 轉成 youtube.com/watch?v=
 * - 移除 ?si= 及多餘參數
 */
function cleanYouTubeURL(url) {
    if (!url) return url;
    if (url.includes('youtu.be')) {
        url = url.split('?')[0];
        return url.replace('youtu.be/', 'www.youtube.com/watch?v=');
    } else if (url.includes('youtube.com/watch')) {
        return url.split('&')[0]; // 移除多餘參數
    }
    return url;
}

async function playCustomPlaylist(client, interaction, lang) {
    try {
        const { playlistCollection } = getCollections();
        const playlistName = interaction.options.getString('name');
        const userId = interaction.user.id;

        if (!interaction.member.voice.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.noVoiceChannel);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        const playlist = await playlistCollection.findOne({ name: playlistName });
        if (!playlist) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.playlistNotFound);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        if (playlist.isPrivate && playlist.userId !== userId) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.accessDenied, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.noPermission);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        if (!playlist.songs || !playlist.songs.length) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.emptyPlaylist);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        // 建立 Lavalink 連線
        const player = await client.riffy.createConnection({
            guildId: interaction.guildId,
            voiceChannel: interaction.member.voice.channelId,
            textChannel: interaction.channelId,
            deaf: true
        });

        await interaction.deferReply();

        let tracksAdded = 0;

        for (const song of playlist.songs) {
            try {
                let query = song.url || song.name;

                // --- Spotify 處理 ---
                if (query.includes('spotify.com')) {
                    const spotifyApi = new SpotifyWebApi({
                        clientId: process.env.spotifyClientId,
                        clientSecret: process.env.spotifyClientSecret,
                    });

                    try {
                        const spotifyData = await getData(query);

                        // 單曲
                        if (spotifyData.type === 'track') {
                            query = `${spotifyData.name} - ${spotifyData.artists.map(a => a.name).join(', ')}`;
                        }

                        // 歌單
                        else if (spotifyData.type === 'playlist') {
                            const match = query.match(/playlist\/([a-zA-Z0-9]+)(\?|$)/);
                            if (match) {
                                const playlistId = match[1];

                                const data = await spotifyApi.clientCredentialsGrant();
                                spotifyApi.setAccessToken(data.body.access_token);

                                let offset = 0;
                                const limit = 100;
                                let total = 0;
                                let tracksInPlaylist = [];

                                do {
                                    const response = await spotifyApi.getPlaylistTracks(playlistId, { limit, offset });
                                    total = response.body.total;
                                    offset += limit;

                                    for (const item of response.body.items) {
                                        if (item.track && item.track.name && item.track.artists) {
                                            tracksInPlaylist.push(`${item.track.name} - ${item.track.artists.map(a => a.name).join(', ')}`);
                                        }
                                    }
                                } while (tracksInPlaylist.length < total);

                                // 加入整個 Spotify 歌單
                                for (const t of tracksInPlaylist) {
                                    const resolve = await client.riffy.resolve({ query: t, requester: interaction.user.username });
                                    const track = resolve?.tracks?.[0];
                                    if (track) {
                                        player.queue.add(track);
                                        tracksAdded++;
                                    }
                                }
                                continue; // 已處理 Spotify 歌單，不再解析下面
                            }
                        }
                    } catch (err) {
                        console.error('Spotify 解析失敗:', err);
                        continue;
                    }
                }

                // --- YouTube 或其他 URL ---
                query = cleanYouTubeURL(query);
                const resolve = await client.riffy.resolve({ query, requester: interaction.user.username });

                if (!resolve?.tracks?.length) {
                    console.log('無法解析歌曲:', query);
                    continue;
                }

                const track = resolve.tracks.shift();
                player.queue.add(track);
                tracksAdded++;

            } catch (err) {
                console.error('解析播放清單歌曲失敗:', song.name || song.url, err);
            }
        }

        console.log('Total tracks added:', tracksAdded);

        if (tracksAdded > 0) {
            if (!player.playing && !player.paused && player.queue.length > 0) player.play();
            player.volume.set(50); // 預設音量 50%
        } else {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription('播放列表中沒有可播放的歌曲');
            await interaction.followUp({ embeds: [embed], ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setAuthor({ name: lang.playCustomPlaylist.embed.playingPlaylist, iconURL: musicIcons.beats2Icon, url: config.SupportServer })
            .setDescription(lang.playCustomPlaylist.embed.playlistPlaying.replace("{playlistName}", playlistName))
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

        await interaction.followUp({ embeds: [embed] });

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