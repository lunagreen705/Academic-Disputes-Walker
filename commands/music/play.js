const { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const config = require('../../config.js');
const musicIcons = require('../../UI/icons/musicicons.js');
const SpotifyWebApi = require('spotify-web-api-node');
const { getData } = require('spotify-url-info')(require('node-fetch'));
const requesters = new Map();

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.spotifyClientId,
    clientSecret: process.env.spotifyClientSecret,
});

// --- 工具函數 ---
function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Lavalink 相容 v3/v4
function getTracksFromResolve(resolve) {
    if (Array.isArray(resolve.tracks)) return resolve.tracks;   // 舊版
    if (Array.isArray(resolve.data)) return resolve.data;       // 新版
    return [];
}

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

async function play(client, interaction, lang) {
    try {
        // --- 基本檢查 ---
        if (!interaction.member.voice.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.play.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.play.embed.noVoiceChannel);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!client.riffy.nodes || client.riffy.nodes.size === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.play.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.play.embed.noLavalinkNodes);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply();

        const player = client.riffy.createConnection({
            guildId: interaction.guildId,
            voiceChannel: interaction.member.voice.channelId,
            textChannel: interaction.channelId,
            deaf: true
        });

        const query = interaction.options.getString('name');
        let tracksToQueue = [];
        let isPlaylist = false;

        // --- Spotify URL ---
        if (query.includes('spotify.com')) {
            try {
                const spotifyData = await getData(query);

                if (spotifyData.type === 'track') {
                    const trackName = `${spotifyData.name} - ${spotifyData.artists.map(a => a.name).join(', ')}`;
                    tracksToQueue.push(trackName);
                } else if (spotifyData.type === 'playlist') {
                    isPlaylist = true;
                    const match = query.match(/playlist\/([a-zA-Z0-9]+)(\?|$)/);
                    if (match) {
                        const playlistId = match[1];
                        tracksToQueue = await getSpotifyPlaylistTracks(playlistId);
                    }
                }
            } catch (err) {
                console.error('Error fetching Spotify data:', err);
                return interaction.followUp({ content: "❌ Failed to fetch Spotify data." });
            }
        } else {
            // --- Lavalink resolve ---
            const resolve = await client.riffy.resolve({ query, requester: interaction.user.username });
            const { loadType, playlistInfo } = resolve;
            const tracks = getTracksFromResolve(resolve);

            if (loadType === 'playlist') {
                isPlaylist = true;
                for (const track of tracks) {
                    track.info.requester = interaction.user.username;
                    player.queue.add(track);
                    requesters.set(track.info.uri, interaction.user.username);
                }

                if (!player.playing && !player.paused) player.play();

                const playlistEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setAuthor({ name: "播放列表已加入佇列", iconURL: musicIcons.playlistIcon, url: config.SupportServer })
                    .setDescription(`**${playlistInfo.name}** 中的 **${tracks.length}** 首歌曲已成功加入。`)
                    .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

                const msg = await interaction.followUp({ embeds: [playlistEmbed] });
                setTimeout(() => { msg.delete().catch(() => {}); }, 10000);
                return;
            } else if (loadType === 'track') {
                const track = tracks.shift();
                track.info.requester = interaction.user.username;
                player.queue.add(track);
                requesters.set(track.info.uri, interaction.user.username);

                if (!player.playing && !player.paused) player.play();

                const trackEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setAuthor({ name: "已加入佇列", iconURL: musicIcons.beats2Icon, url: config.SupportServer })
                    .setDescription(`[${track.info.title}](${track.info.uri})`)
                    .addFields(
                        { name: '演唱者', value: track.info.author, inline: true },
                        { name: '時長', value: `\`${formatDuration(track.info.length)}\``, inline: true }
                    )
                    .setFooter({ text: `由 ${interaction.user.username} 點播`, iconURL: interaction.user.displayAvatarURL() });

                const msg = await interaction.followUp({ embeds: [trackEmbed] });
                setTimeout(() => { msg.delete().catch(() => {}); }, 10000);
                return;
            } else if (loadType === 'search') {
                if (!tracks.length) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(config.embedColor)
                        .setAuthor({ name: lang.play.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                        .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                        .setDescription(lang.play.embed.noResults);
                    await interaction.followUp({ embeds: [errorEmbed] });
                    return;
                }

                const searchResults = tracks.slice(0, 10);
                const options = searchResults.map((track, index) => ({
                    label: track.info.title.length > 100 ? `${track.info.title.slice(0, 95)}...` : track.info.title,
                    value: index.toString(),
                    description: `[${formatDuration(track.info.length)}] - ${track.info.author}`
                }));

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('music-select-menu')
                    .setPlaceholder('從這裡選擇一首歌...')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                const searchEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setAuthor({ name: "請選擇要播放的歌曲", iconURL: musicIcons.searchIcon, url: config.SupportServer })
                    .setDescription(`這是關於 "${query}" 的搜尋結果，請在 60 秒內選擇一首歌曲。`)
                    .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

                const reply = await interaction.followUp({ embeds: [searchEmbed], components: [row] });

                const filter = (i) => i.user.id === interaction.user.id;
                const collector = reply.createMessageComponentCollector({ filter, time: 60000, max: 1 });

                collector.on('collect', async (i) => {
                    try {
                        await i.deferUpdate().catch(() => {});
                        const selectedIndex = parseInt(i.values[0]);
                        const selectedTrack = searchResults[selectedIndex];

                        selectedTrack.info.requester = interaction.user.username;
                        player.queue.add(selectedTrack);
                        requesters.set(selectedTrack.info.uri, interaction.user.username);

                        if (!player.playing && !player.paused) player.play();

                        const successEmbed = new EmbedBuilder()
                            .setColor(config.embedColor)
                            .setAuthor({ name: "已加入佇列", iconURL: musicIcons.beats2Icon, url: config.SupportServer })
                            .setDescription(`[${selectedTrack.info.title}](${selectedTrack.info.uri})`)
                            .addFields(
                                { name: '演唱者', value: selectedTrack.info.author, inline: true },
                                { name: '時長', value: `\`${formatDuration(selectedTrack.info.length)}\``, inline: true }
                            )
                            .setFooter({ text: `由 ${interaction.user.username} 點播`, iconURL: interaction.user.displayAvatarURL() });

                        await i.editReply({ embeds: [successEmbed], components: [] }).catch(() => {});
                        setTimeout(() => { i.message.delete().catch(() => {}); }, 3000);
                    } catch (err) {
                        console.error('Error handling select menu:', err);
                    }
                });

                collector.on('end', async (collected, reason) => {
                    if (reason === 'time' && collected.size === 0) {
                        await reply.delete().catch(() => {});
                    }
                });
                return;
            } else if (loadType === 'empty') {
                const errorEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setAuthor({ name: lang.play.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                    .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                    .setDescription(lang.play.embed.noResults);
                await interaction.followUp({ embeds: [errorEmbed] });
                return;
            }
        }

        // --- Spotify playlist track queue ---
        for (const trackQuery of tracksToQueue) {
            const resolve = await client.riffy.resolve({ query: trackQuery, requester: interaction.user.username });
            const tracks = getTracksFromResolve(resolve);
            if (tracks.length > 0) {
                const trackInfo = tracks[0];
                player.queue.add(trackInfo);
                requesters.set(trackInfo.info.uri, interaction.user.username);
            }
        }

        if (!player.playing && !player.paused) player.play();

        const queuedEmbed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setAuthor({ name: "播放列表已加入佇列", iconURL: musicIcons.playlistIcon, url: config.SupportServer })
            .setDescription(`已將 **${tracksToQueue.length}** 首 Spotify 歌曲加入佇列`)
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

        const msg = await interaction.followUp({ embeds: [queuedEmbed] });
        setTimeout(() => { msg.delete().catch(() => {}); }, 10000);

    } catch (error) {
        console.error('Error processing play command:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: "❌ 處理你的請求時發生錯誤。", ephemeral: true });
        } else {
            await interaction.reply({ content: "❌ 處理你的請求時發生錯誤。", ephemeral: true });
        }
    }
}

module.exports = {
    name: "play",
    description: "播放歌曲",
    permissions: "0x0000000000000800",
    options: [{
        name: 'name',
        description: '輸入歌曲名字/網址或歌單',
        type: ApplicationCommandOptionType.String,
        required: true
    }],
    run: play,
    requesters: requesters,
};