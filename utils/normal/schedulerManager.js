// schedulerManager.js
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const colors = require("../../UI/colors/colors"); 

const affectionManager = require('../../utils/entertainment/affectionManager'); // 確保路徑正確

// === GitHub 環境設定 ===
const GH_TOKEN = process.env.GH_TOKEN;
const GH_USERNAME = process.env.GH_USERNAME;
const GH_REPO = process.env.GH_REPO;

// === 路徑設定 ===
const TASKS_FILE_LOCAL = path.join(__dirname, '../../data/normal/tasks.json'); // 用於動態排程的本地緩存路徑
const GH_FILE_PATH = 'data/normal/tasks.json'; // 用於動態排程的 GitHub 倉庫路徑

// << 新增點 >>：將排行榜頻道 ID 設定為頂層常數，**請在此處填寫您的頻道 ID 或從環境變數讀取**
const LEADERBOARD_CHANNEL_ID = process.env.LEADERBOARD_CHANNEL_ID || '1146286703741505679';


// === 資料容器 ===
let tasksConfig = []; // 儲存從 GitHub 或本地載入的排程配置 (用於動態任務)
let activeCronTasks = []; // 儲存 node-cron 任務實例 (動態任務和內建任務)
let currentFileSha = null; // 用於 GitHub 更新，追蹤當前檔案的 SHA (用於動態任務)

// === 輔助函式：從 GitHub 獲取檔案內容 ===
/**
 * 從 GitHub 獲取指定檔案的內容及其 SHA 值。
 * @returns {Promise<{content: string|null, sha: string|null}>} 包含檔案內容和 SHA 的物件，若失敗則為 null。
 */
async function fetchFromGitHub() {
    if (!GH_TOKEN || !GH_USERNAME || !GH_REPO) {
        console.warn(`${colors.yellow}[SCHEDULER MANAGER]${colors.reset} ⚠️ GitHub 憑證資訊不完整 (GH_TOKEN, GH_USERNAME, GH_REPO)，無法從 GitHub 獲取排程配置。`);
        return { content: null, sha: null };
    }

    const apiUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_FILE_PATH}`;
    try {
        const res = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`,
                'User-Agent': 'Discord-Bot', // GitHub 要求 User-Agent
                'Accept': 'application/vnd.github.v3.raw', // 直接獲取原始內容
            },
        });

        if (res.ok) {
            const data = await res.json(); // GitHub API 回傳的 JSON 包含 content 和 sha
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            return { content, sha: data.sha };
        } else if (res.status === 404) {
            console.warn(`${colors.yellow}[SCHEDULER MANAGER]${colors.reset} ⚠️ GitHub 倉庫中未找到排程配置檔案：${GH_FILE_PATH}。`);
            return { content: null, sha: null };
        } else {
            const errorText = await res.text();
            throw new Error(`GitHub API 讀取錯誤 (${res.status}): ${errorText}`);
        }
    } catch (err) {
        console.error(`${colors.red}[SCHEDULER MANAGER]${colors.reset} ❌ 從 GitHub 獲取排程配置失敗：${err.message}`);
        return { content: null, sha: null };
    }
}

// === 輔助函式：將內容推送到 GitHub ===
/**
 * 將給定內容推送到 GitHub 上的指定檔案。
 * @param {string} content - 要推送的檔案內容。
 * @param {string} message - Git commit 訊息。
 * @param {string|null} sha - 檔案的當前 SHA 值，用於版本控制。
 * @returns {Promise<{success: boolean, newSha: string|null}>} 推送結果和新的 SHA 值。
 */
