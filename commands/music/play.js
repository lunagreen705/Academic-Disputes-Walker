
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

// Helper function to format track duration from milliseconds to mm:ss
function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}


async function getSpotifyPlaylistTracks(playlistId) {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body.access_token);

        let tracks = [];
        let offset = 0;
        let limit = 100;
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
        // --- 基本檢查 (無變動) ---
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
        const resolve = await client.riffy.resolve({ query, requester: interaction.user.username });
        const { loadType, tracks, playlistInfo } = resolve;

        // --- 播放列表處理 (邏輯稍微調整，更清晰) ---
        if (loadType === 'playlist') {
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

            await interaction.followUp({ embeds: [playlistEmbed] });
            return;
        }

        // --- 單一歌曲URL或精確結果處理 (邏輯稍微調整) ---
        if (loadType === 'track') {
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

            await interaction.followUp({ embeds: [trackEmbed] });
            return;
        }

        // --- 【核心修改】關鍵字搜尋處理 (Search Result) ---
        if (loadType === 'search') {
            if (!tracks.length) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setAuthor({ name: lang.play.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                    .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                    .setDescription(lang.play.embed.noResults);
                await interaction.followUp({ embeds: [errorEmbed] });
                return;
            }

            // 取得前10個搜尋結果
            const searchResults = tracks.slice(0, 10);

            // 建立選單選項
            const options = searchResults.map((track, index) => ({
                label: track.info.title.length > 95 ? `${track.info.title.slice(0, 95)}...` : track.info.title, // 標籤 (歌曲名稱)
                value: index.toString(), // 選項的值 (我們用索引)
                description: `[${formatDuration(track.info.length)}] - ${track.info.author}`, // 選項描述 (時長 - 作者)
            }));

            // 建立選單 (StringSelectMenu)
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('music-select-menu')
                .setPlaceholder('從這裡選擇一首歌...')
                .addOptions(options);
            
            // 建立動作列 (ActionRow) 來放置選單
            const row = new ActionRowBuilder().addComponents(selectMenu);

            // 建立提示使用者選擇的 Embed
            const searchEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({ name: "請選擇要播放的歌曲", iconURL: musicIcons.searchIcon, url: config.SupportServer })
                .setDescription(`這是關於 "${query}" 的搜尋結果，請在 60 秒內選擇一首歌曲。`)
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            // 發送包含選單的訊息
            const reply = await interaction.followUp({ embeds: [searchEmbed], components: [row] });

            // 建立訊息組件收集器來等待使用者互動
            const filter = (i) => i.user.id === interaction.user.id;
            const collector = reply.createMessageComponentCollector({ filter, time: 60000, max: 1 });

            collector.on('collect', async (i) => {
                const selectedIndex = parseInt(i.values[0]);
                const selectedTrack = searchResults[selectedIndex];
                
                selectedTrack.info.requester = interaction.user.username;
                player.queue.add(selectedTrack);
                requesters.set(selectedTrack.info.uri, interaction.user.username);

                if (!player.playing && !player.paused) player.play();

                // 編輯原訊息，告知使用者已成功加入
                const successEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setAuthor({ name: "已加入佇列", iconURL: musicIcons.beats2Icon, url: config.SupportServer })
                    .setDescription(`[${selectedTrack.info.title}](${selectedTrack.info.uri})`)
                    .addFields(
                        { name: '演唱者', value: selectedTrack.info.author, inline: true },
                        { name: '時長', value: `\`${formatDuration(selectedTrack.info.length)}\``, inline: true }
                    )
                    .setFooter({ text: `由 ${interaction.user.username} 點播`, iconURL: interaction.user.displayAvatarURL() });
                
                // 更新訊息並移除選單
         // 更新訊息，顯示已加入佇列
await i.update({ embeds: [successEmbed], components: [] });

// 設定十秒後刪除這則訊息
setTimeout(async () => {
    try {
        await i.delete(); // 刪除訊息
    } catch (err) {
        console.error('刪除訊息失敗:', err);
    }
}, 10000); // 10000 毫秒 = 10 秒
            });

            collector.on('end', (collected, reason) => {
                // 如果時間到了且沒有人選擇
                if (reason === 'time' && collected.size === 0) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setAuthor({ name: "操作逾時", iconURL: musicIcons.alertIcon, url: config.SupportServer })
                        .setDescription('你沒有在時間內選擇歌曲，請重新使用 `/play` 指令。');
                    
                    // 編輯原訊息，禁用選單並告知逾時
                    reply.edit({ embeds: [timeoutEmbed], components: [] });
                }
            });

            return; // 結束函式執行，因為後續由 collector 處理
        }
        
        // --- 無結果處理 ---
        if (loadType === 'empty') {
            const errorEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({ name: lang.play.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.play.embed.noResults);
            await interaction.followUp({ embeds: [errorEmbed] });
            return;
        }

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