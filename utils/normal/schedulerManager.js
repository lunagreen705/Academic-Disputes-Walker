// schedulerManager.js
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const colors = require("../../UI/colors/colors"); 
const affectionManager = require('../../utils/entertainment/affectionManager');

// === GitHub 環境設定 ===
const GH_TOKEN = process.env.GH_TOKEN;
const GH_USERNAME = process.env.GH_USERNAME;
const GH_REPO = process.env.GH_REPO;

// === 路徑設定 (區分自動任務和個人任務) ===
const AUTOTASKS_FILE_LOCAL = path.join(__dirname, '../../data/normal/autotasks.json');
const GH_AUTOTASKS_PATH = 'data/normal/autotasks.json';

const PERSONALTASKS_FILE_LOCAL = path.join(__dirname, '../../data/normal/personaltasks.json');
const GH_PERSONALTASKS_PATH = 'data/normal/personaltasks.json';

// === 資料容器 (區分兩種類型) ===
let autoTasksConfig = [];
let personalTasksConfig = [];
let activeCronTasks = []; // 儲存所有啟用的 cron 任務實例

let autoTasksSha = null;
let personalTasksSha = null;

// === 輔助函式：從 GitHub 獲取檔案 ===
async function fetchFromGitHub(filePath) {
    if (!GH_TOKEN || !GH_USERNAME || !GH_REPO) return { content: null, sha: null };
    const apiUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${filePath}`;
    try {
        const res = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`, 'User-Agent': 'Discord-Bot', 'Accept': 'application/vnd.github.v3+json',
            },
        });
        if (res.ok) {
            const data = await res.json();
            const content = data.content ? Buffer.from(data.content, 'base64').toString('utf8') : '[]';
            return { content, sha: data.sha };
        } else if (res.status === 404) {
            return { content: null, sha: null }; // 檔案不存在
        }
        throw new Error(`GitHub API 讀取錯誤 (${res.status}): ${await res.text()}`);
    } catch (err) {
        console.error(`${colors.red}[SCHEDULER MANAGER]${colors.reset} ❌ 從 GitHub 獲取 ${filePath} 失敗：${err.message}`);
        return { content: null, sha: null };
    }
}

// === 輔助函式：推送內容到 GitHub ===
async function pushToGitHubInternal(filePath, content, message, sha) {
    if (!GH_TOKEN || !GH_USERNAME || !GH_REPO) return { success: false, newSha: null };
    const apiUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${filePath}`;
    try {
        const res = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`, 'User-Agent': 'Discord-Bot', 'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), sha }),
        });
        if (!res.ok) throw new Error(`GitHub API 寫入錯誤 (${res.status}): ${await res.text()}`);
        const responseData = await res.json();
        console.log(`${colors.cyan}[SCHEDULER MANAGER]${colors.reset} 🚀 ${filePath} 已成功同步至 GitHub。`);
        return { success: true, newSha: responseData.content.sha };
    } catch (err) {
        console.error(`${colors.red}[SCHEDULER MANAGER]${colors.reset} ❌ 推送 ${filePath} 至 GitHub 失敗：${err.message}`);
        return { success: false, newSha: null };
    }
}

// === 連動好感度模組排程  ===
async function postAffectionLeaderboard(client, channelId, limit = 10) {
    if (!channelId) {
        console.error(`${colors.red}[SCHEDULER]${colors.reset} 錯誤：未提供有效的頻道 ID 來發送排行榜。`);
        return;
    }
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !channel.guild) {
            console.error(`${colors.red}[SCHEDULER]${colors.reset} 錯誤：找不到頻道、頻道不是文字頻道或頻道不在伺服器中。`);
            return;
        }

        const leaderboard = affectionManager.getAffectionLeaderboard(limit);
        if (leaderboard.length === 0) return;

        const sortedUsers = leaderboard.sort((a, b) => b.affection - a.affection).slice(0, limit);
        const embed = new EmbedBuilder().setTitle('💖 好感度排行榜 💖').setColor('#FF69B4').setTimestamp();
        
        // 從頻道取得伺服器物件
        const guild = channel.guild;

        const leaderboardEntries = await Promise.all(
            sortedUsers.map(async (user, index) => {
                let displayName = `未知的使用者`;
                try {
                    // *** 修改點：從 guild.members 而不是 client.users 獲取成員 ***
                    const member = await guild.members.fetch(user.userId);
                    // 現在的 displayName 會優先顯示伺服器暱稱
                    displayName = member.displayName;
                } catch {
                    // 如果找不到成員 (例如已離開伺服器)，嘗試抓取全域使用者名稱作為備用
                    try {
                        const fetchedUser = await client.users.fetch(user.userId);
                        displayName = fetchedUser.displayName || fetchedUser.username;
                    } catch {
                        displayName = `使用者 (ID: ...${user.userId.slice(-4)})`;
                    }
                }
                const rankIcons = ['🥇', '🥈', '🥉'];
                const rankIcon = index < 3 ? rankIcons[index] : `${index + 1}.`;
                return `${rankIcon} **${displayName}** - ${user.affection} 點好感度`;
            })
        );
        embed.setDescription(leaderboardEntries.join('\n\n'));

        await channel.send({ embeds: [embed] });

    } catch (error) {
        console.error(`${colors.red}[SCHEDULER]${colors.reset} 執行好感度排行榜任務時發生錯誤:`, error);
    }
}