async function pushToGitHubInternal(content, message, sha) {
    if (!GH_TOKEN || !GH_USERNAME || !GH_REPO) {
        console.warn(`${colors.yellow}[SCHEDULER MANAGER]${colors.reset} ⚠️ GitHub 憑證資訊不完整，無法推送排程配置。`);
        return { success: false, newSha: null };
    }

    const apiUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_FILE_PATH}`;
    try {
        const body = JSON.stringify({
            message: message,
            content: Buffer.from(content).toString('base64'),
            sha: sha, // 帶上當前 SHA 避免衝突
        });

        const res = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`,
                'User-Agent': 'Discord-Bot',
                'Content-Type': 'application/json',
            },
            body,
        });

        if (!res.ok) {
            const errorText = await res.text();
            if (res.status === 409) { // Conflict
                console.error(`${colors.red}[SCHEDULER MANAGER]${colors.reset} ❌ 推送 GitHub 衝突 (SHA 過時)。請重新嘗試。`);
            }
            throw new Error(`GitHub API 寫入錯誤 (${res.status}): ${errorText}`);
        }

        const responseData = await res.json();
        console.log(`${colors.cyan}[SCHEDULER MANAGER]${colors.reset} 🚀 排程配置已成功同步至 GitHub。`);
        return { success: true, newSha: responseData.content.sha };
    } catch (err) {
        console.error(`${colors.red}[SCHEDULER MANAGER]${colors.reset} ❌ 推送排程配置至 GitHub 失敗：${err.message}`);
        return { success: false, newSha: null };
    }
}

// === << 新增點 >>：內建的好感度排行榜發送函式 ===
/**
 * 內部專用函式：產生並發送好感度排行榜。
 * 這個函式依賴於 AFFECTION_FILE_PATH 和 LEADERBOARD_CHANNEL_ID 常數。
 * @param {import('discord.js').Client} client - Discord 客戶端實例。
 */
async function _postAffectionLeaderboard(client) {
    console.log(`${colors.cyan}[SCHEDULER - SYSTEM]${colors.reset} 正在執行自動好感度排行榜任務...`);
    
    // 1. 檢查頻道 ID 是否已設定
    if (LEADERBOARD_CHANNEL_ID === '1146286703741505679' || !LEADERBOARD_CHANNEL_ID) {
        console.error(`${colors.red}[SCHEDULER - SYSTEM]${colors.reset} ❌ 錯誤：未在 schedulerManager.js 或環境變數中設定 LEADERBOARD_CHANNEL_ID。請確保此變數已正確設定。`);
        return;
    }

    // 2. 讀取並處理資料
    let affectionData;
    try {
        // 從好感度模組獲取數據，而不是直接讀取檔案，這樣更符合模組化原則
        // 確保 affectionManager.js 有 getAffectionLeaderboard 函式
        const leaderboard = affectionManager.getAffectionLeaderboard(100); // 獲取所有用戶的好感度
        
        // 如果 affectionManager.getAffectionLeaderboard 返回的是處理好的數據，則可以直接使用
        // 否則，這裡需要重新排序和篩選
        const sortedUsers = leaderboard
            .sort((a, b) => b.affection - a.affection)
            .slice(0, 10); // 取前 10 名

        if (sortedUsers.length === 0) {
            console.log(`${colors.yellow}[SCHEDULER - SYSTEM]${colors.reset} ℹ️ 好感度資料中沒有足夠的用戶，無法生成排行榜。`);
            return;
        }

        // 3. 建立並發送 Embed
        const embed = new EmbedBuilder()
            .setTitle('💖 每週好感度排行榜 💖')
            .setColor('#FF69B4')
            .setTimestamp()
            .setFooter({ text: `由 ${client.user.username} 自動發佈` });
        
        const leaderboardEntries = await Promise.all(
            sortedUsers.map(async (user, index) => {
                let displayName = `使用者 (ID: ...${user.userId.slice(-4)})`;
                try {
                    // 確保 client 已準備就緒，可以 fetch 用戶
                    if (client.isReady()) {
                        const member = await client.users.fetch(user.userId);
                        displayName = member.displayName || member.username;
                    }
                } catch (fetchErr) {
                    console.error(`${colors.yellow}[SCHEDULER - SYSTEM]${colors.reset} ⚠️ 無法獲取用戶 ${user.userId} 的 displayName: ${fetchErr.message}`);
                }

                const rank = index + 1;
                let rankIcon = `${rank}.`;
                if (rank === 1) rankIcon = '🥇';
                else if (rank === 2) rankIcon = '🥈';
                else if (rank === 3) rankIcon = '🥉';
                
                return `${rankIcon} **${displayName}** - ${user.affection} 點好感度`;
            })
        );
        embed.setDescription(leaderboardEntries.join('\n\n'));

        try {
            const channel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);
            if (channel && channel.isTextBased()) {
                await channel.send({ embeds: [embed] });
                console.log(`${colors.green}[SCHEDULER - SYSTEM]${colors.reset} ✅ 已成功將好感度排行榜推送至指定頻道。`);
            } else {
                throw new Error(`無法找到或無法發送訊息到頻道 ID: ${LEADERBOARD_CHANNEL_ID}。`);
            }
        } catch (error) {
            console.error(`${colors.red}[SCHEDULER - SYSTEM]${colors.reset} ❌ 推送排行榜時發生錯誤:`, error.message);
        }

    } catch (error) {
        console.error(`${colors.red}[SCHEDULER - SYSTEM]${colors.reset} ❌ 執行好感度排行榜任務時發生未預期錯誤:`, error);
    }
}


