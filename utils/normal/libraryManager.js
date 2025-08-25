// libraryManager.js
const { google } = require('googleapis');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const { getAuth } = require('../auth/oauth2'); 
// --- 快取機制 ---
// 快取圖書館內所有資料夾 ID 的快取物件。
const folderIdCache = {
    ids: null,
    timestamp: 0,
};
const FOLDER_CACHE_TTL = 1000 * 60 * 30; // 資料夾結構的快取時間為 30 分鐘

// --- 服務帳戶認證 (用於查詢功能) ---
// 從 Secret Manager 讀取並解析 Google Service Account 的憑證 
const serviceAccountData = fs.readFileSync('/etc/secrets/GOOGLE_SERVICE_ACCOUNT_JSON', 'utf8');
const serviceAccountCredentials = JSON.parse(serviceAccountData);

// 設定 Google API 認證，指定唯讀權限
const serviceAccountAuth = new google.auth.GoogleAuth({
  credentials: serviceAccountCredentials,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'], 
});

// 建立 Google Drive API 客戶端 (查詢功能)
const drive = google.drive({ version: 'v3', auth: serviceAccountAuth });
// ------------------------------------

// --- 常數設定 ---
const LIBRARY_FOLDER_ID = '1NNbsjeQZrG8MQABXwf8nqaIHgRtO4_sY'; // 圖書館根目錄的 Google Drive 資料夾 ID
const BOOKSPAGE = 5; // 在瀏覽模式下，每頁顯示的項目數量
const SUPPORTED_EXTENSIONS = ['pdf', 'epub', 'mobi', 'azw3', 'txt', 'doc', 'docx', 'odt', 'rtf', 'html', 'md', 'xlsx', 'jpg']; // 支援的檔案類型

/**
 * 檢查檔案名稱是否為支援的書籍格式。
 * @param {string} fileName - 要檢查的檔案名稱。
 * @returns {boolean} 如果支援則返回 true，否則返回 false。
 */
function isSupportedFile(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}
/**
 * 輔助函式與快取邏輯
 * 遞迴地獲取圖書館主資料夾內的所有資料夾 ID。
 * 結果會被快取，以避免在後續的搜尋中重複發起 API 呼叫。
 * @returns {Promise<string[]>} 一個包含所有資料夾 ID 的扁平化陣列。
 */
