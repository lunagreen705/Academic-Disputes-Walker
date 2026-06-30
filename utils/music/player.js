// player.js
const { Riffy, Player } = require("riffy");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionsBitField } = require("discord.js");
const { requesters } = require("../../commands/music/play.js"); 
const { Dynamic } = require("musicard");
const config = require("../../config.js");
const musicIcons = require('../../UI/icons/musicicons.js');
const colors = require('../../UI/colors/colors.js');
const fs = require("fs");
const path = require("path");
const axios = require('axios');
const { getCollections } = require('../db/mongodb.js');
const guildTrackMessages = new Map();

async function sendMessageWithPermissionsCheck(channel, embed, attachment, actionRow1, actionRow2) {
    try {
        const permissions = channel.permissionsFor(channel.guild.members.me);
        if (!permissions.has(PermissionsBitField.Flags.SendMessages) ||
            !permissions.has(PermissionsBitField.Flags.EmbedLinks) ||
            !permissions.has(PermissionsBitField.Flags.AttachFiles) ||
            !permissions.has(PermissionsBitField.Flags.UseExternalEmojis)) {
            console.error("Bot lacks necessary permissions to send messages in this channel.");
            return;
        }

        const message = await channel.send({
            embeds: [embed],
            files: [attachment],
            components: [actionRow1, actionRow2] 
        });
        return message;
    } catch (error) {
        console.error("Error sending message:", error.message);
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setDescription("⚠️ **Unable to send message. Check bot permissions.**");
        await channel.send({ embeds: [errorEmbed] });
    }
}