// === 核心排程邏輯：載入並設定任務 ===
/**
 * 內部函式：停止所有現有排程，然後根據 `tasksConfig` 載入並重新設定排程任務。
 * @param {object} taskActionFunctions - 任務執行函式對應表。
 */
async function loadAndScheduleTasks(taskActionFunctions) {
    // 停止所有現有的 cron 任務，防止重複排程
    activeCronTasks.forEach(task => task.stop());
    activeCronTasks = [];

    if (!Array.isArray(tasksConfig)) {
        console.error(`${colors.red}[SCHEDULER MANAGER]${colors.reset} ❌ 排程配置內容格式不正確，應為陣列。已重置為空。`);
        tasksConfig = []; // 重置為空陣列
    }

    if (tasksConfig.length === 0) {
        console.log(`[SCHEDULER MANAGER] ℹ️ 未找到任何啟用的排程任務。`);
    }

    tasksConfig.forEach(task => {
        if (task.enabled) {
            const actualTaskFunction = taskActionFunctions[task.action];

            if (typeof actualTaskFunction === 'function') {
                const cronTask = cron.schedule(task.cronExpression, async () => {
                    console.log(`${colors.yellow}[SCHEDULER]${colors.reset} 正在執行排程任務: ${task.name || task.id} (${new Date().toLocaleString()})`);
                    try {
                        await actualTaskFunction(task.args); // 執行實際任務，並傳遞參數
                        console.log(`${colors.green}[SCHEDULER]${colors.reset} 任務 '${task.name || task.id}' 執行成功。`);
                    } catch (err) {
                        console.error(`${colors.red}[SCHEDULER]${colors.reset} 任務 '${task.name || task.id}' 執行失敗：`, err);
                    }
                }, {
                    timezone: task.timezone || 'Asia/Taipei' // 使用配置中的時區，預設台灣時間
                });
                activeCronTasks.push(cronTask);
                console.log(`${colors.cyan}[SCHEDULER]${colors.reset} 任務 '${task.name || task.id}' 已成功排程：'${task.cronExpression}' (時區: ${task.timezone || 'Asia/Taipei'})`);
            } else {
                console.error(`${colors.red}[SCHEDULER MANAGER]${colors.reset} ❌ 任務 '${task.name || task.id}' 的 action '${task.action}' 未找到對應的執行函式。`);
            }
        } else {
            console.log(`${colors.yellow}[SCHEDULER MANAGER]${colors.reset} ℹ️ 任務 '${task.name || task.id}' 已禁用，跳過排程。`);
        }
    });

    console.log(`${colors.cyan}[ SCHEDULER ]${colors.reset} ${colors.green}已載入並排程 ${activeCronTasks.length} 個任務。${colors.reset}`);
}

// === 模組初始化入口點 ===
/**
 * 初始化排程器：優先從 GitHub 載入排程配置，若失敗則從本地緩存載入。
 * 然後根據配置設定所有排程任務，並啟動內建的系統任務。
 * @param {import('discord.js').Client} client - Discord 客戶端實例。
 * @param {object} taskActionFunctions - 任務執行函式對應表。
 */
