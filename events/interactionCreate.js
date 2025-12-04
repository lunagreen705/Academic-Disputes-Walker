const config = require("../config.js");
const { InteractionType } = require("discord.js");
const path = require("path");

module.exports = async (client, interaction) => {
    try {
        if (!interaction.guild) {
            return interaction.reply({
                content: "此指令只能在伺服器中使用。",
                ephemeral: true,
            }).catch(() => {});
        }

        // 載入語言檔案
        const languageFile = path.join(__dirname, `../languages/${config.language}.js`);
        const lang = require(languageFile);

        // ===========================================
        //      通用互動路由 (按鈕/選單)
        //      使用 customIdPrefixes 進行匹配，提高效率和維護性。
        // ===========================================
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            const { customId } = interaction;
            let handled = false;

            // **【優化點 1】處理 Modal 開啟按鈕 (保留原邏輯，但位置提前)**
            if (customId.startsWith('open-edit-modal:')) {
                const parts = customId.split(':');
                const taskId = parts[1];
                const userIdFromCustomId = parts[2];
                const taskCommand = client.commands.get('task');

                if (taskCommand?.handleModalTriggerButton) {
                    await taskCommand.handleModalTriggerButton(interaction, taskId, userIdFromCustomId);
                    handled = true;
                } else {
                    console.error(`[ERROR] Task command or handleModalTriggerButton not found.`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: lang.errors?.buttonHandlerNotFound || "⚠️ 找不到按鈕處理程式。",
                            ephemeral: true
                        }).catch(console.error);
                    }
                    handled = true; // 避免進入通用 Fallback
                }
                return;
            }

            // **【優化點 2】使用通用路由匹配指令 (替代所有硬編碼邏輯)**
            if (!handled) {
                let matchedCommand = null;

                // 遍歷所有載入的指令，尋找匹配的 customIdPrefixes
                for (const [name, command] of client.commands) {
                    if (command.customIdPrefixes && command.customIdPrefixes.length > 0) {
                        const isMatch = command.customIdPrefixes.some(prefix => 
                            customId.startsWith(prefix)
                        );

                        if (isMatch) {
                            matchedCommand = command;
                            break;
                        }
                    }
                }

                if (matchedCommand) {
                    const handlerName = interaction.isButton() ? 'handleButton' : 'handleSelectMenu';
                    
                    if (matchedCommand[handlerName]) {
                        try {
                            // 執行處理函式 (傳遞 client, interaction, lang)
                            await matchedCommand[handlerName](client, interaction, lang);
                            handled = true;
                        } catch (e) {
                            console.error(`❌ Interaction execution error for ${customId} in ${matchedCommand.name} (${handlerName}): ${e.stack || e}`);
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({
                                    content: lang.errors?.generalButtonError || "⚠️ 互動執行錯誤。",
                                    ephemeral: true
                                }).catch(console.error);
                            } else {
                                await interaction.editReply({
                                    content: lang.errors?.generalButtonError || "⚠️ 互動執行錯誤。",
                                    components: []
                                }).catch(console.error);
                            }
                            handled = true;
                        }
                    }
                }
            }

            // **【優化點 3】如果互動未被處理，檢查是否為音樂按鈕或 Fallback**
            if (!handled) {
                // 檢查是否為音樂按鈕 (這是你原始代碼中的硬編碼)
                const musicButtonIds = [
                    'loopToggle', 'showQueue', 'skipTrack', 'showLyrics', 'clearQueue',
                    'stopTrack', 'pauseTrack', 'resumeTrack', 'volumeUp', 'volumeDown',
                    'stopLyrics', 'fullLyrics', 'deleteLyrics'
                ];
                
                if (interaction.isButton() && musicButtonIds.includes(customId)) {
                    // 音樂按鈕由 player 系統處理，此處直接放行
                    return; 
                }

                // Fallback: 處理未知的按鈕/選單 (WARN)
                console.warn(`[WARN] Unhandled general interaction: ${customId}`);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: lang.errors?.unknownInteraction || "⚠️ 未知的互動。",
                        ephemeral: true
                    }).catch(console.error);
                }
            }
            return;
        }

        // ============================
        //      Modal 提交處理
        // ============================
        if (interaction.isModalSubmit()) {
            const { customId } = interaction;
            const parts = customId.split(':');

            if (parts.length < 3) {
                console.error(`[ERROR] Invalid customId format for modal submit: ${customId}`);
                return interaction.reply({
                    content: lang.errors?.unknownModal || "⚠️ 未知的 Modal。",
                    ephemeral: true
                }).catch(console.error);
            }

            const actionType = parts[0];
            const taskId = parts[1];
            const userIdFromCustomId = parts[2];

            await interaction.deferReply({ ephemeral: true });

            if (actionType.startsWith('edit-task-modal')) {
                const taskCommand = client.commands.get('task');
                if (taskCommand?.handleModalSubmit) {
                    await taskCommand.handleModalSubmit(client, interaction, actionType, taskId, userIdFromCustomId);
                } else {
                    await interaction.followUp({
                        content: lang.errors?.modalHandlerNotFound || "⚠️ 找不到 Modal 處理程式。",
                        ephemeral: true
                    }).catch(console.error);
                }
            } else {
                console.warn(`[WARN] Unhandled modal submit: ${customId}`);
                await interaction.followUp({
                    content: lang.errors?.unknownModal || "⚠️ 未知的 Modal。",
                    ephemeral: true
                }).catch(console.error);
            }
            return;
        }

        // ============================
        //      自動補全處理
        // ============================
        if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
            const command = client.commands.get(interaction.commandName);
            if (command?.autocomplete) {
                try {
                    await command.autocomplete(interaction);
                } catch (e) {
                    console.error(`❌ Autocomplete error:`, e);
                }
            }
            return;
        }

        // ============================
        //      斜線指令處理
        // ============================
        if (interaction.type === InteractionType.ApplicationCommand) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                return interaction.reply({
                    content: lang.errors?.commandNotFound || "⚠️ 指令不存在。",
                    ephemeral: true
                });
            }

            const defaultPermissions = '0x0000000000000800';
            const requiredPermissions = command.permissions || defaultPermissions;
            if (!interaction.member.permissions.has(requiredPermissions)) {
                return interaction.reply({
                    content: lang.errors?.noPermission || "⚠️ 你沒有權限使用此指令。",
                    ephemeral: true
                });
            }

            try {
                await command.run(client, interaction, lang);
            } catch (e) {
                console.error(`❌ Command execution error for /${interaction.commandName}: ${e.stack || e}`);
                const errorMessage = lang.errors?.generalError?.replace("{error}", e.message) 
                    || `⚠️ 指令執行錯誤：${e.message}`;

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        content: errorMessage,
                        embeds: [],
                        components: []
                    }).catch(console.error);
                } else {
                    await interaction.reply({
                        content: errorMessage,
                        ephemeral: true
                    }).catch(console.error);
                }
            }
        }

    } catch (e) {
        console.error("❌ A critical error occurred in the interaction handler:", e.stack || e);
    }
};