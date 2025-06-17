const { google } = require('googleapis');
const fs = require('fs');

// --- 初始化與認證 ---
const data = fs.readFileSync('/etc/secrets/GOOGLE_SERVICE_ACCOUNT_JSON', 'utf8');
const credentials = JSON.parse(data);

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

const LIBRARY_FOLDER_ID = '1NNbsjeQZrG8MQABXwf8nqaIHgRtO4_sY';
const BOOKSPAGE = 10;
const SUPPORTED_EXTENSIONS = ['pdf', 'epub', 'mobi', 'azw3', 'txt', 'doc', 'docx', 'odt', 'rtf', 'html', 'md', 'xlsx', 'jpg'];

// --- 內部快取機制 (新移入) ---
const internalCache = {
    allBooks: [],
    allBooksLastFetched: 0,
    stats: null,
    statsLastFetched: 0,
    cacheTTL: 1000 * 60 * 10, // 10 分鐘快取
};

function isInternalCacheValid(lastFetched) {
    return (Date.now() - lastFetched) < internalCache.cacheTTL;
}

// --- 核心 Drive API 函式 ---

function isSupportedFile(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
}

async function listSubfolders(parentId = null) {
    try {
        const folderId = parentId || LIBRARY_FOLDER_ID;
        const res = await drive.files.list({
            q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        return res.data.files || [];
    } catch (error) {
        console.error(`[Drive API Error] Failed to list subfolders for parent ${parentId || 'root'}:`, error);
        return [];
    }
}

// 遞迴函式，僅供內部使用 (例如統計)
async function listAllBooksRecursively(folderId) {
    const folderIdToQuery = folderId || LIBRARY_FOLDER_ID;
    let books = [];
    try {
        const res = await drive.files.list({
            q: `'${folderIdToQuery}' in parents and trashed = false`,
            fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
            pageSize: 1000, // 盡量一次取完
        });
        const files = res.data.files || [];

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
    } catch (error) {
        console.error(`[Drive API Error] Recursive list failed at folder ${folderIdToQuery}:`, error);
    }
    return books;
}

// 高效的、非遞迴函式，讀取當前層級書籍
async function listBooksAtLevel(folderId) {
    const folderIdToQuery = folderId || LIBRARY_FOLDER_ID;
    try {
        const res = await drive.files.list({
            q: `'${folderIdToQuery}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
            pageSize: 1000,
        });
        return (res.data.files || [])
            .filter(f => isSupportedFile(f.name))
            .map(file => ({
                ...file,
                downloadLink: file.webContentLink || file.webViewLink || null,
            }));
    } catch (error) {
        console.error(`[Drive API Error] Failed to list books at level ${folderIdToQuery}:`, error);
        return [];
    }
}

// 高效全文搜尋
async function searchBooks(keyword) {
    try {
        const res = await drive.files.list({
            q: `fullText contains '${keyword.replace(/'/g, "\\'")}' and trashed = false`,
            fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
            corpora: 'user',
            pageSize: 200, // 搜尋結果上限可設高一點
        });
        return (res.data.files || [])
            .filter(f => isSupportedFile(f.name))
            .map(file => ({
                ...file,
                downloadLink: file.webContentLink || file.webViewLink || null,
            }));
    } catch (error) {
        console.error(`[Drive API Error] Failed to search for keyword "${keyword}":`, error);
        return [];
    }
}

// 【架構優化】這兩個函式現在內建快取
async function getRandomBook() {
    if (!isInternalCacheValid(internalCache.allBooksLastFetched)) {
        console.log('Cache for allBooks expired, re-fetching...');
        internalCache.allBooks = await listAllBooksRecursively(LIBRARY_FOLDER_ID);
        internalCache.allBooksLastFetched = Date.now();
    }
    const allBooks = internalCache.allBooks;
    if (!allBooks.length) return null;
    return allBooks[Math.floor(Math.random() * allBooks.length)];
}

async function getLibraryStat() {
    if (isInternalCacheValid(internalCache.statsLastFetched)) {
        return internalCache.stats;
    }
    console.log('Cache for stats expired, re-calculating...');
    const folders = await listSubfolders();
    let total = 0;
    const breakdown = {};
    for (const folder of folders) {
        const books = await listAllBooksRecursively(folder.id);
        breakdown[folder.name] = books.length;
        total += books.length;
    }
    const stats = {
        totalCategories: folders.length,
        totalBooks: total,
        breakdown,
    };
    internalCache.stats = stats;
    internalCache.statsLastFetched = Date.now();
    return stats;
}

async function autocompleteCategory(partial) {
    const folders = await listSubfolders(); // 通常這個很快，不一定需要快取
    return folders
        .filter(f => f.name.toLowerCase().includes(partial.toLowerCase()))
        .slice(0, 25)
        .map(f => ({ name: f.name, value: f.name }));
}


// --- 匯出的函式列表 (已清理) ---
// 注意：與 Embed 相關的函式已移至 command 檔案或不再需要，讓 Manager 更專注於資料處理
module.exports = {
    // 核心資料獲取函式
    listSubfolders,
    listBooksAtLevel, // <-- 注意，這是正確的名稱
    searchBooks,
    getRandomBook, // <-- 已內建快取
    getLibraryStat, // <-- 已內建快取
    autocompleteCategory,
    // 常數
    BOOKSPAGE,
    LIBRARY_FOLDER_ID, // 匯出根目錄ID，讓指令端可以存取
};