async function getAllLibraryFolderIds() {
    // 首先檢查快取
    if (folderIdCache.ids && (Date.now() - folderIdCache.timestamp) < FOLDER_CACHE_TTL) {
        console.log('[INFO] 正在使用快取的資料夾 ID 列表。');
        return folderIdCache.ids;
    }

    console.log('[INFO] 快取過期或為空。正在重新獲取圖書館資料夾結構...');
    // 使用 Set 來自動處理重複的 ID，並從根目錄開始
    const allFolderIds = new Set([LIBRARY_FOLDER_ID]); 

    async function fetchSubfolders(currentFolderId) {
        try {
            const res = await drive.files.list({
                q: `'${currentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id)',
            });
            const subfolders = res.data.files || [];

            // 使用 Promise.all 來並行處理下一層的遞迴，加快速度
            await Promise.all(subfolders.map(async (folder) => {
                allFolderIds.add(folder.id);
                await fetchSubfolders(folder.id); // 遞迴呼叫
            }));
        } catch (err) {
            console.error(`[ERROR] 無法獲取資料夾 ${currentFolderId} 的子資料夾: ${err.message}`);
        }
    }

    await fetchSubfolders(LIBRARY_FOLDER_ID);

    // 更新快取
    folderIdCache.ids = Array.from(allFolderIds);
    folderIdCache.timestamp = Date.now();
    
    console.log(`[INFO] 已快取 ${folderIdCache.ids.length} 個資料夾 ID。`);
    return folderIdCache.ids;
}
/**
 * 列出指定資料夾 ID 下的子資料夾。
 * 讓 listSubfolders 更靈活，若未提供 parentId，則預設使用根目錄。
 * @param {string|null} parentId - 父資料夾的 ID，若為 null 則使用 LIBRARY_FOLDER_ID。
 * @returns {Promise<Array<Object>>} 子資料夾的列表，每個物件包含 id 和 name。
 */
async function listSubfolders(parentId = null) {
  const folderId = parentId || LIBRARY_FOLDER_ID;
  const res = await drive.files.list({ // <-- 這裡繼續使用 serviceAccountAuth 建立的 drive
    q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  return res.data.files || [];
}

/**
 * 遞迴列出指定資料夾及其所有子資料夾中的所有書籍。
 * 將舊的遞迴函式改名，表示其真實用途 (掃描所有子資料夾)。
 * @param {string} folderId - 要開始掃描的資料夾 ID。
 * @returns {Promise<Array<Object>>} 所有書籍的列表。
 */
async function listAllBooksRecursively(folderId) {
  const folderIdToQuery = folderId || LIBRARY_FOLDER_ID;
  const res = await drive.files.list({ // <-- 這裡繼續使用 serviceAccountAuth 建立的 drive
    q: `'${folderIdToQuery}' in parents and trashed = false`,
    fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
  });

  const files = res.data.files || [];
  let books = [];

  for (const file of files) {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      const subBooks = await listAllBooksRecursively(file.id);
      books.push(...subBooks);
    } else if (isSupportedFile(file.name)) {
      books.push({
        ...file,
        downloadLink: file.webContentLink || file.webViewLink || null,
      });
    }
  }
  return books;
}

/**
 * 高效的、非遞迴的函式，只用來讀取當前層級的書籍。
 * @param {string|null} folderId - 要讀取的資料夾 ID，若為 null 則使用根目錄。
 * @returns {Promise<Array<Object>>} 該層級的書籍列表。
 */
async function listBooksAtLevel(folderId) {
  const folderIdToQuery = folderId || LIBRARY_FOLDER_ID;
  const res = await drive.files.list({ // <-- 這裡繼續使用 serviceAccountAuth 建立的 drive
    q: `'${folderIdToQuery}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
  });

  return (res.data.files || [])
    .filter(f => isSupportedFile(f.name))
    .map(file => ({
      ...file,
      downloadLink: file.webContentLink || file.webViewLink || null,
    }));
}

/**
 * 優化後的搜尋函式
 * 使用預先獲取的所有圖書館資料夾 ID 列表，來執行單一且高效的搜尋查詢。
 * @param {string} keyword - 搜尋的關鍵字。
 * @returns {Promise<Array<Object>>} 搜尋結果的電子書列表。
 */
async function searchBooks(keyword) {
  try {
    if (typeof keyword !== 'string' || !keyword?.trim()) {
      console.warn(`[WARN] searchBooks 提供了無效或為空的關鍵字: ${keyword}`);
      return [];
    }
    
    // 1. 獲取所有資料夾 ID (從快取或重新獲取)
    const allFolderIds = await getAllLibraryFolderIds();
    if (allFolderIds.length === 0) {
        console.warn('[WARN] 找不到可用於搜尋的圖書館資料夾。');
        return [];
    }

    // 2. 準備查詢語句的各個部分
    const safeKeyword = keyword.trim().replace(/'/g, "\\'").replace(/"/g, '\\"');
    const parentQueries = allFolderIds.map(id => `'${id}' in parents`);
    const supportedMimeTypesQuery = "mimeType != 'application/vnd.google-apps.folder'";

    // 3. 建構最終的、強大的查詢語句
    const fullQuery = [
      `name contains '${safeKeyword}'`,
      `(${parentQueries.join(' or ')})`, // 關鍵：搜尋所有可能的父資料夾
      supportedMimeTypesQuery,
      'trashed = false'
    ].join(' and ');


    // 4. 執行這一次高效的 API 呼叫
    const res = await drive.files.list({
      q: fullQuery,
      fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
      corpora: 'user', // 對於搜尋與服務帳戶共享的資料夾很重要
      pageSize: 100, // 可選：一次獲取更多結果
    });

    const files = res.data.files || [];

    // 5. 映射結果 (不再需要額外的過濾)
    return files
      .filter(file => isSupportedFile(file.name)) // 最好還是再次確認一下副檔名
      .map(file => ({
        id: file.id,
        name: file.name,
        webViewLink: file.webViewLink,
        webContentLink: file.webContentLink,
        mimeType: file.mimeType,
        downloadLink: file.webContentLink || file.webViewLink || null,
      }));

  } catch (error) {
    console.error(`[ERROR] searchBooks 執行失敗: ${error.message}, 關鍵字: ${keyword ?? 'undefined'}`);
    throw new Error(`搜尋書籍失敗: ${error.message}`);
  }
}
/**
 * 從整個圖書館隨機選取一本書。
 * 注意：此函式依賴較慢的遞迴函式，因為需要統計「所有」書籍。
 * @returns {Promise<Object|null>} 一本隨機書籍的物件，或在沒有書籍時返回 null。
 */
async function getRandomBook() {
  const allBooks = await listAllBooksRecursively(LIBRARY_FOLDER_ID);
  if (!allBooks.length) return null;
  return allBooks[Math.floor(Math.random() * allBooks.length)];
}

/**
 * 統計圖書館的整體資訊，包括分類數、總書數和各分類的書籍數量。
 * 注意：此函式依賴較慢的遞迴函式，因為需要統計「所有」書籍。
 * @returns {Promise<Object>} 包含統計資訊的物件。
 */
async function getLibraryStat() {
  const folders = await listSubfolders();
  let total = 0;
  const breakdown = {};
  for (const folder of folders) {
    // 使用遞迴函式來取得包含子資料夾在內的所有書籍數量
    const books = await listAllBooksRecursively(folder.id);
    breakdown[folder.name] = books.length;
    total += books.length;
  }
  return {
    totalCategories: folders.length,
    totalBooks: total,
    breakdown,
  };
}

/**
 * 根據使用者輸入的部分文字，提供分類名稱的自動完成建議。
 * @param {string} partial - 使用者輸入的部分分類名稱。
 * @returns {Promise<Array<Object>>} 符合 Discord 自動完成格式的建議列表。
 */
async function autocompleteCategory(partial) {
  const folders = await listSubfolders();
  return folders
    .filter(f => f.name.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 25) // Discord 最多只接受 25 個建議
    .map(f => ({ name: f.name, value: f.name }));
}


// --- 建立 Embed 和 Button 的輔助函式  ---

function createPaginatedEmbed(categoryName, files, page = 0) {
  const start = page * BOOKSPAGE;
  const end = start + BOOKSPAGE;
  const pageFiles = files.slice(start, end);

  const embed = new EmbedBuilder()
    .setTitle(`📂 分類：${categoryName} 的書籍（第 ${page + 1} 頁 / 共 ${Math.ceil(files.length / BOOKSPAGE)} 頁）`)
    .setColor('#FFA500')
    .setTimestamp()
    .setFooter({ text: '圖書館系統' });

  if (!pageFiles.length) {
    embed.setDescription('此分類目前沒有書籍。');
  } else {
    const desc = pageFiles.map(f => `📘 [${f.name}](${f.webViewLink}) | [下載](${f.downloadLink})`).join('\n');
    embed.setDescription(desc);
  }
  return embed;
}

function createPaginationRow(type, identifier, currentPage, totalPage) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`library|${type}|${identifier}|${currentPage}|prev`)
      .setLabel('⬅️ 上一頁')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`library|${type}|${identifier}|${currentPage}|next`)
      .setLabel('➡️ 下一頁')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPage - 1),
  );
}

