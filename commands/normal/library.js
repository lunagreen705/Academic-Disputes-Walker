// 檔案：/commands/library.js

const {
  // 引入 libraryManager 中所有需要的函式
  // 特別注意我們引入了新的 listBooksAtLevel 和改名後的 listAllBooksRecursively
  listSubfolders,
  listBooksAtLevel,
  listAllBooksRecursively,
  searchBooks,
  getRandomBook,
  getLibraryStat,
  autocompleteCategory,
  createPaginationRow,
  createSearchResultEmbed,
  createStatEmbed,
  createRandomBookEmbed,
  BOOKSPAGE,
} = require('../../utils/normal/libraryManager'); // 請再次確認此路徑是否正確

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// --- 快取機制 (使用優化後的 Map 結構) ---
const cache = {
  folders: new Map(),
  foldersLastFetched: new Map(),
  folderBooks: new Map(),
  folderBooksLastFetched: new Map(),
  searchResults: new Map(),
  searchResultsLastFetched: new Map(),
  cacheTTL: 1000 * 60 * 5, // 5分鐘快取
};

function isCacheValid(lastFetched) {
  return (Date.now() - lastFetched) < cache.cacheTTL;
}

// 快取函式，呼叫 manager 中的 API 函式
async function getCachedFolders(parentId = null) {
  const cacheKey = parentId || 'root';
  if (cache.folders.has(cacheKey) && isCacheValid(cache.foldersLastFetched.get(cacheKey) ?? 0)) {
    return cache.folders.get(cacheKey);
  }
  const folders = await listSubfolders(parentId);
  cache.folders.set(cacheKey, folders);
  cache.foldersLastFetched.set(cacheKey, Date.now());
  return folders;
}

// 快取函式，呼叫高效的 listBooksAtLevel
async function getCachedBooksInFolder(folderId) {
  const cacheKey = folderId || 'root';
  if (cache.folderBooks.has(cacheKey) && isCacheValid(cache.folderBooksLastFetched.get(cacheKey) ?? 0)) {
    return cache.folderBooks.get(cacheKey);
  }
  // 【關鍵】呼叫新的高效函式，解決瀏覽緩慢問題
  const books = await listBooksAtLevel(folderId);
  cache.folderBooks.set(cacheKey, books);
  cache.folderBooksLastFetched.set(cacheKey, Date.now());
  return books;
}

async function getCachedSearchResults(keyword) {
  if (cache.searchResults.has(keyword) && isCacheValid(cache.searchResultsLastFetched.get(keyword) ?? 0)) {
    return cache.searchResults.get(keyword);
  }
  const results = await searchBooks(keyword);
  cache.searchResults.set(keyword, results);
  cache.searchResultsLastFetched.set(keyword, Date.now());
  return results;
}

// --- 核心顯示函式 (保留在指令檔中，以便存取快取) ---
async function showFolderContents(interaction, folderId, page = 1) {
  const subfolders = await getCachedFolders(folderId);
  const books = await getCachedBooksInFolder(folderId);

  const combinedItems = [
    ...subfolders.map(f => ({ type: 'folder', data: f })),
    ...books.map(b => ({ type: 'book', data: b })),
  ];
  
  const totalItems = combinedItems.length;
  const maxPage = Math.max(1, Math.ceil(totalItems / BOOKSPAGE));
  
  page = Math.max(1, Math.min(page, maxPage));
  const pageIndex = page - 1;

  const pageItems = combinedItems.slice(pageIndex * BOOKSPAGE, (pageIndex + 1) * BOOKSPAGE);

  const embed = new EmbedBuilder()
    .setTitle(folderId ? `📁 資料夾內容` : '📚 圖書館根目錄')
    .setDescription(`共 ${subfolders.length} 個子資料夾，${books.length} 本書籍。\n目前顯示第 ${page} / ${maxPage} 頁`)
    .setColor('#5865F2')
    .setFooter({ text: `資料夾ID: ${folderId || 'root'}` });

  if (pageItems.length === 0) {
    embed.addFields({ name: '空空如也', value: '這個資料夾中沒有任何項目。' });
  } else {
    for (const item of pageItems) {
      if (item.type === 'folder') {
        embed.addFields({
          name: `📁 資料夾：${item.data.name}`,
          value: `點擊下方同名按鈕進入此資料夾。`,
          inline: false,
        });
      } else if (item.type === 'book') {
        const bookData = item.data;
        const downloadLink = bookData.webContentLink || bookData.webViewLink;
        embed.addFields({
          name: `📖 書籍：${bookData.name}`,
          value: `[在瀏覽器中開啟](${bookData.webViewLink}) | [下載](${downloadLink})`,
          inline: false,
        });
      }
    }
  }

  const components = [];
  const folderButtons = new ActionRowBuilder();
  subfolders.slice(0, 5).forEach(folder => {
    folderButtons.addComponents(
      new ButtonBuilder()
        .setCustomId(`library_folder-nav_${folder.id}_0_enter`)
        .setLabel(folder.name.length > 20 ? folder.name.slice(0, 17) + '...' : folder.name)
        .setStyle(ButtonStyle.Success)
        .setEmoji('📁')
    );
  });
  if (folderButtons.components.length > 0) {
    components.push(folderButtons);
  }
  
  if (totalItems > BOOKSPAGE) {
    const paginationRow = createPaginationRow('folder', encodeURIComponent(folderId ?? 'root'), pageIndex, maxPage);
    components.push(paginationRow);
  }

  await interaction.editReply({ embeds: [embed], components });
}

