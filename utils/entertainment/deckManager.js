// deckManager.js
const fs = require('fs');
const path = require('path');
const colors = require("../../UI/colors/colors"); // 確保這個路徑正確

const decks = {}; // 用來儲存所有已載入的牌堆資料
const availableDeckNames = []; // 新增：儲存所有已載入牌堆的名稱

// 硬編碼牌堆資料夾路徑
const BASE_DATA_DIR = path.join(__dirname, '../../data'); // 項目根目錄下的 data 資料夾
const DECK_SUBFOLDER = 'deck'; // 牌堆所在的子資料夾
const DECK_FOLDER_PATH = path.join(BASE_DATA_DIR, DECK_SUBFOLDER); // 完整的牌堆資料夾路徑

/**
 * 載入指定牌堆名稱的檔案，或自動載入DECK_FOLDER_PATH中所有的.json檔案。
 * @param {Array<string>} [deckNames=null] - 要載入的牌堆名稱陣列。如果為空或未提供，將自動載入所有.json檔案。
 */
function loadDecks(deckNames = null) {
    // 清空現有的牌堆和名稱列表，以便重新載入
    for (const key in decks) {
        delete decks[key];
    }
    availableDeckNames.length = 0; // 清空陣列

    // 確保牌堆資料夾存在
    if (!fs.existsSync(DECK_FOLDER_PATH)) {
        // 格式化錯誤輸出
        console.error(`${colors.red}[ DECK MANAGER ]${colors.reset} ${colors.red}錯誤：牌堆資料夾不存在 ❌: ${DECK_FOLDER_PATH}${colors.reset}`);
        return;
    }

    let filesToLoad = [];

    if (deckNames && deckNames.length > 0) {
        // 如果提供了具體的牌堆名稱，就只載入這些
        filesToLoad = deckNames.map(name => `${name}.json`);
        console.log(`${colors.cyan}[ DECK MANAGER ]${colors.reset} ${colors.blue}準備載入指定牌堆：${deckNames.join(', ')} 🎯${colors.reset}`); // 新增日誌
    } else {
        // 如果沒有提供具體的牌堆名稱，則自動讀取資料夾內所有 .json 檔案
        try {
            const allFiles = fs.readdirSync(DECK_FOLDER_PATH);
            filesToLoad = allFiles.filter(file => file.endsWith('.json'));
            // 格式化輸出
            console.log(`${colors.cyan}[ DECK MANAGER ]${colors.reset} ${colors.green}檢測到 ${filesToLoad.length} 個牌堆 ✨${colors.reset}`);
        } catch (error) {
            // 格式化錯誤輸出
            console.error(`${colors.red}[ DECK MANAGER ]${colors.reset} ${colors.red}讀取牌堆資料夾失敗 ❌: ${error.message}${colors.reset}`);
            return;
        }
    }

    // 逐一載入檔案
    for (const file of filesToLoad) {
        const deckName = file.replace('.json', ''); // 從檔案名中移除 .json 得到牌堆名稱
        const filePath = path.join(DECK_FOLDER_PATH, file);
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const parsedData = JSON.parse(data);

            // 檢查解析後的數據是否是有效的牌堆 (例如非空陣列)
            if (Array.isArray(parsedData) && parsedData.length > 0) {
                decks[deckName] = parsedData;
                availableDeckNames.push(deckName); // 將載入成功的牌堆名稱加入列表
                // 格式化成功輸出
                console.log(`${colors.cyan}[ DECK MANAGER ]${colors.reset} ${colors.green}成功載入牌堆 ${colors.yellow}${deckName}${colors.reset} ✅`);
            } else {
                // 格式化警告輸出
                console.warn(`${colors.yellow}[ DECK MANAGER ]${colors.reset} ${colors.yellow}警告：牌堆 ${colors.brightYellow}${deckName}${colors.reset}${colors.yellow} (檔案: ${file}) 為空或格式不正確，將不會載入 ⚠️${colors.reset}`);
                decks[deckName] = []; // 依然設為空陣列以避免後續錯誤
            }
        } catch (error) {
            // 格式化錯誤輸出
            console.error(`${colors.red}[ DECK MANAGER ]${colors.reset} ${colors.red}載入牌堆 ${colors.brightRed}${deckName}${colors.reset}${colors.red} (檔案: ${file}) 失敗 ❌: ${error.message}${colors.reset}`);
            decks[deckName] = []; // 載入失敗時初始化為空陣列
        }
    }
    console.log(`${colors.cyan}[ DECK MANAGER ]${colors.reset} ${colors.green}所有牌堆載入過程完成。已載入 ${availableDeckNames.length} 個牌堆。📦${colors.reset}`); 
}

/**
 * 從指定牌堆中隨機抽取一個項目。
 * @param {string} deckName - 要抽取的牌堆名稱。
 * @returns {any | null} 抽取的項目，如果牌堆不存在或為空則返回 null。
 */
function drawFromDeck(deckName) {
    const deck = decks[deckName];
    if (!deck || deck.length === 0) {
        // 可以考慮在這裡加一個日誌，但頻繁調用會很吵
        // console.warn(`${colors.yellow}[ DECK MANAGER ]${colors.reset} ${colors.yellow}警告：嘗試從空或不存在的牌堆 ${deckName} 抽取項目 ⚠️${colors.reset}`);
        return null;
    }
    const randomIndex = Math.floor(Math.random() * deck.length);
    return deck[randomIndex];
}

/**
 * 獲取所有已載入牌堆的名稱列表。
 * @returns {Array<string>} 已載入牌堆名稱的陣列。
 */
function getAvailableDeckNames() {
    return availableDeckNames;
}

module.exports = {
    loadDecks,
    drawFromDeck,
    getAvailableDeckNames 
};