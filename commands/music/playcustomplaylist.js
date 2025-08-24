const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { getCollections } = require('../../utils/db/mongodb.js');
const config = require("../../config.js");
const musicIcons = require('../../UI/icons/musicicons.js');
const { getData } = require('spotify-url-info')(require('node-fetch'));
const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.spotifyClientId,
    clientSecret: process.env.spotifyClientSecret,
});

// Spotify 歌單解析
async function getSpotifyPlaylistTracks(playlistId) {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body.access_token);

        let tracks = [];
        let offset = 0;
        const limit = 100;
        let total = 0;

        do {
            const response = await spotifyApi.getPlaylistTracks(playlistId, { limit, offset });
            total = response.body.total;
            offset += limit;

            for (const item of response.body.items) {
                if (item.track && item.track.name && item.track.artists) {
                    const trackName = `${item.track.name} - ${item.track.artists.map(a => a.name).join(', ')}`;
                    tracks.push(trackName);
                }
            }
        } while (tracks.length < total);

        return tracks;
    } catch (error) {
        console.error("Error fetching Spotify playlist tracks:", error);
        return [];
    }
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
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const playlist = await playlistCollection.findOne({ name: playlistName });
        if (!playlist) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.playlistNotFound);
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (playlist.isPrivate && playlist.userId !== userId) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.accessDenied, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.noPermission);
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!playlist.songs || !playlist.songs.length) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.playCustomPlaylist.embed.emptyPlaylist);
            return await interaction.reply({ embeds: [embed], ephemeral: true });
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

                // Spotify URL 處理
                if (query.includes('spotify.com')) {
                    const spotifyData = await getData(query);

                    if (spotifyData.type === 'track') {
                        query = `${spotifyData.name} - ${spotifyData.artists.map(a => a.name).join(', ')}`;
                    } else if (spotifyData.type === 'playlist') {
                        const match = query.match(/playlist\/([a-zA-Z0-9]+)(\?|$)/);
                        if (match) {
                            const playlistId = match[1];
                            const spotifyTracks = await getSpotifyPlaylistTracks(playlistId);
                            for (const t of spotifyTracks) {
                                const resolve = await client.riffy.resolve({ query: t, requester: interaction.user.username });
                                if (resolve?.tracks?.length) {
                                    player.queue.add(resolve.tracks.shift());
                                    tracksAdded++;
                                }
                            }
                            continue; // Spotify 歌單已加入，跳過下面
                        }
                    }
                }

                // YouTube URL / Lavalink 搜尋
                const resolve = await client.riffy.resolve({ query, requester: interaction.user.username });
                if (!resolve?.tracks?.length) {
                    console.log('無法解析歌曲:', query);
                    continue;
                }

                const track = resolve.tracks.shift();
                player.queue.add(track);
                tracksAdded++;

            } catch (err) {
                console.error(`解析歌曲失敗 "${song.name || song.url}":`, err);
            }
        }

        if (tracksAdded > 0) {
            if (!player.playing && !player.paused && player.queue.length > 0) player.play();
            player.volume.set(50);
        } else {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.playCustomPlaylist.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription('播放列表中沒有可播放的歌曲');
            return await interaction.followUp({ embeds: [embed], ephemeral: true });
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