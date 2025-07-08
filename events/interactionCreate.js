const config = require("../config.js");
const { InteractionType } = require("discord.js");
const path = require("path");

module.exports = async (client, interaction) => {
    try {
        if (!interaction.guild) {
            return interaction.reply({
                content: "此指令只能在伺服器中使用。", // 考慮從語言檔案讀取
                ephemeral: true,
            }).catch(() => {});
        }

        // 載入語言檔案
        const languageFile = path.join(__dirname, `../languages/${config.language}.js`);
        const lang = require(languageFile);

        // ============================
        //      按鈕互動處理
        // ============================
        if (interaction.isButton()) {
            const { customId } = interaction;

            // 音樂按鈕由 player 系統處理，此處直接放行
            const musicButtonIds = [
                'loopToggle', 'showQueue', 'skipTrack', 'showLyrics', 'clearQueue',
                'stopTrack', 'pauseTrack', 'resumeTrack', 'volumeUp', 'volumeDown',
                'stopLyrics', 'fullLyrics', 'deleteLyrics'
            ];
            if (musicButtonIds.includes(customId)) {
                return;
            }

            // 處理打開 Modal 的按鈕 (此互動直接顯示 Modal，不需 defer)
            if (customId.startsWith('open-edit-modal:')) {
                const parts = customId.split(':');
                if (parts.length < 3) {
                    console.error(`[ERROR] Invalid customId format for modal trigger: ${customId}`);
                    return interaction.reply({ content: lang.errors.unknownButton, ephemeral: true }).catch(console.error);
                }
                const taskId = parts[1];
                const userIdFromCustomId = parts[2];
                const taskCommand = client.commands.get('task');

                if (taskCommand?.handleModalTriggerButton) {
                    await taskCommand.handleModalTriggerButton(interaction, taskId, userIdFromCustomId);
                } else {
                    console.error(`[ERROR] Task command or handleModalTriggerButton not found.`);
                    if (!interaction.replied && !interaction.deferred) {
                       await interaction.reply({ content: lang.errors.buttonHandlerNotFound, ephemeral: true }).catch(console.error);
                    }
                }
                return;
            }

            // 處理其他指令的按鈕 (例如 'library' 指令)
            // 注意：具體的 handleButton 函式需要自行處理回應 (reply/update/defer)
            const commandName = customId.split('|')[0];
            const command = client.commands.get(commandName);

            if (command?.handleButton) {
                try {
                    await command.handleButton(interaction);
                } catch (e) {
                    console.error(`❌ ${commandName} handleButton error: ${e.stack || e}`);
                    // 假設 handleButton 未能回應，則嘗試 followUp
                    await interaction.followUp({ content: lang.errors.generalButtonError, ephemeral: true }).catch(console.error);
                }
            } else {
                console.warn(`[WARN] Unhandled button interaction: ${customId}`);
                await interaction.reply({ content: lang.errors.unknownButton, ephemeral: true }).catch(console.error);
            }
            return;
        }

        // ============================
        //      下拉選單互動處理
        // ============================
        if (interaction.isStringSelectMenu()) {
            const { customId } = interaction;

            // 塔羅牌選單
            if (customId === 'tarot_spread_select') {
                const tarotCommand = client.commands.get('塔羅');
                if (tarotCommand?.handleSelectMenu) {
                    await tarotCommand.handleSelectMenu(client, interaction, lang);
                }
                return;
            }

            // 任務相關選單
            const parts = customId.split(':');
            const actionType = parts[0];
            const userIdFromCustomId = parts[1];
            if (['delete-task-menu', 'toggle-task-menu', 'edit-task-menu'].includes(actionType)) {
                const taskCommand = client.commands.get('task');
                if (taskCommand?.handleSelectMenu) {
                    await taskCommand.handleSelectMenu(client, interaction, actionType, userIdFromCustomId);
                }
                return;
            }
            
            console.warn(`[WARN] Unhandled select menu interaction: ${customId}`);
            await interaction.reply({ content: lang.errors.unknownSelectMenu, ephemeral: true }).catch(console.error);
            return;
        }

        // ============================
        //      Modal 提交處理
        // ============================
        if (interaction.isModalSubmit()) {
            const { customId } = interaction;
            const parts = customId.split(':');

            if (parts.length < 3) {
                console.error(`[ERROR] Invalid customId format for modal submit: ${customId}`);
                return interaction.reply({ content: lang.errors.unknownModal, ephemeral: true }).catch(console.error);
            }

            const actionType = parts[0];
            const taskId = parts[1];
            const userIdFromCustomId = parts[2];

            // Modal 提交後的處理可能耗時，先行延遲回應
            await interaction.deferReply({ ephemeral: true });

            if (actionType.startsWith('edit-task-modal')) {
                const taskCommand = client.commands.get('task');
                if (taskCommand?.handleModalSubmit) {
                    await taskCommand.handleModalSubmit(client, interaction, actionType, taskId, userIdFromCustomId);
                } else {
                    await interaction.followUp({ content: lang.errors.modalHandlerNotFound, ephemeral: true }).catch(console.error);
                }
            } else {
                console.warn(`[WARN] Unhandled modal submit: ${customId}`);
                await interaction.followUp({ content: lang.errors.unknownModal, ephemeral: true }).catch(console.error);
            }
            return;
        }

        // ============================
        //      自動補全處理
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
        //      斜線指令處理
        // ============================
        if (interaction.type === InteractionType.ApplicationCommand) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                return interaction.reply({ content: lang.errors.commandNotFound, ephemeral: true });
            }

            // 權限檢查
            const defaultPermissions = '0x0000000000000800'; // ViewChannel & SendMessages
            const requiredPermissions = command.permissions || defaultPermissions;
            if (!interaction.member.permissions.has(requiredPermissions)) {
                return interaction.reply({ content: lang.errors.noPermission, ephemeral: true });
            }

            try {
                await command.run(client, interaction, lang);
            } catch (e) {
                console.error(`❌ Command execution error for /${interaction.commandName}: ${e.stack || e}`);
                const errorMessage = lang.errors.generalError.replace("{error}", e.message);

                // 根據互動是否已回應或延遲，選擇正確的錯誤回覆方式
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: errorMessage, embeds: [], components: [] }).catch(console.error);
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true }).catch(console.error);
                }
            }
        }

    } catch (e) {
        console.error("❌ A critical error occurred in the interaction handler:", e.stack || e);
    }
};