// === 核心排程邏輯 ===
async function loadAndScheduleTasks(client, taskActionFunctions) {
    // 停止所有現有任務以重新載入
    activeCronTasks.forEach(task => task.stop());
    activeCronTasks = [];

    // 合併自動任務和個人任務
    const allTasks = [...autoTasksConfig, ...personalTasksConfig];
    if (allTasks.length === 0) {
        console.log(`[SCHEDULER MANAGER] ℹ️ 未找到任何啟用的排程任務。`);
    }

    // 遍歷所有任務並排程
    for (const task of allTasks) { // 使用 for...of 循環以便使用 await
        if (!task.enabled) {
            console.log(`${colors.yellow}[SCHEDULER]${colors.reset} 任務 '${task.name || task.id}' 已禁用，跳過。`);
            continue; // 跳過已禁用的任務
        }

        const actualTaskFunction = taskActionFunctions[task.action];
        if (typeof actualTaskFunction === 'function') {
            const cronTask = cron.schedule(task.cronExpression, async () => { // 將回調函式改為 async
                console.log(`${colors.yellow}[SCHEDULER]${colors.reset} 正在執行任務: ${task.name || task.id}`);
                try {
                    await actualTaskFunction(task, client); // 執行實際任務

                    // === 【新增邏輯】處理任務執行次數和過期 ===
                    // 僅針對個人任務進行狀態更新和刪除
                    const personalTaskIndex = personalTasksConfig.findIndex(t => t.id === task.id && t.userId === task.userId);
                    if (personalTaskIndex !== -1) {
                        const currentTask = personalTasksConfig[personalTaskIndex];

                        // 1. 更新執行次數
                        if (typeof currentTask.executedCount === 'number') {
                            currentTask.executedCount++;
                        } else {
                            currentTask.executedCount = 1; // 首次執行，初始化為 1
                        }

                        // 2. 檢查是否需要刪除 (達到執行次數或超過結束日期)
                        let shouldDelete = false;
                        if (currentTask.occurrence_count && currentTask.executedCount >= currentTask.occurrence_count) {
                            console.log(`${colors.green}[SCHEDULER]${colors.reset} 任務 '${currentTask.name || currentTask.id}' 已達到最大執行次數 (${currentTask.occurrence_count})，將被刪除。`);
                            shouldDelete = true;
                        } else if (currentTask.end_date) {
                            const endDate = new Date(currentTask.end_date);
                            const now = new Date();
                            if (now > endDate) {
                                console.log(`${colors.green}[SCHEDULER]${colors.reset} 任務 '${currentTask.name || currentTask.id}' 已超過結束日期 (${currentTask.end_date})，將被刪除。`);
                                shouldDelete = true;
                            }
                        }

                        // 3. 儲存更新後的任務狀態或執行刪除
                        if (shouldDelete) {
                            await deleteTask(client, taskActionFunctions, currentTask.id, currentTask.userId);
                        } else {
                            // 如果沒有刪除，則保存當前任務狀態 (例如 executedCount 已更新)
                            await _saveAndReloadPersonalTasks(client, taskActionFunctions, `task_executed: ${currentTask.id}`);
                        }
                    }

                } catch (err) {
                    console.error(`${colors.red}[SCHEDULER]${colors.reset} 任務 '${task.name || task.id}' 執行失敗：`, err);
                }
            }, { timezone: task.timezone || 'Asia/Taipei' });
            activeCronTasks.push(cronTask);
        } else {
            console.error(`${colors.red}[SCHEDULER]${colors.reset} ❌ 任務 '${task.name}' 的 action '${task.action}' 未找到對應函式。`);
        }
    } // for 循環結束

    console.log(`${colors.green}[SCHEDULER]${colors.reset} 已成功載入並排程 ${activeCronTasks.length} 個任務。`);
}

