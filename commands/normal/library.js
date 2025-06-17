// 檔案：/commands/library.js

const {
  listSubfolders,
  listBooksInFolder,
  searchBooks,
  getRandomBook,
  getLibraryStat,
  createSearchResultEmbed,
  createStatEmbed,
  createRandomBookEmbed,
  autocompleteCategory,
  BOOKSPAGE,
} = require('../../utils/normal/libraryManager'); // 請確認此路徑是否正確

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// --- 快取機制 (已優化) ---
const cache = {
  // 【優化1】將 cache.folders 和 lastFetched 改為 Map，使其可以快取子資料夾
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

// 【優化1】重寫 getCachedFolders 以支援子資料夾快取
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

async function getCachedBooksInFolder(folderId) {
  const cacheKey = folderId || 'root'; // 根目錄的書也要有key
  if (cache.folderBooks.has(cacheKey) && isCacheValid(cache.folderBooksLastFetched.get(cacheKey) ?? 0)) {
    return cache.folderBooks.get(cacheKey);
  }
  const books = await listBooksInFolder(folderId);
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

// --- 核心顯示函式 (已修正) ---
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
        // 【修正1】修正顯示書籍的資料欄位不正確的問題
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

  // 【優化2】第一排按鈕：子資料夾導航
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
  
  // 【優化2】第二排按鈕：分頁
  if (totalItems > BOOKSPAGE) {
    const paginationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`library_folder_${encodeURIComponent(folderId ?? 'root')}_${pageIndex}_prev`)
        .setLabel('上一頁')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIndex <= 0),
      new ButtonBuilder()
        .setCustomId(`library_folder_${encodeURIComponent(folderId ?? 'root')}_${pageIndex}_next`)
        .setLabel('下一頁')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIndex >= maxPage - 1)
    );
    components.push(paginationRow);
  }

  // 統一回覆或編輯
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [embed], components });
  } else {
    await interaction.reply({ embeds: [embed], components });
  }
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
    // 【優化3】統一使用 deferReply 提升體驗
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
        // ... (搜尋的分頁邏輯可仿照 handleButton 中的寫法)
        return interaction.editReply({ embeds: [embed] });
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
    // 【優化3】統一使用 deferUpdate 提升體驗
    await interaction.deferUpdate();
    try {
      const [prefix, type, identifierRaw, pageStr, action] = interaction.customId.split('_');
      if (prefix !== 'library') return;

      const identifier = decodeURIComponent(identifierRaw);
      let pageIndex = parseInt(pageStr, 10) || 0;

      if (type === 'folder-nav') {
        return await showFolderContents(interaction, identifier, 1);
      }
      
      if (type === 'folder') {
        if (action === 'next') pageIndex++;
        else if (action === 'prev') pageIndex--;
        
        const folderId = identifier === 'root' ? null : identifier;
        // 【修正2】將 0-based 索引轉換為 1-based 頁碼
        return await showFolderContents(interaction, folderId, pageIndex + 1);
      }

      // 【清理】移除了過時的 'list' type 邏輯
      
    } catch (error) {
      console.error('library handleButton error:', error);
      await interaction.editReply({ content: '❌ 操作失敗，請稍後再試', components: [] });
    }
  },
};