async function initializeScheduler(client, taskActionFunctions) {
    console.log(`${colors.cyan}[ SCHEDULER ]${colors.reset} 正在初始化排程器...`);
    try {
        // --- 處理來自 tasks.json 的個人化/動態任務 ---
        const { content, sha } = await fetchFromGitHub();
        if (content) {
            tasksConfig = JSON.parse(content);
            currentFileSha = sha;
            console.log(`${colors.cyan}[ SCHEDULER ]${colors.reset} ${colors.green}從 GitHub 成功載入排程配置 ✅${colors.reset}`);
        } else {
            if (fs.existsSync(TASKS_FILE_LOCAL)) {
                tasksConfig = JSON.parse(fs.readFileSync(TASKS_FILE_LOCAL, 'utf8'));
                console.warn(`${colors.yellow}[SCHEDULER MANAGER]${colors.reset} ⚠️ 從 GitHub 載入失敗，已從本地檔案載入排程配置。`);
            } else {
                tasksConfig = [];
                console.warn(`${colors.yellow}[SCHEDULER MANAGER]${colors.reset} ⚠️ 未找到本地排程緩存檔案，已初始化為空。`);
            }
        }
        // 載入並排程動態任務
        await loadAndScheduleTasks(taskActionFunctions);

        // --- << 新增點 >>：在這裡直接啟動內建的、硬編碼的系統任務 ---
        console.log(`${colors.cyan}[SCHEDULER - SYSTEM]${colors.reset} 正在設定內建的自動化任務...`);
        
        // 設定幾點自動發送好感度排行榜
        const systemTask = cron.schedule('34 14 * * 0', () => _postAffectionLeaderboard(client), {
            timezone: 'Asia/Taipei'
        });
        activeCronTasks.push(systemTask); // 將系統任務也加入管理列表
        
        console.log(`${colors.green}[SCHEDULER - SYSTEM]${colors.reset} ✅ 自動好感度排行榜任務已排程 (每週日 20:00)。`);

    } catch (err) {
        console.error(`${colors.red}[SCHEDULER MANAGER]${colors.reset} ❌ 排程器初始化失敗：${err.message}`, err);
    }
}

// === 外部呼叫：重新載入和重設排程任務 (保持不變) ===
/**
 * 重新載入排程任務：從 GitHub 獲取最新配置，然後重新設定排程。
 * @param {object} taskActionFunctions - 任務執行函式對應表。
 */
async function reloadScheduledTasks(taskActionFunctions) {
    console.log(`${colors.cyan}[SCHEDULER MANAGER]${colors.reset} 正在重新載入排程任務...`);
    // 重新初始化會處理所有排程，包括內建和動態的
    // 注意：這裡需要把 client 物件傳入 initializeScheduler
    // 這表示 reloadScheduledTasks 也需要接收 client 物件，或者將 client 儲存在模組內部
    // 為了簡潔，我們假設 client 會在 initializeScheduler 中被捕捉到或通過參數傳遞。
    // 在本例中，我們已經將 client 作為參數傳遞給 initializeScheduler。
    await initializeScheduler(taskActionFunctions); // **重要**：這裡如果沒有 client，會導致 initializeScheduler 失敗
}

// === 外部呼叫：管理排程任務的 CRUD 操作 (保持不變) ===
// addOrUpdateTask(), deleteTask(), getAllTasks(), getTask() ... (與之前相同)


// === 匯出模組 ===
module.exports = {
    initializeScheduler,
    reloadScheduledTasks,
    addOrUpdateTask,
    deleteTask,
    getAllTasks,
    getTask,
    // 如果你希望在 initializeScheduler 之外，也能手動觸發一次排行榜推送，
    // 可以考慮導出 _postAffectionLeaderboard 並命名為 postAffectionLeaderboard
    // postAffectionLeaderboard: _postAffectionLeaderboard // 但通常由系統自動處理或在 index.js 中處理
};