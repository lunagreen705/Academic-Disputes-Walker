const { google } = require('googleapis');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const data = fs.readFileSync('/etc/secrets/GOOGLE_SERVICE_ACCOUNT_JSON', 'utf8');
const credentials = JSON.parse(data);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

const LIBRARY_FOLDER_ID = '1NNbsjeQZrG8MQABXwf8nqaIHgRtO4_sY';
const BOOKSPAGE = 5;
const SUPPORTED_EXTENSIONS = ['pdf', 'epub', 'mobi', 'azw3', 'txt', 'doc', 'docx', 'odt', 'rtf', 'html', 'md', 'xlsx', 'jpg'];

function isSupportedFile(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

async function listSubfolders(parentId = null) {
  const folderId = parentId || LIBRARY_FOLDER_ID;
  console.log(`[DEBUG] listSubfolders called with folderId: ${folderId}`);
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
    });
    console.log(`[DEBUG] listSubfolders response: ${JSON.stringify(res.data.files)}`);
    return res.data.files || [];
  } catch (error) {
    console.error(`[ERROR] listSubfolders failed for folderId ${folderId}: ${error.message}`);
    throw new Error(`無法獲取資料夾列表: ${error.message}`);
  }
}

async function listAllBooksRecursively(folderId) {
  const folderIdToQuery = folderId || LIBRARY_FOLDER_ID;
  console.log(`[DEBUG] listAllBooksRecursively called with folderId: ${folderIdToQuery}`);
  try {
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
    console.log(`[DEBUG] listAllBooksRecursively books: ${JSON.stringify(books)}`);
    return books;
  } catch (error) {
    console.error(`[ERROR] listAllBooksRecursively failed for folderId ${folderIdToQuery}: ${error.message}`);
    throw new Error(`無法獲取書籍列表: ${error.message}`);
  }
}

async function listBooksAtLevel(folderId) {
  const folderIdToQuery = folderId || LIBRARY_FOLDER_ID;
  console.log(`[DEBUG] listBooksAtLevel called with folderId: ${folderIdToQuery}`);
  try {
    const res = await drive.files.list({
      q: `'${folderIdToQuery}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
    });

    const books = (res.data.files || [])
      .filter(f => isSupportedFile(f.name))
      .map(file => ({
        ...file,
        downloadLink: file.webContentLink || file.webViewLink || null,
      }));
    console.log(`[DEBUG] listBooksAtLevel response: ${JSON.stringify(books)}`);
    return books;
  } catch (error) {
    console.error(`[ERROR] listBooksAtLevel failed for folderId ${folderIdToQuery}: ${error.message}`);
    throw new Error(`無法獲取書籍列表: ${error.message}`);
  }
}

async function searchBooks(keyword) {
  console.log(`[DEBUG] searchBooks called with keyword: ${keyword}`);
  try {
    const res = await drive.files.list({
      q: `'${LIBRARY_FOLDER_ID}' in parents and fullText contains '${keyword.replace(/'/g, "\\'")}' and trashed = false`,
      fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
      corpora: 'user',
    });

    const results = (res.data.files || [])
      .filter(f => isSupportedFile(f.name))
      .map(file => ({
        ...file,
        downloadLink: file.webContentLink || file.webViewLink || null,
      }));
    console.log(`[DEBUG] searchBooks results: ${JSON.stringify(results)}`);
    return results;
  } catch (error) {
    console.error(`[ERROR] searchBooks failed: ${error.message}`);
    throw new Error(`無法搜尋書籍: ${error.message}`);
  }
}

async function getRandomBook() {
  try {
    const allBooks = await listAllBooksRecursively(LIBRARY_FOLDER_ID);
    if (!allBooks.length) return null;
    return allBooks[Math.floor(Math.random() * allBooks.length)];
  } catch (error) {
    console.error(`[ERROR] getRandomBook failed: ${error.message}`);
    throw new Error(`無法獲取隨機書籍: ${error.message}`);
  }
}

async function getLibraryStat() {
  try {
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
  } catch (error) {
    console.error(`[ERROR] getLibraryStat failed: ${error.message}`);
    throw new Error(`無法獲取統計資訊: ${error.message}`);
  }
}

async function autocompleteCategory(partial) {
  try {
    const folders = await listSubfolders();
    return folders
      .filter(f => f.name.toLowerCase().includes(partial.toLowerCase()))
      .slice(0, 25)
      .map(f => ({ name: f.name, value: f.name }));
  } catch (error) {
    console.error(`[ERROR] autocompleteCategory failed: ${error.message}`);
    return [];
  }
}

function createPaginationRow(type, identifier, pageIndex, maxPage) {
  console.log(`[DEBUG] Creating pagination row: type=${type}, identifier=${identifier}, pageIndex=${pageIndex}, maxPage=${maxPage}`);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`library|${type}|${identifier}|${pageIndex}|prev`)
      .setLabel('⬅️ 上一頁')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId(`library|${type}|${identifier}|${pageIndex}|next`)
      .setLabel('➡️ 下一頁')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex >= maxPage - 1),
  );
}

function createSearchResultEmbed(keyword, results, page = 0) {
  const BOOKSPAGE_SEARCH = 5;
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
  } else {
    embed.setDescription(`📖 [${book.name}](${book.webViewLink}) | [下載](${book.downloadLink})`);
  }
  return embed;
}

module.exports = {
  listSubfolders,
  listAllBooksRecursively,
  listBooksAtLevel,
  searchBooks,
  getRandomBook,
  getLibraryStat,
  autocompleteCategory,
  createPaginationRow,
  createSearchResultEmbed,
  createStatEmbed,
  createRandomBookEmbed,
  BOOKSPAGE,
};