function initializePlayer(client) {
    const nodes = config.nodes.map(node => ({
        name: node.name,
        host: node.host,
        port: node.port,
        password: node.password,
        secure: node.secure,
        reconnectTimeout: 5000,
        reconnectTries: Infinity
    }));

    client.riffy = new Riffy(client, nodes, {
        send: (payload) => {
            const guildId = payload.d.guild_id;
            if (!guildId) return;

            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
        defaultSearchPlatform: "ytmsearch",
        restVersion: "v4",
        bypassChecks: {
        nodeFetchInfo: false
    }
    });
client.riffy.on("nodeDisconnect", (node, reason) => {
    console.log(`[ LAVALINK ] Node ${node.name} disconnected ❌ | ${reason || "Unknown reason"}`);
    
    let attempts = 0;
    const tryReconnect = async () => {
        try {
            attempts++;
            await node.connect();
            console.log(`[ LAVALINK ] Node ${node.name} reconnected ✅ (after ${attempts} attempts)`);
        } catch (err) {
            console.error(`[ LAVALINK ] Node ${node.name} reconnect failed ❌ | ${err.message}`);
            setTimeout(tryReconnect, 5000);
        }
    };
    setTimeout(tryReconnect, 5000);
});
    client.riffy.on("nodeConnect", node => {
        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.green}Node ${node.name} Connected ✅${colors.reset}`);
    });
    
    client.riffy.on("nodeError", (node, error) => {
        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.red}Node ${node.name} Error ❌ | ${error.message}${colors.reset}`);
    });

    client.riffy.on("trackStart", async (player, track) => {
        const channel = client.channels.cache.get(player.textChannel);
        if (!channel) {
            console.error(`Error: Text channel ${player.textChannel} not found for guild ${player.guildId}`);
            return;
        }
        const guildId = player.guildId;
        const trackUri = track.info.uri;
        let requesterDisplay = "Autoplay/Unknown";
        const requesterUser = requesters.get(trackUri);
        if (requesterUser) {
            requesterDisplay = typeof requesterUser === 'string' ? requesterUser : (requesterUser.tag || requesterUser.username || "User");
        }


        await cleanupPreviousTrackMessages(channel, guildId);

        try {
            const musicard = await Dynamic({
                thumbnailImage: track.info.thumbnail || 'https://example.com/default_thumbnail.png',
                backgroundColor: '#070707',
                progress: 10,
                progressColor: '#FF7A00',
                progressBarColor: '#5F2D00',
                name: track.info.title,
                nameColor: '#FF7A00',
                author: track.info.author || 'Unknown Artist',
                authorColor: '#696969',
            });

            const cardPath = path.join(__dirname, 'musicard.png');
            fs.writeFileSync(cardPath, musicard);

            const attachment = new AttachmentBuilder(cardPath, { name: 'musicard.png' });
            const embed = new EmbedBuilder()
            .setAuthor({ 
                name: '正在播放♫..', 
                iconURL: musicIcons.playerIcon,
                url: config.SupportServer
            })
            .setFooter({ text: `行走的學術糾紛ver1.0`, iconURL: musicIcons.heartIcon })
            .setTimestamp()
            .setDescription(  
                `- **標題:** [${track.info.title}](${track.info.uri})\n` +
                `- **作者:** ${track.info.author || 'Unknown Artist'}\n` +
                `- **長度:** ${formatDuration(track.info.length)}\n` +
                `- **使用者:** ${requesterDisplay}\n` + 
                `- **來源:** ${track.info.sourceName}\n` + '**- 功能 :**\n 🔁 `循環`, 📜 `播放歌單`, ⏭️ `跳過`, 🎤 `歌詞`, 🗑️ `清空播放歌單`\n ⏹️ `退出`, ⏸️ `暫停`, ▶️ `恢復播放`, 🔊 `聲量 +`, 🔉 `聲量 -`')
            .setImage('attachment://musicard.png')
            .setColor('#FF7A00');
            
            // --- 顯示佇列 (Up Next) ---
            const queue = player.queue;
            let upNextString = "播放清單是空的."; 

            if (queue && queue.length > 0) {
                const displayLimit = 5; 
                upNextString = queue.slice(0, displayLimit)
                    .map((queuedTrack, index) => {
                        let title = queuedTrack.info.title;
                        if (title.length > 40) title = title.substring(0, 37) + "..."; 
                        
                        const queuedRequesterUser = requesters.get(queuedTrack.info.uri);
                        let requesterInfo = "";
                        if (queuedRequesterUser) {
                            requesterInfo = ` (by ${typeof queuedRequesterUser === 'string' ? queuedRequesterUser : (queuedRequesterUser.tag || queuedRequesterUser.username || 'User')})`;
                        }
                        if ((`${index + 1}. ${title}${requesterInfo}`).length > 90) { 
                            title = queuedTrack.info.title.substring(0, 25) + "..."; 
                        }
                        return `${index + 1}. ${title}${requesterInfo}`;
                    })
                    .join('\n');

                if (queue.length > displayLimit) {
                    upNextString += `\n...and ${queue.length - displayLimit} more.`;
                }
            }
            
            embed.addFields({ name: '🎶 下一首是:', value: upNextString.substring(0, 1020) });
            // --- 佇列資訊結束 ---


            const actionRow1 = createActionRow1(false);
            const actionRow2 = createActionRow2(false);

            const message = await sendMessageWithPermissionsCheck(channel, embed, attachment, actionRow1, actionRow2);
            
            if (message) {
                if (!guildTrackMessages.has(guildId)) {
                    guildTrackMessages.set(guildId, []);
                }
                guildTrackMessages.get(guildId).push({
                    messageId: message.id,
                    channelId: channel.id,
                    type: 'track'
                });

                const collector = setupCollector(client, player, channel, message);
            }

        } catch (error) {
            console.error("Error creating or sending music card:", error.message);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription("⚠️ **Unable to load track card. Continuing playback...**");
            if (channel) await channel.send({ embeds: [errorEmbed] });
        }
    });

    client.riffy.on("trackEnd", async (player) => {
    });

    client.riffy.on("playerDisconnect", async (player) => {
        await cleanupTrackMessages(client, player, ['track', 'lyrics']); 
    });

   client.riffy.on("queueEnd", async (player) => {
    const channel = client.channels.cache.get(player.textChannel);
    const guildId = player.guildId;

    await cleanupTrackMessages(client, player, ['track']);

    try {
    
        const { autoplayCollection } = getCollections();

        const autoplaySetting = await autoplayCollection.findOne({ guildId });

        if (autoplaySetting?.autoplay) {
        
            const previousTrack = player.current;
            const nextTrack = await player.autoplay(previousTrack || player);

            if (!nextTrack) {
                if (channel) await channel.send("⚠️ **播放歌單已耗盡，無意義的連線將被中止**").catch(console.error);
                if (!player.destroyed) player.destroy();
            }
} else {
    if (channel) {
        channel.send("🎶 **歌單終止，自動播放功能亦隨之熄滅。你準備好面對寂靜了嗎？**")
            .then(msg => {
                setTimeout(() => msg.delete().catch(console.error), 3000); // 3秒後刪除
            })
            .catch(console.error);
    }
    if (!player.destroyed) player.destroy();
}
    } catch (error) {
        console.error("Error handling autoplay or queue end:", error);
        if (!player.destroyed) player.destroy();
        if (channel) await channel.send("👾**已無曲目可用，自動播放失效。我將撤退至以太之中**").catch(console.error);
    }
});
}

