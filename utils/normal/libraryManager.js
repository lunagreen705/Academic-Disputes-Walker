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
const BOOKSPAGE = 10;
const SUPPORTED_EXTENSIONS = ['pdf', 'epub', 'mobi', 'azw3', 'txt', 'doc', 'docx', 'odt', 'rtf', 'html', 'md','xlsx','jpg'];

function isSupportedFile(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

// 【修正2】讓 listSubfolders 更靈活
async function listSubfolders(parentId = null) {
    const folderId = parentId || LIBRARY_FOLDER_ID;
    const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed = false`,
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
    let books = [];

    for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
            const subBooks = await listBooksInFolder(file.id);
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

// 【重大優化1】使用 Google Drive 全文搜尋，極大提升效率
async function searchBooks(keyword) {
    const res = await drive.files.list({
        // 使用 fullText contains 進行全文搜尋，並處理關鍵字中的單引號
        q: `'${LIBRARY_FOLDER_ID}' in parents and fullText contains '${keyword.replace(/'/g, "\\'")}' and trashed = false`,
        fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
        corpora: 'user',
    });

    return (res.data.files || [])
        .filter(f => isSupportedFile(f.name))
        .map(file => ({
            ...file,
            downloadLink: file.webContentLink || file.webViewLink || null,
        }));
}

async function getRandomBook() {
    // 此函式依賴 listBooksInFolder，其效能瓶頸如上述所提
    const folders = await listSubfolders();
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
    // 此函式依賴 listBooksInFolder，其效能瓶頸如上述所提
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

// --- 以下是建立 Embed 和 Button 的函式，它們本身沒有問題 ---

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

function createPaginationRow(currentPage, totalPage, customIdPrefix) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${customIdPrefix}_prev_${currentPage}`)
            .setLabel('⬅️ 上一頁')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(`${customIdPrefix}_next_${currentPage}`)
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

// 模組匯出
module.exports = {
    listSubfolders,
    listBooksInFolder,
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