// === 模組初始化入口點 ===
async function initializeScheduler(client, taskActionFunctions) {
    console.log(`${colors.cyan}[SCHEDULER]${colors.reset} 正在初始化排程器...`);

    // 載入自動化任務 (autotasks.json)
    const autoData = await fetchFromGitHub(GH_AUTOTASKS_PATH);
    if (autoData.content) {
        autoTasksConfig = JSON.parse(autoData.content);
        autoTasksSha = autoData.sha;
    } else if (fs.existsSync(AUTOTASKS_FILE_LOCAL)) {
        autoTasksConfig = JSON.parse(fs.readFileSync(AUTOTASKS_FILE_LOCAL, 'utf8'));
    }

    // 載入個人任務 (personaltasks.json)
    const personalData = await fetchFromGitHub(GH_PERSONALTASKS_PATH);
    if (personalData.content) {
        personalTasksConfig = JSON.parse(personalData.content);
        personalTasksSha = personalData.sha;
    } else if (fs.existsSync(PERSONALTASKS_FILE_LOCAL)) {
        personalTasksConfig = JSON.parse(fs.readFileSync(PERSONALTASKS_FILE_LOCAL, 'utf8'));
    }

    await loadAndScheduleTasks(client, taskActionFunctions);
}

// === CRUD (建立、讀取、更新、刪除) 功能 ===

// 內部輔助函式，用於儲存並重新載入個人任務
async function _saveAndReloadPersonalTasks(client, taskActionFunctions, source) {
    try {
        const content = JSON.stringify(personalTasksConfig, null, 2);
        fs.writeFileSync(PERSONALTASKS_FILE_LOCAL, content, 'utf8');
        const { success, newSha } = await pushToGitHubInternal(GH_PERSONALTASKS_PATH, content, `Personal tasks updated by ${source}`, personalTasksSha);
        if (success) personalTasksSha = newSha;
        await loadAndScheduleTasks(client, taskActionFunctions); // 每次保存後重新載入排程
        return true;
    } catch (error) {
        console.error(`${colors.red}[SCHEDULER]${colors.reset} ❌ 儲存並重載個人任務時發生錯誤:`, error);
        return false;
    }
}

function getAllTasks(userId) {
    return [
        ...autoTasksConfig,
        ...personalTasksConfig.filter(task => task.userId === userId)
    ];
}

function getTask(taskId) {
    return [...autoTasksConfig, ...personalTasksConfig].find(task => task.id === taskId);
}

async function addOrUpdateTask(client, taskActionFunctions, newTaskConfig) {
    if (!taskActionFunctions[newTaskConfig.action]) {
        console.error(`${colors.red}[SCHEDULER]${colors.reset} ❌ 嘗試添加或更新任務失敗：未找到 action '${newTaskConfig.action}' 的對應函式。`);
        return false;
    }
    
    const existingTaskIndex = personalTasksConfig.findIndex(
        task => task.id === newTaskConfig.id && task.userId === newTaskConfig.userId
    );

    if (existingTaskIndex > -1) {
        // 更新現有任務，保留 executedCount 如果沒有明確指定
        personalTasksConfig[existingTaskIndex] = { 
            ...personalTasksConfig[existingTaskIndex], 
            ...newTaskConfig 
        };
    } else {
        // 新增任務時，如果設定了 occurrence_count，則初始化 executedCount
        if (typeof newTaskConfig.occurrence_count === 'number' && newTaskConfig.occurrence_count > 0) {
            newTaskConfig.executedCount = 0; 
        }
        personalTasksConfig.push(newTaskConfig);
    }
    
    return await _saveAndReloadPersonalTasks(client, taskActionFunctions, `add/update: ${newTaskConfig.id}`);
}

async function deleteTask(client, taskActionFunctions, taskId, userId) {
    const initialLength = personalTasksConfig.length;
    personalTasksConfig = personalTasksConfig.filter(task => !(task.id === taskId && task.userId === userId));

    if (personalTasksConfig.length < initialLength) {
        console.log(`${colors.green}[SCHEDULER]${colors.reset} 任務 '${taskId}' 已從個人任務列表中移除。`);
        return await _saveAndReloadPersonalTasks(client, taskActionFunctions, `delete: ${taskId}`);
    }
    console.warn(`${colors.yellow}[SCHEDULER]${colors.reset} 警告：嘗試刪除任務 '${taskId}' 但未找到或不屬於該用戶。`);
    return false;
}
function getTasksByUserId(userId) {
    return personalTasksConfig.filter(task => task.userId === userId);
}
// === 匯出模組 ===
module.exports = {
    initializeScheduler,
    getAllTasks,
    getTask,
    addOrUpdateTask,
    deleteTask,
    getTasksByUserId,
    postAffectionLeaderboard,
};