async function cleanupPreviousTrackMessages(channel, guildId) {
    const messages = guildTrackMessages.get(guildId) || [];
    const messagesToDelete = messages.filter(m => m.type === 'track'); // 只選取 'track' 類型

    for (const messageInfo of messagesToDelete) {
        try {
            const fetchChannel = channel.client.channels.cache.get(messageInfo.channelId);
            if (fetchChannel) {
                const message = await fetchChannel.messages.fetch(messageInfo.messageId).catch(() => null);
                if (message) {
                    await message.delete().catch(() => {});
                }
            }
        } catch (error) {
            console.error("Error cleaning up previous track message:", error);
        }
    }
    // 從 guildTrackMessages 中移除已刪除的 'track' 訊息，保留其他類型
    const remainingMessages = messages.filter(m => m.type !== 'track');
    if (remainingMessages.length > 0) {
        guildTrackMessages.set(guildId, remainingMessages);
    } else {
        guildTrackMessages.delete(guildId);
    }
}

async function cleanupTrackMessages(client, player, typesToDelete = ['track']) { // typesToDelete 預設只刪除 'track'
    const guildId = player.guildId;
    const messages = guildTrackMessages.get(guildId) || [];
    const messagesOfTypeToDelete = messages.filter(m => typesToDelete.includes(m.type));

    for (const messageInfo of messagesOfTypeToDelete) {
        try {
            const channel = client.channels.cache.get(messageInfo.channelId);
            if (channel) {
                const message = await channel.messages.fetch(messageInfo.messageId).catch(() => null);
                if (message) {
                    await message.delete().catch(() => {});
                }
            }
        } catch (error) {
            console.error("Error cleaning up track message:", error);
        }
    }

    const remainingMessages = messages.filter(m => !typesToDelete.includes(m.type));
    if (remainingMessages.length > 0) {
        guildTrackMessages.set(guildId, remainingMessages);
    } else {
        guildTrackMessages.delete(guildId);
    }
}

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    return [
        hours > 0 ? `${hours}h` : null,
        minutes > 0 ? `${minutes}m` : null,
        seconds > 0 ? `${seconds}s` : (minutes > 0 || hours > 0 ? null : '0s'), // 確保至少顯示 0s 如果時和分都為0
    ]
        .filter(Boolean)
        .join(' ') || '0s'; // 如果結果為空 (例如 ms < 1000 且秒為0)，則返回 '0s'
}

