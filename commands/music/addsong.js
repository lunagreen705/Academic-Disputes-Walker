const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { getCollections } = require('../../utils/db/mongodb.js');
const musicIcons = require('../../UI/icons/musicicons.js');
const config = require('../../config.js');

function cleanYouTubeURL(url) {
    if (!url) return null;
    url = url.trim();
    if (url.includes('youtu.be/')) {
        const idMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (idMatch) return `https://www.youtube.com/watch?v=${idMatch[1]}`;
    }
    if (url.includes('v=')) {
        const idMatch = url.match(/v=([a-zA-Z0-9_-]{11})/);
        if (idMatch) return `https://www.youtube.com/watch?v=${idMatch[1]}`;
    }
    return url;
}

async function addSong(client, interaction, lang) {
    try {
        const { playlistCollection } = getCollections();
        const playlistName = interaction.options.getString('playlist');
        const songInput = interaction.options.getString('input');
        const userId = interaction.user.id;

        // ⚠️ 1. 因為解析歌曲需要時間，先使用 deferReply
        await interaction.deferReply();

        // 🔍 2. 尋找歌單 (使用與播放指令相同的邏輯：優先找自己的)
        const playlists = await playlistCollection.find({ name: playlistName }).toArray();
        let playlist = playlists.find(p => p.userId === userId);

        if (!playlist) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.addsong.embed.playlistNotFound, iconURL: musicIcons.alertIcon })
                .setDescription(lang.addsong.embed.playlistNotFoundDescription);
            return await interaction.editReply({ embeds: [embed] });
        }

        // 🔒 3. 權限檢查 (只能修改自己的歌單)
        if (playlist.userId !== userId) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.addsong.embed.accessDenied, iconURL: musicIcons.alertIcon })
                .setDescription(lang.addsong.embed.accessDeniedDescription);
            return await interaction.editReply({ embeds: [embed] });
        }

        // 🎵 4. 解析歌曲資訊 (重點修改)
        let query;
        const isUrl = /^https?:\/\/\S+/.test(songInput);

        if (isUrl) {
            // 如果是網址，清理一下
            const cleanUrl = cleanYouTubeURL(songInput);
            query = cleanUrl || songInput;
        } else {
            // 如果是關鍵字，加上搜尋前綴
            query = `ytsearch:${songInput}`;
        }

        const resolve = await client.riffy.resolve({
            query: query,
            requester: interaction.user.username
        });

        // ❌ 解析失敗
        if (!resolve || !resolve.tracks || resolve.tracks.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.addsong.embed.error, iconURL: musicIcons.alertIcon })
                .setDescription("❌ 找不到此歌曲，請確認網址或關鍵字正確。");
            return await interaction.editReply({ embeds: [embed] });
        }

        let songsToAdd = [];
        let addedDescription = "";

        // 📦 情況 A: 这是一个播放清单 (Playlist)
        if (resolve.loadType === 'PLAYLIST_LOADED') {
            for (const track of resolve.tracks) {
                songsToAdd.push({
                    name: track.info.title,
                    url: track.info.uri,
                    duration: track.info.length // 可以順便存長度
                });
            }
            addedDescription = `已將播放清單 **${resolve.playlistInfo.name}** 中的 **${resolve.tracks.length}** 首歌曲加入。`;
        } 
        // 🎵 情況 B: 單曲 (或是搜尋結果)
        else {
            const track = resolve.tracks[0]; // 取第一首
            songsToAdd.push({
                name: track.info.title,
                url: track.info.uri,
                duration: track.info.length
            });
            addedDescription = lang.addsong.embed.songAddedDescription
                .replace("{songInput}", track.info.title) // 這裡顯示解析後的正確歌名
                .replace("{playlistName}", playlistName);
        }

        // 💾 5. 存入資料庫
        await playlistCollection.updateOne(
            { _id: playlist._id }, // 使用 _id 確保更新到正確的那一個
            { $push: { songs: { $each: songsToAdd } } } // $each 支援一次加入多首
        );

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setAuthor({ 
                name: lang.addsong.embed.songAdded, 
                iconURL: musicIcons.correctIcon,
                url: config.SupportServer
            })
            .setDescription(addedDescription)
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error adding song:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setAuthor({ name: lang.addsong.embed.error, iconURL: musicIcons.alertIcon })
            .setDescription(lang.addsong.embed.errorDescription);

        // 處理 defer 狀態
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

module.exports = {
    name: 'addsong',
    description: '添加歌曲至歌單',
    permissions: '0x0000000000000800',
    options: [
        {
            name: 'playlist',
            description: '輸入歌單名字',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'input',
            description: '輸入歌曲名字/網址',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ],
    run: addSong
};