function createCategoryListEmbed(folders) {
  const embed = new EmbedBuilder()
    .setTitle('📚 圖書館分類列表')
    .setColor('#00BFFF')
    .setTimestamp()
    .setFooter({ text: '圖書館系統' });

  if (!folders.length) {
    embed.setDescription('目前圖書館中沒有分類資料夾。');
  } else {
    const desc = folders.map(f => `📁 ${f.name}`).join('\n');
    embed.setDescription(desc);
  }
  return embed;
}

function createSearchResultEmbed(keyword, results, pageIndex, maxPage, BOOKSPAGE = 10) {
  const embed = new EmbedBuilder()
    .setTitle(`🔍 搜尋結果：${keyword}`)
    .setColor('#5865F2')
    .setFooter({ text: '圖書館系統' });

  const start = pageIndex * BOOKSPAGE;
  const end = Math.min(start + BOOKSPAGE, results.length);
  const pageResults = results.slice(start, end);

  if (pageResults.length === 0) {
    embed.setDescription('沒有找到任何書籍。');
  } else {
    embed.setDescription(`共找到 ${results.length} 本書籍，第 ${pageIndex + 1} / ${maxPage} 頁`);
    pageResults.forEach((book, index) => {
      embed.addFields({
        name: `${start + index + 1}. ${book.name}`,
        value: `[開啟](${book.webViewLink}) | [下載](${book.downloadLink || book.webViewLink})`,
        inline: false,
      });
    });
  }

  return embed;
}