function setupCollector(client, player, channel, message) {
    const filter = i => [
        'loopToggle', 'showQueue', 'skipTrack', 'showLyrics', 'clearQueue', // 'disableLoop' 已被 'showQueue' 取代
        'stopTrack', 'pauseTrack', 'resumeTrack', 'volumeUp', 'volumeDown'
    ].includes(i.customId); // <--- 加入 'showQueue'

    const collector = message.createMessageComponentCollector({ filter, time: player.current?.info.length || 600000 }); // 以歌曲長度或10分鐘為超時

    collector.on('collect', async i => {
        await i.deferUpdate();

        const member = i.member;
        const voiceChannel = member.voice.channel;
        // const playerChannel = player.voiceChannel; // Riffy player.voiceChannel 是 ID
        const botVoiceChannelId = client.guilds.cache.get(player.guildId)?.members.me?.voice?.channelId;


        if (!voiceChannel || voiceChannel.id !== botVoiceChannelId) {
            const vcEmbed = new EmbedBuilder()
                .setColor(config.embedColor || '#FF7A00')
                .setDescription('🔒 **你尚未踏入本研究室，便妄圖干預？**');
            
            // 使用 i.followUp 發送臨時訊息
            await i.followUp({ embeds: [vcEmbed], ephemeral: true }).catch(console.error);
            return;
        }
        // 傳遞 client 和原始 "Now Playing" message 給 handleInteraction
        handleInteraction(i, player, channel, client, message); 
    });

    collector.on('end', (collected, reason) => {
        console.log(`Collector ended for message ${message.id}. Reason: ${reason}. Disabling components.`);
        if (message.editable) {
            const disabledActionRow1 = createActionRow1(true);
            const disabledActionRow2 = createActionRow2(true);
            message.edit({ components: [disabledActionRow1, disabledActionRow2] }).catch(err => {
                if (err.code !== 10008) { // Unknown Message (已被刪除)
                    console.error("Error disabling components on collector end:", err);
                }
            });
        }
    });

    return collector;
}

