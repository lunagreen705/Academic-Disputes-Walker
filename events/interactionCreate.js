// events/interactionCreate.js (最終的統一模型版本)

const { PermissionsBitField } = require("discord.js");
const config = require("../config.js");
const path = require("path");

// --- 豁免清單 (方便統一管理) ---

// 1. 由外部系統（如 player.js）全權處理的按鈕 ID
const EXTERNAL_HANDLED_BUTTON_IDS = new Set([
    'loopToggle', 'showQueue', 'skipTrack', 'showLyrics', 'clearQueue',
    'stopTrack', 'pauseTrack', 'resumeTrack', 'volumeUp', 'volumeDown',
    'stopLyrics', 'fullLyrics', 'deleteLyrics'
]);

// 2. 會直接彈出 Modal 作為回應的互動 customId 前綴
//    這些互動有自己的回應方式 (showModal)，不需要我們預先 defer
const MODAL_TRIGGER_PREFIXES = new Set([
    'open-edit-modal', // task.js 的按鈕
    'edit-task-menu'   // task.js 的下拉選單
]);


module.exports = async (client, interaction) => {
    try {
        // --- 基礎檢查 ---
        if (!interaction.guild) {
            return interaction.reply({ content: "此指令只能在伺服器中使用。", ephemeral: true }).catch(() => {});
        }
        
        const lang = require(path.join(__dirname, `../languages/${config.language}.js`));
        
        // ==========================================================
        // ================== 1. 特殊互動豁免區 =====================
        // ==========================================================
        // 在這裡，我們讓特殊互動「提前退出」，不進入下方的統一處理流程

        // --- 自動完成 (Autocomplete) ---
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command?.autocomplete) await command.autocomplete(interaction, lang);
            return;
        }

        // --- 外部系統處理的按鈕 (如音樂機器人) ---
        if (interaction.isButton() && EXTERNAL_HANDLED_BUTTON_IDS.has(interaction.customId)) {
            return; // 直接放行，讓 player.js 等外部系統處理
        }
        
        // 從 customId 解析出可能是指令或動作的名稱
        const customIdPrefix = interaction.customId?.split(/[:|]/)[0];

        // --- 觸發 Modal 的互動 ---
        if ((interaction.isButton() || interaction.isStringSelectMenu()) && MODAL_TRIGGER_PREFIXES.has(customIdPrefix)) {
            const commandName = customIdPrefix.replace('-menu', '').replace('-modal','');
            const command = client.commands.get(commandName);
            
            if (interaction.isButton() && command?.handleModalTriggerButton) {
                 await command.handleModalTriggerButton(interaction, ...interaction.customId.split(':').slice(1));
            } else if (interaction.isStringSelectMenu() && command?.handleSelectMenu) {
                 await command.handleSelectMenu(client, interaction, lang);
            }
            return; // 執行完 showModal 後退出
        }


        // ==========================================================
        // ================ 2. 統一的互動確認區 =====================
        // ==========================================================
        // 對於所有常規互動，在這裡進行唯一的「確認 (Acknowledge)」
        if (!interaction.replied && !interaction.deferred) {
            if (interaction.isChatInputCommand() || interaction.isModalSubmit()) {
                // 對於需要後續回覆詳細內容的互動，使用 deferReply
                await interaction.deferReply({ ephemeral: true });
            } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
                // 對於點擊後更新原訊息的互動，使用 deferUpdate
                await interaction.deferUpdate();
            }
        }

        // ==========================================================
        // ===================== 3. 統一的互動路由區 ====================
        // ==========================================================
        // 將已被「確認」的互動，分派給對應的指令檔案

        const commandName = interaction.isChatInputCommand() ? interaction.commandName : customIdPrefix;
        const command = client.commands.get(commandName);

        if (!command) {
            console.warn(`[警告] 找不到對應的指令處理器: ${commandName}`);
            return interaction.editReply({ content: lang.errors.commandNotFound, ephemeral: true }).catch(console.error);
        }

        // --- 路由到具體處理器 ---
        if (interaction.isChatInputCommand()) {
            // 可在此加入統一的權限檢查
            const defaultPermissions = PermissionsBitField.Flags.SendMessages;
            const requiredPermissions = command.permissions || defaultPermissions;
            if (!interaction.member.permissions.has(requiredPermissions)) {
                return interaction.editReply({ content: lang.errors.noPermission, ephemeral: true });
            }
            await command.run(client, interaction, lang);
        } else if (interaction.isButton()) {
            if (command.handleButton) await command.handleButton(interaction, lang);
        } else if (interaction.isStringSelectMenu()) {
            if (command.handleSelectMenu) await command.handleSelectMenu(client, interaction, lang);
        } else if (interaction.isModalSubmit()) {
            if (command.handleModalSubmit) await command.handleModalSubmit(client, interaction, lang);
        }

    } catch (e) {
        console.error("❌ 總處理器發生嚴重錯誤:", e.stack || e);
        // --- 統一的兜底錯誤處理 ---
        if (interaction && !interaction.isAutocomplete()) { // Autocomplete 不能用 reply/editReply
            try {
                const errorMessage = {
                    content: `處理您的請求時發生了未預期的錯誤，請聯繫管理員。\n錯誤: ${e.message}`,
                    embeds: [], components: [], ephemeral: true
                };
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (err) {
                console.error("❌ 在回報嚴重錯誤時又發生錯誤:", err);
            }
        }
    }
};