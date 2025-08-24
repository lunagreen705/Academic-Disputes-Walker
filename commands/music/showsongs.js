const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { getCollections } = require('../../utils/db/mongodb.js');
const config = require("../../config.js");
const musicIcons = require('../../UI/icons/musicicons.js');

async function showSongs(client, interaction, lang) {
    try {
        // ✅ 取得集合
        const { playlistCollection } = getCollections();

        const playlistName = interaction.options.getString('playlist');
        const userId = interaction.user.id;

        const playlist = await playlistCollection.findOne({ name: playlistName });
        if (!playlist) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.showsongs.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.showsongs.embed.playlistNotFound);

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        if (playlist.isPrivate && playlist.userId !== userId) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: lang.showsongs.embed.accessDenied, iconURL: musicIcons.alertIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.showsongs.embed.noPermission);

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        const songs = playlist.songs || [];
        if (songs.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setAuthor({ name: lang.showsongs.embed.songsInPlaylist.replace("{playlistName}", playlistName), iconURL: musicIcons.playlistIcon, url: config.SupportServer })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.showsongs.embed.noSongs);

            await interaction.reply({ embeds: [embed] });
            return;
        }

        await interaction.deferReply();

        const chunkSize = 10;
        for (let i = 0; i < songs.length; i += chunkSize) {
            const chunk = songs.slice(i, i + chunkSize);
            const description = chunk.map((song, idx) => `${i + idx + 1}. ${song.name || song.url}`).join('\n');

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setAuthor({ 
                    name: lang.showsongs.embed.songsInPlaylistPage
                        .replace("{playlistName}", playlistName)
                        .replace("{currentPage}", Math.floor(i / chunkSize) + 1)
                        .replace("{totalPages}", Math.ceil(songs.length / chunkSize)), 
                    iconURL: musicIcons.playlistIcon,
                    url: config.SupportServer
                })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(description);

            await interaction.followUp({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error showing songs:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setAuthor({ name: lang.showsongs.embed.error, iconURL: musicIcons.alertIcon, url: config.SupportServer })
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
            .setDescription(lang.showsongs.embed.errorDescription);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

module.exports = {
    name: 'showsongs',
    description: '顯示歌單中所有歌曲名字',
    permissions: '0x0000000000000800',
    options: [
        { name: 'playlist', description: '輸入歌單名字', type: ApplicationCommandOptionType.String, required: true }
    ],
    run: showSongs
};
