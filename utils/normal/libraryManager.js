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
 */
function isSupportedFile(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * 列出指定資料夾 ID 下的子資料夾。
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
 * 只用來讀取當前層級的書籍。
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
 * 【已修改】智慧搜尋：比對完整檔名或全文內容。
 * @param {string} keyword - 搜尋的關鍵字。
 * @returns {Promise<Array<Object>>} 搜尋結果的書籍列表。
 */
async function searchBooks(keyword) {
  try {
    if (typeof keyword !== 'string' || !keyword?.trim()) {
      return [];
    }

    const safeKeyword = keyword.trim().replace(/'/g, "\\'");
    
    // 【修改處】使用 OR 條件組合「精確檔名」和「全文內容」搜尋
    const res = await drive.files.list({
      q: `'${LIBRARY_FOLDER_ID}' in parents and (name = '${safeKeyword}' or fullText contains '${safeKeyword}') and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
      corpora: 'user',
    });

    return (res.data.files || [])
      .filter(f => isSupportedFile(f.name))
      .map(file => ({
        ...file,
        downloadLink: file.webContentLink || file.webViewLink || null,
      }));
  } catch (error) {
    console.error(`[ERROR] searchBooks failed: ${error.message}`);
    throw new Error(`搜尋書籍失敗: ${error.message}`);
  }
}

/**
 * 從整個圖書館隨機選取一本書。
 */
async function getRandomBook() {
  const allBooks = await listAllBooksRecursively(LIBRARY_FOLDER_ID);
  if (!allBooks.length) return null;
  return allBooks[Math.floor(Math.random() * allBooks.length)];
}

/**
 * 統計圖書館的整體資訊。
 */
async function getLibraryStat() {
  const folders = await listSubfolders();
  let total = 0;
  const breakdown = {};
  for (const folder of folders) {
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
 * 提供分類名稱的自動完成建議。
 */
async function autocompleteCategory(partial) {
  const folders = await listSubfolders();
  return folders
    .filter(f => f.name.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 25)
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

function createSearchResultEmbed(keyword, results, pageIndex, maxPage, itemsPerPage) {
  const embed = new EmbedBuilder()
    .setTitle(`🔍 搜尋結果：${keyword}`)
    .setColor('#5865F2')
    .setFooter({ text: '圖書館系統' });

  const start = pageIndex * itemsPerPage;
  const pageResults = results.slice(start, start + itemsPerPage);

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
    .sort((a, b) => b[1] - a[1])
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

// --- 模組匯出 ---
module.exports = {
  listSubfolders,
  listAllBooksRecursively,
  listBooksAtLevel,
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