const { google } = require('googleapis');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

// 從 Secret Manager 讀取並解析 Google Service Account 的憑證
const data = fs.readFileSync('/etc/secrets/GOOGLE_SERVICE_ACCOUNT_JSON', 'utf8');
const credentials = JSON.parse(data);

// 設定 Google API 認證，指定唯讀權限
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

// 建立 Google Drive API 客戶端
const drive = google.drive({ version: 'v3', auth });

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
 * 列出指定資料夾 ID 下的子資料夾。
 * 讓 listSubfolders 更靈活，若未提供 parentId，則預設使用根目錄。
 * @param {string|null} parentId - 父資料夾的 ID，若為 null 則使用 LIBRARY_FOLDER_ID。
 * @returns {Promise<Array<Object>>} 子資料夾的列表，每個物件包含 id 和 name。
 */
async function listSubfolders(parentId = null) {
  const folderId = parentId || LIBRARY_FOLDER_ID;
  const res = await drive.files.list({
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
  const res = await drive.files.list({
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
  const res = await drive.files.list({
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
 * 使用 Google Drive 的全文搜尋功能來尋找書籍，極大提升效率。
 * @param {string} keyword - 搜尋的關鍵字。
 * @returns {Promise<Array<Object>>} 搜尋結果的書籍列表。
 */
async function searchBooks(keyword) {
  const res = await drive.files.list({
    // 在圖書館根目錄下進行全文搜尋，並過濾掉已刪除的檔案
    q: `'${LIBRARY_FOLDER_ID}' in parents and fullText contains '${keyword.replace(/'/g, "\\'")}' and trashed = false`,
    fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
    corpora: 'user', // 指定在使用者擁有的檔案中搜尋
  });

  return (res.data.files || [])
    .filter(f => isSupportedFile(f.name))
    .map(file => ({
      ...file,
      downloadLink: file.webContentLink || file.webViewLink || null,
    }));
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

// --- 以下是建立 Embed 和 Button 的輔助函式 ---

function createPaginatedEmbed(categoryName, files, page = 0) {
  const start = page * BOOKSPAGE;
  const end = start + BOOKSPAGE;
  const pageFiles = files.slice(start, end);

  const embed = new EmbedBuilder()
    .setTitle(`📂 分類：${categoryName} 的書籍（第 ${page + 1} 頁 / 共 ${Math.ceil(files.length / BOOKSPAGE)} 頁）`)
    .setColor('#FFA500')
    .setTimestamp()
    .setFooter({ text: '圖書館' });

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
    .setFooter({ text: '圖書館' });

  if (!folders.length) {
    embed.setDescription('目前圖書館中沒有分類資料夾。');
  } else {
    const desc = folders.map(f => `📁 ${f.name}`).join('\n');
    embed.setDescription(desc);
  }
  return embed;
}

function createSearchResultEmbed(keyword, results, page = 0) {
  const BOOKSPAGE_SEARCH = 5; // 搜尋結果每頁顯示數量
  const start = page * BOOKSPAGE_SEARCH;
  const end = start + BOOKSPAGE_SEARCH;
  const pageResults = results.slice(start, end);

  const embed = new EmbedBuilder()
    .setTitle(`🔍 搜尋結果：${keyword}（第 ${page + 1} 頁 / 共 ${Math.ceil(results.length / BOOKSPAGE_SEARCH)} 頁）`)
    .setColor('#32CD32')
    .setTimestamp()
    .setFooter({ text: '圖書館' });

  if (!pageResults.length) {
    embed.setDescription('沒有找到相關的書籍。');
  } else {
    const desc = pageResults.map(f => `📖 [${f.name}](${f.webViewLink}) | [下載](${f.downloadLink})`).join('\n');
    embed.setDescription(desc);
  }
  return embed;
}

function createStatEmbed(stat) {
  const embed = new EmbedBuilder()
    .setTitle('📊 圖書館統計資訊')
    .setColor('#9370DB')
    .setTimestamp()
    .setFooter({ text: '圖書館' })
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
    .setFooter({ text: '圖書館' });

  if (!book) {
    embed.setDescription('圖書館目前沒有任何書籍可以推薦。');
  } else {
    embed.setDescription(`📖 [${book.name}](${book.webViewLink}) | [下載](${book.downloadLink})`);
  }
  return embed;
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
  BOOKSPAGE,
};