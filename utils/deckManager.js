// your-discord-bot/utils/deckManager.js
const fs = require('fs');
const path = require('path');

const decks = {}; // 用來儲存所有已載入的牌堆資料

/**
 * 載入所有指定的牌堆檔案。
 * @param {Array<string>} deckNames - 要載入的牌堆名稱陣列 (例如: ['foods', 'quotes', 'tarot'])
 * @param {string} baseDataDir - 存放資料檔案的根目錄路徑 (例如: path.join(__dirname, '../data'))
 * @param {string} subfolder - 牌堆所在的子資料夾名稱 (例如: 'desk')
 */
function loadDecks(deckNames, baseDataDir, subfolder) {
    const deckFolderPath = path.join(baseDataDir, subfolder); // 完整的牌堆資料夾路徑

    for (const name of deckNames) {
        const filePath = path.join(deckFolderPath, `${name}.json`);
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            decks[name] = JSON.parse(data);
            console.log(`[DECK MANAGER] 成功載入牌堆: ${name} (於 /${subfolder}/)`);
        } catch (error) {
            console.error(`[DECK MANAGER] 載入牌堆 ${name} (於 /${subfolder}/) 失敗:`, error.message);
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
