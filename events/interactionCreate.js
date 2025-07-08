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
                // 對於斜線指令，在最前端統一 deferReply
                await interaction.deferReply({ ephemeral: false }).catch(() => {});
            }
            // ModalSubmit 也可以在這裡 deferReply，但通常在 modal 提交的處理邏輯內部會自行 deferReply
        }
        // ========== 按鈕互動處理 ==========
        if (interaction.isButton()) {
            const customId = interaction.customId;

            // 檢查是否是音樂相關的按鈕 customId
            const isMusicButton = [
                'loopToggle', 'showQueue', 'skipTrack', 'showLyrics', 'clearQueue',
                'stopTrack', 'pauseTrack', 'resumeTrack', 'volumeUp', 'volumeDown'
            ].includes(customId) || customId.startsWith("fullLyrics") || customId.startsWith("stopLyrics") || customId.startsWith("deleteLyrics"); // 也要包含歌詞相關的按鈕

            // 針對 'open-edit-modal' 按鈕（彈出 Modal，不需 defer）
            if (customId.startsWith('open-edit-modal:')) {
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
                return; // 處理完畢後直接返回
            }

            // 針對 'library|' 按鈕
            if (customId.startsWith("library|")) {
                // 對於 library 按鈕，先進行 deferUpdate
                await interaction.deferUpdate().catch(() => {}); // 確保只有這裡進行 defer
                const libraryCommand = client.commands.get("library"); 
                if (libraryCommand && typeof libraryCommand.handleButton === "function") {
                    try {
                        await libraryCommand.handleButton(interaction);
                    } catch (e) {
                        console.error(`❌ library handleButton 錯誤: ${e.stack || e}`);
                        await interaction.followUp({ content: lang.errors.generalButtonError, ephemeral: true }).catch(console.error);
                    }
                } else {
                    console.error(`[ERROR] 找不到 Library 指令或 handleButton: ${customId}`);
                    await interaction.followUp({ content: lang.errors.buttonHandlerNotFound, ephemeral: true }).catch(console.error);
                }
                return; // 處理完畢後直接返回
            }
            
            // 【關鍵修改】如果按鈕是音樂相關的，並且尚未被確認
            // 則在這裡 deferUpdate，並直接返回，讓 player.js 的 collector 接收
            if (isMusicButton && !interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate().catch(() => {});
                return; // 讓互動繼續傳遞到 player.js 中的 collector
            }
            // 如果音樂按鈕已經被確認過 (這應該是正常情況，如果 player.js 中的 collector 處理得當)
            // 則這裡也直接返回，讓 player.js 處理
            if (isMusicButton) {
                return;
            }


            // 如果按鈕既不是 open-edit-modal，也不是 library，也不是音樂按鈕，那就是未處理的通用按鈕
            // 對於這些按鈕，同樣需要先 deferUpdate
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate().catch(() => {});
            }
            console.warn(`[WARN] 未處理的按鈕互動: ${customId}`);
            await interaction.followUp({ content: lang.errors.unknownButton, ephemeral: true }).catch(console.error);
            return;
        }

        // ========== 下拉選單互動處理 ==========
        if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;

            // 所有下拉選單都在此處統一 deferUpdate
            await interaction.deferUpdate().catch(() => {}); // 在處理邏輯前統一 deferUpdate

            // 1. 優先處理塔羅牌的選單
            if (customId === 'tarot_spread_select') {
                const tarotCommand = client.commands.get('塔羅'); 
                if (tarotCommand && typeof tarotCommand.handleSelectMenu === "function") {
                    try {
                        // tarot.js 裡的 handleSelectMenu 將會使用 editReply 或 followUp
                        await tarotCommand.handleSelectMenu(client, interaction, lang);
                    } catch (e) {
                        console.error(`❌ tarot 選單處理錯誤: ${e.stack || e}`);
                        await interaction.followUp({ content: lang.errors.generalSelectMenuError, ephemeral: true }).catch(console.error);
                    }
                } else {
                    console.error(`[ERROR] 找不到 tarot 指令或 handleSelectMenu 函式`);
                    await interaction.followUp({ content: lang.errors.selectMenuHandlerNotFound, ephemeral: true }).catch(console.error);
                }
                return;
            }
            
            // 2. 接著處理 task 相關的選單
            const parts = customId.split(':');
            const actionType = parts[0];
            const userIdFromCustomId = parts[1];

            if (['delete-task-menu', 'toggle-task-menu', 'edit-task-menu'].includes(actionType)) {
                const taskCommand = client.commands.get('task');
                if (taskCommand && typeof taskCommand.handleSelectMenu === "function") {
                    try {
                        await taskCommand.handleSelectMenu(client, interaction, actionType, userIdFromCustomId);
                    } catch (e) {
                        console.error(`❌ task 選單處理錯誤: ${e.stack || e}`);
                        await interaction.followUp({ content: lang.errors.generalSelectMenuError, ephemeral: true }).catch(console.error);
                    }
                } else {
                    console.error(`[ERROR] 找不到 task 指令或 handleSelectMenu 函式`);
                    await interaction.followUp({ content: lang.errors.selectMenuHandlerNotFound, ephemeral: true }).catch(console.error);
                }
                return;
            }

            // 如果有其他未知的選單
            console.warn(`[WARN] 未處理的下拉選單互動: ${customId}`);
            await interaction.followUp({ content: lang.errors.unknownSelectMenu, ephemeral: true }).catch(console.error);
            return;
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

            await interaction.deferReply({ ephemeral: true }).catch(() => {}); // Modal 提交後通常需要延遲回覆

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
                } catch (e) {
                    console.error("❌ Autocomplete 發生錯誤:", e);
                }
            }
            return;
        }

        // ========== 斜線指令處理 ==========
        if (interaction.type === InteractionType.ApplicationCommand) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({ content: lang.errors.commandNotFound, ephemeral: true });
                } else {
                    return interaction.reply({ content: lang.errors.commandNotFound, ephemeral: true });
                }
            }

            try {
                const defaultPermissions = '0x0000000000000800'; 
                const requiredPermissions = command.permissions || defaultPermissions;

                const hasPermission = interaction?.member?.permissions?.has(requiredPermissions); 
                if (!hasPermission) {
                    if (interaction.deferred || interaction.replied) {
                        return interaction.editReply({ content: lang.errors.noPermission, ephemeral: true });
                    } else {
                        return interaction.reply({ content: lang.errors.noPermission, ephemeral: true });
                    }
                }
                // 執行指令的 run 函數。請確保 run 函數內部會處理回覆
                // 通常會在 run 函數開頭 deferReply
                await command.run(client, interaction, lang);
            } catch (e) {
                console.error(`❌ 指令執行錯誤: ${e.stack || e}`);
                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({
                        content: lang.errors.generalError.replace("{error}", e.message),
                        embeds: [],
                        components: [],
                    }).catch(console.error);
                } else {
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