// handleInteraction 現在接收 client 和 originalMessage
async function handleInteraction(i, player, channel, client, originalMessage) { 
    switch (i.customId) {
        case 'loopToggle':
            toggleLoop(player, channel); // 已修改 toggleLoop
            break;
        case 'showQueue': // <--- 新增 case
            const queue = player.queue;
            const currentTrack = player.current;

            let description = "";
            if (currentTrack) {
                const requesterUserCurrent = requesters.get(currentTrack.info.uri);
                let requesterDisplayCurrent = "Autoplay/Unknown";
                if (requesterUserCurrent) {
                     requesterDisplayCurrent = typeof requesterUserCurrent === 'string' ? requesterUserCurrent : (requesterUserCurrent.tag || requesterUserCurrent.username || "User");
                }
                description += `**現在播放...:**\n[${currentTrack.info.title.substring(0, 60)}](${currentTrack.info.uri}) [${formatDuration(currentTrack.info.length)}] (by ${requesterDisplayCurrent})\n\n`;
            } else {
                description += "**沒有正在播放的歌曲**\n\n";
            }

            if (!queue || queue.length === 0) {
                description += "🎶 **歌單空無一物**";
            } else {
                description += "**🎶 下一首是**\n";
                const maxTracksToShow = 10;
                let queueTracksString = queue.slice(0, maxTracksToShow)
                    .map((track, index) => {
                        let title = track.info.title;
                        if (title.length > 45) title = title.substring(0, 42) + "...";
                        
                        const requesterUserNext = requesters.get(track.info.uri);
                        let requesterDisplayNext = "Autoplay/Unknown";
                        if (requesterUserNext) {
                            requesterDisplayNext = typeof requesterUserNext === 'string' ? requesterUserNext : (requesterUserNext.tag || requesterUserNext.username || "User");
                        }
                        return `${index + 1}. ${title} [${formatDuration(track.info.length)}] (by ${requesterDisplayNext})`;
                    })
                    .join('\n');
                description += queueTracksString;

                if (queue.length > maxTracksToShow) {
                    description += `\n\n...還有 ${queue.length - maxTracksToShow} 首歌.`;
                }
            }

            const queueEmbed = new EmbedBuilder()
                .setColor(config.embedColor || '#FF7A00')
                .setTitle('🎶 播放歌單')
                .setDescription(description.substring(0, 4090)) // 確保不超過限制
                .setFooter({ text: `歌單曲目總數: ${queue?.length || 0}` });
            
            // 使用 interaction (i) 來回覆臨時訊息
            await i.followUp({ embeds: [queueEmbed], ephemeral: true });
            break;
        case 'skipTrack':
            if (player.queue.length === 0 && player.loop !== "track") {
                 await sendEmbed(channel, "⏭️ **歌單盡失，跳轉無門。請勿妄圖逾越禁忌**", i); // 傳遞 i
            } else {
                player.stop(); 
                await sendEmbed(channel, "⏭️ **暗影指引聲波流轉，下一首歌曲呼之欲出。**", i); // 傳遞 i
            }
            break;
        // case 'disableLoop': // 已被取代
        //     disableLoop(player, channel);
        //     break;
        case 'showLyrics':
            showLyrics(channel, player, client); // 傳遞 client
            break;
        case 'clearQueue':
            if (player.queue.length > 0) {
                player.queue.clear();
                await sendEmbed(channel, "🗑️ **播放歌單已被清除，一切歸於虛無**", i); // 傳遞 i

                if (originalMessage && originalMessage.embeds.length > 0 && originalMessage.editable) {
                    try {
                        const currentEmbed = originalMessage.embeds[0];
                        const newEmbed = EmbedBuilder.from(currentEmbed); 

                        const queueFieldIndex = newEmbed.data.fields?.findIndex(field => field.name === '🎶 下一首是:');
                        if (queueFieldIndex !== undefined && queueFieldIndex > -1) {
                            newEmbed.data.fields[queueFieldIndex].value = "歌單空無一物";
                        } else { 
                            newEmbed.addFields({ name: '🎶 下一首是:', value: "歌單空無一物" });
                        }
                        await originalMessage.edit({ embeds: [newEmbed] });
                    } catch(editError) {
                        console.error("Error editing original message for clearQueue:", editError);
                    }
                }
            } else {
                await sendEmbed(channel, "🗑️ **播放歌單早已空無一物，恍若虛無的深淵**", i); // 傳遞 i
            }
            break;
        case 'stopTrack':
            await sendEmbed(channel, '⏹️ **播放已終止，即將從此界脫離**', i); // 傳遞 i
            if (!player.destroyed) player.destroy(); 
            break;
        case 'pauseTrack':
            if (player.paused) {
                await sendEmbed(channel, '⏸️ **聲音已陷沉寂，請勿重複操作**', i); // 傳遞 i
            } else {
                player.pause(true);
                await sendEmbed(channel, '⏸️ **播放已被暫停，音流暫歇於深淵之中**', i); // 傳遞 i
            }
            break;
        case 'resumeTrack':
            if (!player.paused) {
                await sendEmbed(channel, '▶️ **播放已恢復，勿再贅述此事**', i); // 傳遞 i
            } else {
                player.pause(false);
                await sendEmbed(channel, '▶️ **播放已復歸，音律重返混沌深淵**', i); // 傳遞 i
            }
            break;
        case 'volumeUp':
            adjustVolume(player, channel, 10, i); // 傳遞 i
            break;
        case 'volumeDown':
            adjustVolume(player, channel, -10, i); // 傳遞 i
            break;
    }
}

// 修改 sendEmbed 以支持 interaction 回覆 (用於按鈕後的臨時訊息)
async function sendEmbed(channel, messageContent, interaction = null) {
    const embed = new EmbedBuilder().setColor(config.embedColor || '#FF7A00').setDescription(messageContent);
    if (interaction) { // 如果是按鈕互動，使用 followUp 發送臨時訊息
        await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(console.error);
    } else { // 否則，發送到頻道並在一段時間後刪除
        const sentMessage = await channel.send({ embeds: [embed] }).catch(console.error);
        if (sentMessage) {
            setTimeout(() => sentMessage.delete().catch(err => {
                if (err.code !== 10008) console.error("Error deleting temporary embed:", err);
            }), (config.embedTimeout || 5) * 1000);
        }
        return sentMessage; // 返回訊息對象，以便外部可以操作 (例如歌詞的 fetchingMessage)
    }
}


