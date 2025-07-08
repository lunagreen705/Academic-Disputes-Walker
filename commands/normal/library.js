// commands/normal/library.js (已重構以適應統一模型)
const {
    listSubfolders,
    listBooksAtLevel,
    searchBooks,
    getRandomBook,
    getLibraryStat,
    autocompleteCategory,
    createPaginationRow,
    createSearchResultEmbed,
    createStatEmbed,
    createRandomBookEmbed,
    uploadBook,
    BOOKSPAGE,
} = require('../../utils/normal/libraryManager');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- 快取機制與快取函式 (保持不變) ---
// ... 您的 cache, isCacheValid, getCachedFolders, getCachedBooksInFolder, getCachedSearchResults 函式都非常棒，完全不需要修改 ...
const cache = {
  folders: new Map(),
  foldersLastFetched: new Map(),
  folderBooks: new Map(),
  folderBooksLastFetched: new Map(),
  searchResults: new Map(),
  searchResultsLastFetched: new Map(),
  cacheTTL: 1000 * 60 * 5, // 5 分鐘快取
};
function isCacheValid(lastFetched) {
  return (Date.now() - lastFetched) < cache.cacheTTL;
}
async function getCachedFolders(parentId = null) {
  const cacheKey = parentId || 'root';
  if (cache.folders.has(cacheKey) && isCacheValid(cache.foldersLastFetched.get(cacheKey) ?? 0)) {
    return cache.folders.get(cacheKey);
  }
  try {
    const folders = await listSubfolders(parentId);
    cache.folders.set(cacheKey, folders);
    cache.foldersLastFetched.set(cacheKey, Date.now());
    return folders;
  } catch (error) {
    throw new Error(`無法獲取資料夾: ${error.message}`);
  }
}
async function getCachedBooksInFolder(folderId) {
  const cacheKey = folderId || 'root';
  if (cache.folderBooks.has(cacheKey) && isCacheValid(cache.folderBooksLastFetched.get(cacheKey) ?? 0)) {
    return cache.folderBooks.get(cacheKey);
  }
  try {
    const books = await listBooksAtLevel(folderId);
    cache.folderBooks.set(cacheKey, books);
    cache.folderBooksLastFetched.set(cacheKey, Date.now());
    return books;
  } catch (error) {
    throw new Error(`無法獲取書籍: ${error.message}`);
  }
}
async function getCachedSearchResults(keyword) {
  if (cache.searchResults.has(keyword) && isCacheValid(cache.searchResultsLastFetched.get(keyword) ?? 0)) {
    return cache.searchResults.get(keyword);
  }
  try {
    const results = await searchBooks(keyword);
    cache.searchResults.set(keyword, results);
    cache.searchResultsLastFetched.set(keyword, Date.now());
    return results;
  } catch (error) {
    throw new Error(`無法搜尋書籍: ${error.message}`);
  }
}


// --- 核心顯示函式 (已修改) ---
async function showFolderContents(interaction, folderId, page = 1) {
    // 移除 try/catch，讓錯誤向上拋出給 run 或 handleButton 統一處理
    const subfolders = await getCachedFolders(folderId);
    const books = await getCachedBooksInFolder(folderId);

    // ... (建立 Embed 和 Components 的邏輯完全不變) ...
    const combinedItems = [
      ...subfolders.map(f => ({ type: 'folder', data: f })),
      ...books.map(b => ({ type: 'book', data: b })),
    ];
    const totalItems = combinedItems.length;
    const maxPage = Math.max(1, Math.ceil(totalItems / BOOKSPAGE));
    page = Math.max(1, Math.min(page, maxPage));
    const pageIndex = page - 1;
    const pageItems = combinedItems.slice(pageIndex * BOOKSPAGE, (pageIndex + 1) * BOOKSPAGE);
    const embed = new EmbedBuilder() /* ... */;
    const components = []; /* ... */

    // ✅ 將 safeInteractionReply 改為直接的 interaction.editReply
    await interaction.editReply({ content: null, embeds: [embed], components });
}


