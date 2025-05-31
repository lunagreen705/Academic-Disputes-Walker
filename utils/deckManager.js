// your-discord-bot/utils/deckManager.js
const fs = require('fs');
const path = require('path');

const decks = {}; // 用來儲存所有已載入的牌堆資料

// 硬編碼牌堆資料夾路徑
// 假設這個模組始終知道牌堆在項目根目錄下的 data/desk/
const BASE_DATA_DIR = path.join(__dirname, '../data'); // 項目根目錄下的 data 資料夾
const DECK_SUBFOLDER = 'desk'; // 牌堆所在的子資料夾
const DECK_FOLDER_PATH = path.join(BASE_DATA_DIR, DECK_SUBFOLDER); // 完整的牌堆資料夾路徑

/**
 * 載入指定牌堆名稱的檔案，或自動載入DECK_FOLDER_PATH中所有的.json檔案。
 * @param {Array<string>} [deckNames=null] - 要載入的牌堆名稱陣列。如果為空或未提供，將自動載入所有.json檔案。
 */
function loadDecks(deckNames = null) { // 將 deckNames 設為可選參數
    // 確保牌堆資料夾存在
    if (!fs.existsSync(DECK_FOLDER_PATH)) {
        console.error(`[DECK MANAGER] 錯誤：牌堆資料夾不存在：${DECK_FOLDER_PATH}`);
        return;
    }

    let filesToLoad = [];

    if (deckNames && deckNames.length > 0) {
        // 如果提供了具體的牌堆名稱，就只載入這些
        filesToLoad = deckNames.map(name => `${name}.json`);
    } else {
        // 如果沒有提供具體的牌堆名稱，則自動讀取資料夾內所有 .json 檔案
        try {
            const allFiles = fs.readdirSync(DECK_FOLDER_PATH);
            filesToLoad = allFiles.filter(file => file.endsWith('.json'));
            console.log(`[DECK MANAGER] 檢測到 ${filesToLoad.length} 個牌堆檔案在 /${DECK_SUBFOLDER}/ 中。`);
        } catch (error) {
            console.error(`[DECK MANAGER] 讀取牌堆資料夾失敗:`, error.message);
            return;
        }
    }

    // 逐一載入檔案
    for (const file of filesToLoad) {
        const deckName = file.replace('.json', ''); // 從檔案名中移除 .json 得到牌堆名稱 (例如: foods)
        const filePath = path.join(DECK_FOLDER_PATH, file);
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            decks[deckName] = JSON.parse(data);
            console.log(`[DECK MANAGER] 成功載入牌堆: ${deckName} (從 ${file})`);
        } catch (error) {
            console.error(`[DECK MANAGER] 載入牌堆 ${deckName} (檔案 ${file}) 失敗:`, error.message);
            decks[deckName] = []; // 載入失敗時初始化為空陣列
        }
    }
}

/**
 * 從指定牌堆中隨機抽取一個項目。
 * @param {string} deckName - 要抽取的牌堆名稱。
 * @returns {any | null} 抽取的項目，如果牌堆不存在或為空則返回 null。
 */
function drawFromDeck(deckName) {
    const deck = decks[deckName];
    if (!deck || deck.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * deck.length);
    return deck[randomIndex];
}

module.exports = {
    loadDecks,
    drawFromDeck
};
