// your-discord-bot/utils/deckManager.js
const fs = require('fs');
const path = require('path');

const decks = {}; // 用來儲存所有已載入的牌堆資料

// ***硬編碼牌堆資料夾路徑***
// 假設這個模組始終知道牌堆在項目根目錄下的 data/desk/
const BASE_DATA_DIR = path.join(__dirname, '../data'); // 項目根目錄下的 data 資料夾
const DECK_SUBFOLDER = 'desk'; // 牌堆所在的子資料夾
const DECK_FOLDER_PATH = path.join(BASE_DATA_DIR, DECK_SUBFOLDER); // 完整的牌堆資料夾路徑

/**
 * 載入所有指定的牌堆檔案。
 * 這個函式現在不需要外部傳入資料路徑了。
 * @param {Array<string>} deckNames - 要載入的牌堆名稱陣列 (例如: ['foods', 'quotes', 'tarot'])
 */
function loadDecks(deckNames) {
    // 確保牌堆資料夾存在
    if (!fs.existsSync(DECK_FOLDER_PATH)) {
        console.error(`[DECK MANAGER] 錯誤：牌堆資料夾不存在：${DECK_FOLDER_PATH}`);
        return;
    }

    for (const name of deckNames) {
        const filePath = path.join(DECK_FOLDER_PATH, `${name}.json`);
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            decks[name] = JSON.parse(data);
            console.log(`[DECK MANAGER] 成功載入牌堆: ${name} (於 /${DECK_SUBFOLDER}/)`);
        } catch (error) {
            console.error(`[DECK MANAGER] 載入牌堆 ${name} (於 /${DECK_SUBFOLDER}/) 失敗:`, error.message);
            decks[name] = []; // 載入失敗時初始化為空陣列
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
