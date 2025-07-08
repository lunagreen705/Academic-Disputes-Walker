// events/interactionCreate.js
const config = require("../config.js");
const { InteractionType } = require("discord.js");
const path = require("path");

module.exports = async (client, interaction) => {
    try {
        if (!interaction?.guild) {
            return interaction?.reply({
                content: "這個指令只能在伺服器中使用。",
                ephemeral: true,
            }).catch(() => {});
        }

        const languageFile = path.join(__dirname, `../languages/${config.language}.js`);
        const lang = require(languageFile);

        // ========== 核心優化：統一處理互動的「首次確認」 ==========
        // 確保任何互動在被進一步處理之前都被確認，防止 InteractionNotReplied 錯誤
        if (!interaction.deferred && !interaction.replied) {
            if (interaction.isButton() || interaction.isStringSelectMenu()) {
                // 對於按鈕和下拉選單，通常使用 deferUpdate
                await interaction.deferUpdate().catch(() => {});
            } else if (interaction.isChatInputCommand()) {
                // *** 關鍵修正點：斜線指令的 deferReply 應該在這裡！ ***
                await interaction.deferReply({ ephemeral: false }).catch(() => {});
            }
            // ModalSubmit 也可以在這裡 deferReply，但通常在 modal 提交的處理邏輯內部會自行 deferReply
        }


        // ========== 按鈕互動處理 ==========
        if (interaction.isButton()) {
            const customId = interaction.customId;

            const isMusicButton = [
                'loopToggle', 'showQueue', 'skipTrack', 'showLyrics', 'clearQueue',
                'stopTrack', 'pauseTrack', 'resumeTrack', 'volumeUp', 'volumeDown',
                'stopLyrics', 'fullLyrics', 'deleteLyrics'
            ].includes(customId);

            if (customId.startsWith('open-edit-modal:')) {
                // Modal 按鈕通常不需要在這裡 defer，因為 showModal 會直接回應
                const parts = customId.split(':');
                if (parts.length < 3) {
                    console.error(`[ERROR] open-edit-modal customId 格式錯誤: ${customId}`);
                    // 如果沒有確認過，就直接回覆錯誤
                    if (!interaction.replied && !interaction.deferred) {
                        return interaction.reply({ content: lang.errors.unknownButton, ephemeral: true }).catch(console.error);
                    } else {
                        return interaction.followUp({ content: lang.errors.unknownButton, ephemeral: true }).catch(console.error);
                    }
                }
                const taskId = parts[1];
                const userIdFromCustomId = parts[2];
                const taskCommand = client.commands.get('task');
                if (taskCommand && typeof taskCommand.handleModalTriggerButton === "function") {
                    try {
                        await taskCommand.handleModalTriggerButton(interaction, taskId, userIdFromCustomId);
                    } catch (e) {
                        console.error(`❌ taskModalTriggerButton 錯誤: ${e.stack || e}`);
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: lang.errors.generalError.replace("{error}", e.message), ephemeral: true }).catch(console.error);
                        } else {
                            await interaction.followUp({ content: lang.errors.generalError.replace("{error}", e.message), ephemeral: true }).catch(console.error);
                        }
                    }
                } else {
                    console.error(`[ERROR] 找不到 Task 指令或 handleModalTriggerButton: ${customId}`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: lang.errors.buttonHandlerNotFound, ephemeral: true }).catch(console.error);
                    } else {
                        await interaction.followUp({ content: lang.errors.buttonHandlerNotFound, ephemeral: true }).catch(console.error);
                    }
                }
                return;
            }

            if (customId.startsWith("library|")) {
                // library 按鈕現在會在最前端統一 deferUpdate，所以這裡不再重複
                const libraryCommand = client.commands.get("library"); 
                if (libraryCommand && typeof libraryCommand.handleButton === "function") {
                    try {
                        await libraryCommand.handleButton(interaction); // 內部應使用 editReply 或 update
                    } catch (e) {
                        console.error(`❌ library handleButton 錯誤: ${e.stack || e}`);
                        await interaction.followUp({ content: lang.errors.generalButtonError, ephemeral: true }).catch(console.error);
                    }
                } else {
                    console.error(`[ERROR] 找不到 Library 指令或 handleButton: ${customId}`);
                    await interaction.followUp({ content: lang.errors.buttonHandlerNotFound, ephemeral: true }).catch(console.error);
                }
                return;
            }
            
            // 如果是音樂按鈕，它已經在最前端被 deferUpdate 了，這裡直接返回讓 player.js 處理即可
            if (isMusicButton) {
                return;
            }

            // 如果按鈕既不是 open-edit-modal，也不是 library，也不是音樂按鈕，那就是未處理的通用按鈕
            // 它也已經在最前端被 deferUpdate 了
            console.warn(`[WARN] 未處理的按鈕互動: ${customId}`);
            await interaction.followUp({ content: lang.errors.unknownButton, ephemeral: true }).catch(console.error);
            return;
        }

        // ========== 下拉選單互動處理 ==========
        if (interaction.isStringSelectMenu()) {
            // 下拉選單已經在最前端統一 deferUpdate，這裡直接進行邏輯判斷
            const customId = interaction.customId;
            // ... (處理 tarot 和 task 的選單邏輯，它們內部應使用 editReply/followUp) ...
            return; // 確保處理完畢後返回
        }

        // ========== Modal 提交處理 ==========
        else if (interaction.isModalSubmit()) {
            const customId = interaction.customId;
            const parts = customId.split(':');
            if (parts.length < 3) {
                console.error(`[ERROR] Modal 提交 customId 格式錯誤: ${customId}`);
                await interaction.reply({ content: lang.errors.unknownModal, ephemeral: true }).catch(console.error);
                return;
            }
            const actionType = parts[0];
            const taskId = parts[1];
            const userIdFromCustomId = parts[2];

            // Modal 提交後通常需要延遲回覆，確保處理時間。這裡仍然保持 deferReply
            await interaction.deferReply({ ephemeral: true }).catch(() => {});

            if (actionType.startsWith('edit-task-modal')) {
                const taskCommand = client.commands.get('task');
                if (taskCommand && typeof taskCommand.handleModalSubmit === "function") {
                    try {
                        await taskCommand.handleModalSubmit(client, interaction, actionType, taskId, userIdFromCustomId);
                    } catch (e) {
                        console.error(`❌ task Modal 處理函數錯誤: ${e.stack || e}`);
                        await interaction.followUp({ content: lang.errors.generalError.replace("{error}", e.message), ephemeral: true }).catch(console.error);
                    }
                } else {
                    console.error(`[ERROR] 找不到 Task 指令或 handleModalSubmit: ${customId}`);
                    await interaction.followUp({ content: lang.errors.modalHandlerNotFound, ephemeral: true }).catch(console.error);
                }
                return;
            } else {
                console.warn(`[WARN] 未處理的 Modal 提交互動: ${customId}`);
                await interaction.followUp({ content: lang.errors.unknownModal, ephemeral: true }).catch(console.error);
                return;
            }
        }

        // ========== 自動補全（Autocomplete）處理 ==========
        if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
            const command = client.commands.get(interaction.commandName);
            if (command && typeof command.autocomplete === "function") {
                try {
                    await command.autocomplete(interaction); // Autocomplete 必須直接回覆
                } catch (e) { console.error("❌ Autocomplete 發生錯誤:", e); }
            }
            return;
        }

        // ========== 斜線指令處理 ==========
        if (interaction.type === InteractionType.ApplicationCommand) {
            // 斜線指令已經在最前端被 deferReply 了，這裡直接進行邏輯判斷
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                // 由於已經 deferReply 了，這裡使用 editReply
                return interaction.editReply({ content: lang.errors.commandNotFound, ephemeral: true });
            }

            try {
                const defaultPermissions = '0x0000000000000800'; 
                const requiredPermissions = command.permissions || defaultPermissions;

                const hasPermission = interaction?.member?.permissions?.has(requiredPermissions); 
                if (!hasPermission) {
                    // 由於已經 deferReply 了，這裡使用 editReply
                    return interaction.editReply({ content: lang.errors.noPermission, ephemeral: true });
                }
                // 執行指令的 run 函數。它現在可以假設互動已被 deferReply，內部應使用 editReply/followUp
                await command.run(client, interaction, lang);
            } catch (e) {
                console.error(`❌ 指令執行錯誤: ${e.stack || e}`);
                // 通用錯誤處理，確保回覆
                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({
                        content: lang.errors.generalError.replace("{error}", e.message),
                        embeds: [],
                        components: [],
                    }).catch(console.error);
                } else {
                    // 這種情況不應該發生，因為最前端已經 deferReply 了，但作為最終防護
                    return interaction.reply({
                        content: lang.errors.generalError.replace("{error}", e.message),
                        ephemeral: true,
                    }).catch(console.error);
                }
            }
        }
    } catch (e) {
        console.error("❌ 總處理器發生嚴重錯誤:", e.stack || e);
    }
};