// --- 指令主體 ---
module.exports = {
  name: 'library',
  description: '圖書館相關功能指令',
  options: [ /* ... 您的 options 設定不變 ... */ ],

  // autocomplete 函式保持不變
  async autocomplete(interaction) {
    if (interaction.options.getSubcommand() === 'list') {
      const focused = interaction.options.getFocused();
      const suggestions = await autocompleteCategory(focused);
      await interaction.respond(suggestions);
    }
  },

  // run 函式 (已修改)
  async run(client, interaction) {
    // ✅ 移除本地的 deferReply 和 try/catch
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'browse':
          await showFolderContents(interaction, null, 1);
          break;

        case 'list': {
          const categoryName = interaction.options.getString('category');
          const folders = await getCachedFolders(null);
          const folder = folders.find(f => f.name.toLowerCase() === categoryName.toLowerCase());
          if (!folder) {
            // ✅ 直接使用 editReply
            return interaction.editReply({ content: `❌ 找不到分類「${categoryName}」` });
          }
          await showFolderContents(interaction, folder.id, 1);
          break;
        }

        case 'search': {
          const keyword = interaction.options.getString('keyword');
          const results = await getCachedSearchResults(keyword);
          if (!results.length) {
            // ✅ 直接使用 editReply
            return interaction.editReply({ content: `🔍 沒有找到符合「${keyword}」的書籍` });
          }
          const maxPage = Math.ceil(results.length / BOOKSPAGE);
          const embed = createSearchResultEmbed(keyword, results, 0, maxPage, BOOKSPAGE);
          const components = maxPage > 1 ? [createPaginationRow('search', encodeURIComponent(keyword), 0, maxPage)] : [];
          // ✅ 直接使用 editReply
          await interaction.editReply({ embeds: [embed], components });
          break;
        }
        
        // ... 其他 case 也同樣移除 safeInteractionReply，直接使用 editReply ...
        case 'upload': {
          const attachment = interaction.options.getAttachment('file');
          // ... 檔案驗證邏輯 ...
          await interaction.editReply({ content: '檔案上傳中，請稍候...' }); // 先給一個提示
          // ... 檔案下載與上傳邏輯 ...
          const uploadedFile = await uploadBook(tempFilePath, attachment.name);
          // ✅ 使用 followUp 或 editReply 來回報最終結果
          await interaction.editReply({ content: `✅ 成功上傳檔案：${uploadedFile.name}\n[點此檢視](${uploadedFile.webViewLink})` });
          break;
        }
        default:
        // ✅ 直接使用 editReply
          await interaction.editReply({ content: '❌ 未知的子指令。' });
        break;
    }
  },

  // handleButton 函式 (已修改)
  async handleButton(interaction) {
    // ✅ 移除本地的 deferUpdate 和 try/catch
    // 超時判斷是好的 UX，但應在 interactionCreate.js 中處理或在這裡用 followUp 回應
    if (Date.now() - interaction.message.createdTimestamp > 15 * 60 * 1000) {
      // ✅ 使用 update 來回應超時，因為 interactionCreate 已 deferUpdate
      return interaction.update({ content: '❌ 此交互已超時，請重新執行 `/library browse` 指令！', components: [] });
    }

    const parts = interaction.customId.split('|');
    if (parts.length !== 5 || parts[0] !== 'library') {
      // ✅ 使用 editReply 回應錯誤
      return interaction.editReply({ content: '❌ 無效的按鈕操作！', embeds: [], components: [] });
    }

    const [prefix, type, identifierRaw, pageStr, action] = parts;
    const identifier = decodeURIComponent(identifierRaw);
    let pageIndex = parseInt(pageStr, 10) || 0;

    // --- 路由邏輯 ---
    if (type === 'folder-nav' && action === 'enter') {
      const targetFolderId = identifier === 'root' ? null : identifier;
      await showFolderContents(interaction, targetFolderId, 1);
      return;
    }

    if (type === 'search') {
      if (action === 'next') pageIndex++;
      else if (action === 'prev') pageIndex--;
      
      const keyword = identifier;
      const results = await getCachedSearchResults(keyword);
      const maxPage = Math.ceil(results.length / BOOKSPAGE);
      pageIndex = Math.max(0, Math.min(pageIndex, maxPage - 1));

      const embed = createSearchResultEmbed(keyword, results, pageIndex, maxPage, BOOKSPAGE);
      const row = createPaginationRow('search', encodeURIComponent(keyword), pageIndex, maxPage);
      // ✅ 直接使用 editReply
      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    if (type === 'folder') {
      if (action === 'next') pageIndex++;
      else if (action === 'prev') pageIndex--;

      const folderId = identifier === 'root' ? null : identifier;
      await showFolderContents(interaction, folderId, pageIndex + 1);
      return;
    }
  },
};