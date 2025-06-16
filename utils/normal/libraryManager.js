const { google } = require('googleapis');
const { EmbedBuilder } = require('discord.js');
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

const LIBRARY_FOLDER_ID = '1NNbsjeQZrG8MQABXwf8nqaIHgRtO4_sY';

// 統一使用這個常數控制每頁顯示數量
const BOOKSPAGE = 5;

// 支援的副檔名（電子書常見格式）
const SUPPORTED_EXTENSIONS = ['pdf', 'epub', 'mobi', 'azw3', 'txt', 'doc', 'docx', 'odt', 'rtf', 'html', 'md'];

/**
 * 判斷檔案是否為支援的電子書格式
 * @param {string} fileName 
 * @returns {boolean}
 */
function isSupportedFile(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

async function listSubfolders() {
  const res = await drive.files.list({
    q: `'${LIBRARY_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  return res.data.files || [];
}

async function listBooksInFolder(folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
  });
  const files = res.data.files || [];
  // 過濾支援的電子書格式
  const filteredFiles = files.filter(file => isSupportedFile(file.name));
  
  // 加入下載連結欄位
  return filteredFiles.map(file => {
    // Google Drive 文件類型 mime 會有特別情況，webContentLink 有時不存在，要用 webViewLink
    // 一般文件直接用 webContentLink 可下載
    // 有些 google docs 類型不能直接下載，這裡只做簡單判斷
    const downloadLink = file.webContentLink || file.webViewLink || null;
    return {
      ...file,
      downloadLink,
    };
  });
}

async function searchBooks(keyword) {
  const folders = await listSubfolders();
  let results = [];
  for (const folder of folders) {
    const books = await listBooksInFolder(folder.id);
    results.push(...books.filter(f => f.name.toLowerCase().includes(keyword.toLowerCase())));
  }
  return results;
}

async function getRandomBook() {
  const folders = await listSubfolders();
  if (!folders.length) return null;

  // 挑選有書籍的資料夾
  const foldersWithBooks = [];
  for (const folder of folders) {
    const books = await listBooksInFolder(folder.id);
    if (books.length) foldersWithBooks.push({ folder, books });
  }
  if (!foldersWithBooks.length) return null;

  const randomIndex = Math.floor(Math.random() * foldersWithBooks.length);
  const { books } = foldersWithBooks[randomIndex];
  return books[Math.floor(Math.random() * books.length)];
}

async function getLibraryStat() {
  const folders = await listSubfolders();
  let total = 0;
  const breakdown = {};

  for (const folder of folders) {
    const books = await listBooksInFolder(folder.id);
    breakdown[folder.name] = books.length;
    total += books.length;
  }

  return {
    totalCategories: folders.length,
    totalBooks: total,
    breakdown,
  };
}

async function autocompleteCategory(partial) {
  const folders = await listSubfolders();
  return folders
    .filter(f => f.name.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 25)
    .map(f => ({ name: f.name, value: f.name }));
}

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
    // 顯示書名 + 瀏覽連結 + 下載連結
    const desc = pageFiles.map(f => 
      `📘 [${f.name}](${f.webViewLink}) | [下載](${f.downloadLink})`
    ).join('\n');
    embed.setDescription(desc);
  }

  return embed;
}

function createCategoryListEmbed(folders) {
  const embed = new EmbedBuilder()
    .setTitle('📚 圖書館分類列表')
    .setColor('#00BFFF')
    .setTimestamp()
    .setFooter({ text: '圖書館' });

  if (!folders.length) {
    embed.setDescription('目前圖書館中沒有分類資料夾。');
    return embed;
  }

  const desc = folders.map(f => `📁 ${f.name}`).join('\n');
  embed.setDescription(desc);
  return embed;
}

function createSearchResultEmbed(keyword, results, page = 0) {
  const BOOKSPAGE_SEARCH = 10;
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
    const desc = pageResults.map(f => 
      `📖 [${f.name}](${f.webViewLink}) | [下載](${f.downloadLink})`
    ).join('\n');
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
    .setFooter({ text: '圖書館' });

  if (!book) {
    embed.setDescription('圖書館目前沒有任何書籍可以推薦。');
    return embed;
  }

  embed.setDescription(`📖 [${book.name}](${book.webViewLink}) | [下載](${book.downloadLink})`);
  return embed;
}

module.exports = {
  listSubfolders,
  listBooksInFolder,
  searchBooks,
  getRandomBook,
  getLibraryStat,
  autocompleteCategory,
  createPaginatedEmbed,
  createCategoryListEmbed,
  createSearchResultEmbed,
  createStatEmbed,
  createRandomBookEmbed,
  BOOKSPAGE,
};