function adjustVolume(player, channel, amount, interaction = null) { // 接收 interaction
    const currentVolume = player.volume;
    let newVolume = currentVolume + amount;
    newVolume = Math.min(150, Math.max(0, newVolume)); 

    if (newVolume === currentVolume) {
        if (amount > 0 && currentVolume === 150) {
            sendEmbed(channel, '🔊 **Volume is already at maximum (150%)!**', interaction);
        } else if (amount < 0 && currentVolume === 0) {
            sendEmbed(channel, '🔉 **Volume is already at minimum (0%)!**', interaction);
        } else { // 音量未變，但不在極限值 (例如，嘗試增加 0)
             sendEmbed(channel, `🔊 **Volume is already ${newVolume}%!**`, interaction);
        }
    } else {
        player.setVolume(newVolume);
        sendEmbed(channel, `🔊 **Volume changed to ${newVolume}%!**`, interaction);
    }
}

// 修改後的 toggleLoop
function toggleLoop(player, channel, interaction = null) { // 接收 interaction
    let newLoopMode;
    let messageText; // 重命名避免與 collector 中的 message 變數衝突

    if (player.loop === "none" || !player.loop) { 
        newLoopMode = "track";
        messageText = "🔁 **單曲循環**";
    } else if (player.loop === "track") {
        newLoopMode = "queue";
        messageText = "🔁 **歌單循環**";
    } else { // player.loop === "queue"
        newLoopMode = "none"; 
        messageText = "❌ **關閉循環**";
    }
    player.setLoop(newLoopMode);
    sendEmbed(channel, messageText, interaction);
}

// disableLoop 函數現在不再被按鈕直接調用，但可以保留作為內部輔助函數或移除
// function disableLoop(player, channel, interaction = null) { 
//     if (player.loop === "none") {
//         sendEmbed(channel, "❌ **Loop is already disabled!**", interaction);
//     } else {
//         player.setLoop("none");
//         sendEmbed(channel, "❌ **Loop is disabled!**", interaction);
//     }
// }


async function getLyrics(trackName, artistName, duration) {
    try {
        trackName = trackName
            .replace(/\b(Official|Audio|Video|Lyrics|Theme|Soundtrack|Music|Full Version|HD|4K|Visualizer|Radio Edit|Live|Remix|Mix|Extended|Cover|Parody|Performance|Version|Unplugged|Reupload|Feat|Ft)\b/gi, "")
            .replace(/\s*[-_/|]\s*/g, " ")
            .replace(/[()\[\]{}]/g, "") 
            .replace(/\s+/g, " ")
            .trim();

        artistName = artistName
            .replace(/\b(Topic|VEVO|Records|Label|Productions|Entertainment|Ltd|Inc|Band|DJ|Composer|Performer|Feat|Ft)\b/gi, "")
            .replace(/ x /gi, " & ")
            .replace(/[()\[\]{}]/g, "") 
            .replace(/\s+/g, " ")
            .trim();
        
        let response = await axios.get(`https://lrclib.net/api/get`, {
            params: { track_name: trackName, artist_name: artistName, duration }
        });

        if (response.data && (response.data.syncedLyrics || response.data.plainLyrics)) {
            return response.data.syncedLyrics || response.data.plainLyrics;
        }
        
        // 如果第一次找不到，不帶 duration 再次嘗試
        response = await axios.get(`https://lrclib.net/api/get`, {
            params: { track_name: trackName, artist_name: artistName }
        });

        if (response.data && (response.data.syncedLyrics || response.data.plainLyrics)) {
            return response.data.syncedLyrics || response.data.plainLyrics;
        }
        return null;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            // console.log(`Lyrics not found on Lrclib for: ${trackName} - ${artistName}`);
        } else {
            console.error("❌ 歌詞擷取失敗，迷霧掩藏了真相:", error.response?.data?.message || error.message);
        }
        return null;
    }
}