function createStatEmbed(stat) {
  const embed = new EmbedBuilder()
    .setTitle('📊 圖書館統計資訊')
    .setColor('#9370DB')
    .setTimestamp()
    .setFooter({ text: '圖書館系統' })
    .addFields(
      { name: '分類數', value: `${stat.totalCategories}`, inline: true },
      { name: '總書數', value: `${stat.totalBooks}`, inline: true }
    );

  const breakdown = Object.entries(stat.breakdown)
    .sort((a, b) => b[1] - a[1]) // 依書籍數量由多到少排序
    .map(([k, v]) => `📁 ${k}：${v} 本`)
    .join('\n');

  embed.addFields({ name: '各分類藏書', value: breakdown || '無資料' });
  return embed;
}

function createRandomBookEmbed(book) {
  const embed = new EmbedBuilder()
    .setTitle('🎲 隨機推薦書籍')
    .setColor('#FF69B4')
    .setTimestamp()
    .setFooter({ text: '圖書館系統' });

  if (!book) {
    embed.setDescription('圖書館目前沒有任何書籍可以推薦。');
  } else {
    embed.setDescription(`📖 [${book.name}](${book.webViewLink}) | [下載](${book.downloadLink})`);
  }
  return embed;
}

// --- 上傳功能設定 ---
const UPLOAD_FOLDER_ID = '1oEDFA4FeYTO9bjbhTqLxq5EZbzygwZKf'; // 上傳目標資料夾

/**
 * 上傳本地檔案至 Google Drive 圖書館指定上傳資料夾。
 * 這個函數現在將使用 OAuth2 認證。
 * @param {string} filePath - 本地檔案的完整路徑。
 * @param {string} fileName - 上傳後的檔名。
 * @returns {Promise<Object>} 上傳後的檔案資訊。
 */
async function uploadBook(filePath, fileName) {
  try {
    // 1. 獲取經過 OAuth2 認證的客戶端
    const oauth2Client = await getAuth(); // 從你的 getAuth 模組獲取 OAuth2 實例

    // 2. 使用這個 OAuth2 客戶端創建一個新的 Drive 實例，專門用於上傳
    const oauth2Drive = google.drive({ version: 'v3', auth: oauth2Client });

    const fileMetadata = {
      name: fileName,
      parents: [UPLOAD_FOLDER_ID],
    };

    const media = {
      mimeType: 'application/octet-stream',
      body: fs.createReadStream(filePath),
    };

    // 使用 oauth2Drive 進行上傳操作
    const response = await oauth2Drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    return {
      id: response.data.id,
      name: response.data.name,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
    };
  } catch (error) {
    console.error(`[ERROR] Failed to upload book: ${error.message}`);
    throw new Error(`上傳失敗：${error.message}`);
  }
}

// --- 模組匯出 ---
module.exports = {
  listSubfolders,
  listAllBooksRecursively, // 改名後的遞迴函式
  listBooksAtLevel,      // 新增的高效函式
  searchBooks,
  getRandomBook,
  getLibraryStat,
  autocompleteCategory,
  createPaginatedEmbed,
  createPaginationRow,
  createCategoryListEmbed,
  createSearchResultEmbed,
  createStatEmbed,
  createRandomBookEmbed,
  uploadBook,
  UPLOAD_FOLDER_ID,
  BOOKSPAGE,
};