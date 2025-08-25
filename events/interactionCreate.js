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

            // Modal 開啟按鈕
            if (customId.startsWith('open-edit-modal:')) {
                const parts = customId.split(':');
                if (parts.length < 3) {
                    console.error(`[ERROR] Invalid customId format for modal trigger: ${customId}`);
                    return interaction.reply({
                        content: lang.errors?.unknownButton || "⚠️ 未知的按鈕互動。",
                        ephemeral: true
                    }).catch(console.error);
                }
                const taskId = parts[1];
                const userIdFromCustomId = parts[2];
                const taskCommand = client.commands.get('task');

                if (taskCommand?.handleModalTriggerButton) {
                    await taskCommand.handleModalTriggerButton(interaction, taskId, userIdFromCustomId);
                } else {
                    console.error(`[ERROR] Task command or handleModalTriggerButton not found.`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: lang.errors?.buttonHandlerNotFound || "⚠️ 找不到按鈕處理程式。",
                            ephemeral: true
                        }).catch(console.error);
                    }
                }
                return;
            }

            // 其他指令的按鈕
            const commandName = customId.split('|')[0];
            const command = client.commands.get(commandName);

            if (command?.handleButton) {
                try {
                    await command.handleButton(interaction);
                } catch (e) {
                    console.error(`❌ ${commandName} handleButton error: ${e.stack || e}`);
                    await interaction.followUp({
                        content: lang.errors?.generalButtonError || "⚠️ 按鈕執行錯誤。",
                        ephemeral: true
                    }).catch(console.error);
                }
            } else {
                console.warn(`[WARN] Unhandled button interaction: ${customId}`);
                await interaction.reply({
                    content: lang.errors?.unknownButton || "⚠️ 未知的按鈕互動。",
                    ephemeral: true
                }).catch(console.error);
            }
            return;
        }

        // ============================
        //      下拉選單互動處理
        // ============================
        if (interaction.isStringSelectMenu()) {
            const { customId } = interaction;

            // --- 音樂系統選單交給 play.js 的 collector 處理 ---
            if (customId === "music-select-menu") {
                return;
            }

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

            // Fallback
            console.warn(`[WARN] Unhandled select menu interaction: ${customId}`);
            await interaction.reply({
                content: lang.errors?.unknownSelectMenu || "⚠️ 未知的選單互動。",
                ephemeral: true
            }).catch(console.error);
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

    // ▼▼▼ 修改的核心邏輯開始 ▼▼▼

    // 檢查指令檔中是否有 'showModal' 屬性，以此判斷是否為 Modal 指令
    const isModalCommand = command.showModal;

    // 如果不是 Modal 指令，就先延遲回覆，避免 3 秒超時
    if (!isModalCommand) {
        await interaction.deferReply();
    }

    // ▲▲▲ 修改的核心邏輯結束 ▲▲▲

    try {
        // 現在可以安全地執行指令
        // - 普通指令已經被 defer，可以在 run 裡面用 editReply
        // - Modal 指令的 interaction 尚未被回覆，可以在 run 裡面用 showModal
        await command.run(client, interaction, lang);

    } catch (e) {
        console.error(`❌ Command execution error for /${interaction.commandName}: ${e.stack || e}`);
        const errorMessage = lang.errors?.generalError?.replace("{error}", e.message) 
            || `⚠️ 指令執行錯誤：${e.message}`;

        // 這裡的錯誤處理邏輯已經很完善，可以正確處理已延遲和未延遲的情況
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