async function showLyrics(channel, player, client) { 
    if (!player || !player.current || !player.current.info) {
        // 使用 sendEmbed 發送臨時通知，而不是直接用 interaction 回覆，因為 showLyrics 可能不是由按鈕觸發
        await sendEmbed(channel, "🚫 **此刻，聲音之海靜止無波**"); 
        return;
    }

    const track = player.current.info;
    
    // 嘗試獲取歌詞前先發送 "Fetching..." 訊息
    const fetchingMsgObject = await sendEmbed(channel, `🎤 **正於幽暗深淵中尋覓歌詞痕跡…… ${track.title.substring(0,50)}...**`);

    const lyrics = await getLyrics(track.title, track.author, Math.floor(track.length / 1000));
    
    // 刪除 "Fetching..." 訊息
    if (fetchingMsgObject && typeof fetchingMsgObject.delete === 'function') {
         await fetchingMsgObject.delete().catch(() => {});
    }


    if (!lyrics) {
        await sendEmbed(channel, "❌ **歌詞遺失於虛空，沉淪於無盡黑暗之中**");
        return;
    }

    const lines = lyrics.split('\n').map(line => line.trim()).filter(Boolean);
    const songDuration = Math.floor(track.length / 1000); 

    const embed = new EmbedBuilder()
        .setTitle(`🎵 即時歌詞: ${track.title.substring(0, 250)}`)
        .setDescription("🔄 歌詞正與旋律交織，節奏於暗影間律動...")
        .setColor(config.embedColor || '#FF7A00');

    const stopButton = new ButtonBuilder()
        .setCustomId("stopLyrics")
        .setLabel("歌詞之幕已然落下，靜謐隨之降臨")
        .setStyle(ButtonStyle.Danger);

    const fullButton = new ButtonBuilder()
        .setCustomId("fullLyrics")
        .setLabel("歌詞全卷，逐字揭示於幽暗之中")
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(fullButton, stopButton);
    
    const permissions = channel.permissionsFor(channel.guild.members.me);
    if (!permissions.has(PermissionsBitField.Flags.SendMessages) || !permissions.has(PermissionsBitField.Flags.EmbedLinks)) {
        console.error("Bot lacks permissions for lyrics message in channel:", channel.id);
        await sendEmbed(channel, "⚠️ 權限受限，歌詞顯示受阻，請另尋顯示之所");
        return;
    }

    const message = await channel.send({ embeds: [embed], components: [row] }).catch(err => {
        console.error("Error sending lyrics message:", err);
        return null;
    });
    if (!message) return;

    const guildId = player.guildId;
    if (!guildTrackMessages.has(guildId)) {
        guildTrackMessages.set(guildId, []);
    }
    const lyricsMessageInfo = {
        messageId: message.id,
        channelId: channel.id,
        type: 'lyrics', 
        intervalId: null 
    };
    guildTrackMessages.get(guildId).push(lyricsMessageInfo);

    const updateLyrics = async () => {
        if (!player || player.destroyed || !player.current || player.current.info.uri !== track.uri || message.deleted) {
            clearInterval(lyricsMessageInfo.intervalId);
            if (message && !message.deleted) {
                await message.delete().catch(() => {});
            }
            const currentMessages = guildTrackMessages.get(guildId) || [];
            guildTrackMessages.set(guildId, currentMessages.filter(m => m.messageId !== message.id));
            return;
        }

        const currentTime = Math.floor(player.position / 1000); 
        const totalLines = lines.length;
        const linesPerSecond = songDuration > 0 ? totalLines / songDuration : 0; 
        const currentLineIndex = Math.floor(currentTime * linesPerSecond); 

        const start = Math.max(0, currentLineIndex - 3);
        const end = Math.min(totalLines, currentLineIndex + 4); 
        const visibleLines = lines.slice(start, end).join('\n');

        embed.setDescription(visibleLines.substring(0, 4090)); 
        if (message && !message.deleted) {
             await message.edit({ embeds: [embed] }).catch(err => {
                 if (err.code !== 10008) console.error("Error editing lyrics message:", err);
                 else { 
                    clearInterval(lyricsMessageInfo.intervalId);
                    const currentMessages = guildTrackMessages.get(guildId) || [];
                    guildTrackMessages.set(guildId, currentMessages.filter(m => m.messageId !== message.id));
                 }
             });
        } else { // message might have been deleted externally
            clearInterval(lyricsMessageInfo.intervalId);
            const currentMessages = guildTrackMessages.get(guildId) || [];
            guildTrackMessages.set(guildId, currentMessages.filter(m => m.messageId !== message.id));
        }
    };

    lyricsMessageInfo.intervalId = setInterval(updateLyrics, 3000); 
    updateLyrics(); 

    const collector = message.createMessageComponentCollector({ time: track.length > 0 ? track.length + 60000 : 600000 });

    collector.on('collect', async i => {
        await i.deferUpdate();
        
        const member = i.member;
        const voiceChannel = member.voice.channel;
        const botVoiceChannelId = client.guilds.cache.get(player.guildId)?.members.me?.voice?.channelId;
        if (!voiceChannel || voiceChannel.id !== botVoiceChannelId) {
            await i.followUp({ 
                embeds: [new EmbedBuilder().setColor(config.embedColor || '#FF7A00').setDescription('🔒 **若欲觸及歌詞之奧秘，必先於同一聲頻共處，方能引靈共鳴**')],
                ephemeral: true 
            });
            return;
        }

        if (i.customId === "stopLyrics") {
            clearInterval(lyricsMessageInfo.intervalId);
            if (message && !message.deleted) await message.delete().catch(() => {});
        } else if (i.customId === "fullLyrics") {
            clearInterval(lyricsMessageInfo.intervalId);
            embed.setDescription(lines.join('\n').substring(0, 4090)); 
        
            const deleteButton = new ButtonBuilder()
                .setCustomId("deleteLyrics")
                .setLabel("Delete Lyrics")
                .setStyle(ButtonStyle.Danger);
        
            const deleteRow = new ActionRowBuilder().addComponents(deleteButton);
            if (message && !message.deleted) await message.edit({ embeds: [embed], components: [deleteRow] }).catch(() => {});
        } else if (i.customId === "deleteLyrics") {
            clearInterval(lyricsMessageInfo.intervalId); 
            if (message && !message.deleted) await message.delete().catch(() => {});
        }
        // 如果是按鈕操作導致訊息被刪除或 collector 停止，從 guildTrackMessages 移除
        if ((i.customId === "stopLyrics" || i.customId === "deleteLyrics") || (message && message.deleted)){
            const currentMessages = guildTrackMessages.get(guildId) || [];
            guildTrackMessages.set(guildId, currentMessages.filter(m => m.messageId !== message.id));
        }
    });

    collector.on('end', () => {
        clearInterval(lyricsMessageInfo.intervalId);
        if (message && !message.deleted) {
            message.delete().catch(() => {}); 
        }
        const currentMessages = guildTrackMessages.get(guildId) || [];
        guildTrackMessages.set(guildId, currentMessages.filter(m => m.messageId !== message.id));
    });
}

// 修改 createActionRow1
function createActionRow1(disabled) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId("loopToggle").setEmoji('🔁').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("showQueue").setEmoji('📜').setStyle(ButtonStyle.Secondary).setDisabled(disabled), // <--- 替換按鈕
            new ButtonBuilder().setCustomId("skipTrack").setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("showLyrics").setEmoji('🎤').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("clearQueue").setEmoji('🗑️').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
        );
}

function createActionRow2(disabled) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId("stopTrack").setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(disabled),
            new ButtonBuilder().setCustomId("pauseTrack").setEmoji('⏸️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("resumeTrack").setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("volumeUp").setEmoji('🔊').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("volumeDown").setEmoji('🔉').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
        );
}

module.exports = { initializePlayer };