// --- 指令主體 ---
module.exports = {
  name: 'library',
  description: '圖書館相關功能指令',
  options: [
    { name: 'browse', description: '瀏覽圖書館', type: 1 },
    {
      name: 'list',
      description: '直接跳至指定分類',
      type: 1,
      options: [{ name: 'category', description: '分類名稱', type: 3, required: true, autocomplete: true }],
    },
    {
      name: 'search',
      description: '搜尋書籍',
      type: 1,
      options: [{ name: 'keyword', description: '關鍵字', type: 3, required: true }],
    },
    { name: 'random', description: '隨機推薦一本書', type: 1 },
    { name: 'stats', description: '查看圖書館統計', type: 1 },
  ],

  async autocomplete(interaction) {
    if (interaction.options.getSubcommand() === 'list') {
      const focused = interaction.options.getFocused();
      const suggestions = await autocompleteCategory(focused);
      await interaction.respond(suggestions);
    }
  },

  async run(client, interaction) {
    await interaction.deferReply();
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
          return interaction.editReply({ content: `❌ 找不到分類「${categoryName}」` });
        }
        await showFolderContents(interaction, folder.id, 1);
        break;
      }

      case 'search': {
        const keyword = interaction.options.getString('keyword');
        const results = await getCachedSearchResults(keyword);
        if (!results.length) {
          return interaction.editReply({ content: `🔍 沒有找到符合「${keyword}」的書籍` });
        }
        const embed = createSearchResultEmbed(keyword, results, 0);
        const maxPage = Math.ceil(results.length / 10);
        const components = maxPage > 1 ? [createPaginationRow('search', encodeURIComponent(keyword), 0, maxPage)] : [];
        return interaction.editReply({ embeds: [embed], components });
      }

      case 'random': {
        const book = await getRandomBook();
        const embed = createRandomBookEmbed(book);
        return interaction.editReply({ embeds: [embed] });
      }

      case 'stats': {
        const stat = await getLibraryStat();
        const embed = createStatEmbed(stat);
        return interaction.editReply({ embeds: [embed] });
      }
    }
  },

async handleButton(interaction) {
    // 【偵錯日誌 1】記錄函式被觸發的時間和 customId
    console.log(`[DEBUG] ${new Date().toISOString()} - handleButton 觸發 - customId: ${interaction.customId}`);

    try {
        // 【偵錯日誌 2】記錄即將執行的關鍵操作
        console.log(`[DEBUG] ${new Date().toISOString()} - 準備執行 deferUpdate...`);
        await interaction.deferUpdate();
        console.log(`[DEBUG] ${new Date().toISOString()} - deferUpdate 已成功執行！`);

        const [prefix, type, identifierRaw, pageStr, action] = interaction.customId.split('_');
        if (prefix !== 'library') {
            console.log(`[DEBUG] Prefix 不符，結束處理。`);
            return;
        }

        console.log(`[DEBUG] 正在處理 Type: ${type}, Identifier: ${identifierRaw}, Action: ${action}`);

        const identifier = decodeURIComponent(identifierRaw);
        let pageIndex = parseInt(pageStr, 10) || 0;

        if (type === 'folder-nav') {
            console.log(`[DEBUG] 進入 folder-nav 邏輯，ID: ${identifier}`);
            await showFolderContents(interaction, identifier, 1);
            console.log(`[DEBUG] folder-nav 邏輯處理完畢。`);
            return;
        }
        
        if (type === 'search') {
            if (action === 'next') pageIndex++;
            else if (action === 'prev') pageIndex--;
            
            const keyword = identifier;
            console.log(`[DEBUG] 進入 search 翻頁邏輯，目標頁碼索引: ${pageIndex}`);
            const results = await getCachedSearchResults(keyword);
            if (!results.length) {
                return interaction.editReply({ content: '🔍 搜尋結果已過期或不存在', components: [] });
            }
            const maxPage = Math.ceil(results.length / 10);
            pageIndex = Math.max(0, Math.min(pageIndex, maxPage - 1));
            const embed = createSearchResultEmbed(keyword, results, pageIndex);
            const row = createPaginationRow('search', encodeURIComponent(keyword), pageIndex, maxPage);
            await interaction.editReply({ embeds: [embed], components: [row] });
            console.log(`[DEBUG] search 翻頁邏輯處理完畢。`);
            return;
        }
        
        if (type === 'folder') {
            if (action === 'next') pageIndex++;
            else if (action === 'prev') pageIndex--;
            
            const folderId = identifier === 'root' ? null : identifier;
            const page = pageIndex + 1;
            
            console.log(`[DEBUG] 進入 folder 翻頁邏輯，目標頁碼: ${page}`);
            await showFolderContents(interaction, folderId, page);
            console.log(`[DEBUG] folder 翻頁邏輯處理完畢。`);
            return;
        }

    } catch (error) {
        // 【偵錯日誌 4】如果 try 區塊中發生任何錯誤，都會在這裡被捕捉
        console.error(`[DEBUG] --- CATCH 區塊捕捉到嚴重錯誤 ---`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ content: '❌ 操作時發生錯誤，請查看主控台日誌。', embeds: [], components: [] });
        }
    }
}, // <--- 注意 handleButton 函式到此結束
};