const {
  listSubfolders,
  listBooksInFolder,
  searchBooks,
  getRandomBook,
  getLibraryStat,
  createCategoryListEmbed,
  createPaginatedEmbed,
  createSearchResultEmbed,
  createStatEmbed,
  createRandomBookEmbed,
  autocompleteCategory,
  showFolderContents,
  BOOKSPAGE,
} = require('../../utils/normal/libraryManager');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const cache = {
  folders: null,
  foldersLastFetched: 0,

  folderBooks: new Map(), // key: folderId, value: books[]
  folderBooksLastFetched: new Map(), // key: folderId, value: timestamp

  searchResults: new Map(), // key: keyword, value: results[]
  searchResultsLastFetched: new Map(), // key: keyword, value: timestamp

  cacheTTL: 1000 * 60 * 5, // 5分鐘
};

function isCacheValid(lastFetched) {
  return (Date.now() - lastFetched) < cache.cacheTTL;
}

async function getCachedFolders(parentId = null) {
  if (cache.folders && isCacheValid(cache.foldersLastFetched) && !parentId) return cache.folders;
  const folders = await listSubfolders(parentId);
  if (!parentId) {
    cache.folders = folders;
    cache.foldersLastFetched = Date.now();
  }
  return folders;
}

async function getCachedBooksInFolder(folderId) {
  if (
    cache.folderBooks.has(folderId) &&
    isCacheValid(cache.folderBooksLastFetched.get(folderId) ?? 0)
  ) {
    return cache.folderBooks.get(folderId);
  }
  const books = await listBooksInFolder(folderId);
  cache.folderBooks.set(folderId, books);
  cache.folderBooksLastFetched.set(folderId, Date.now());
  return books;
}

async function getCachedSearchResults(keyword) {
  if (
    cache.searchResults.has(keyword) &&
    isCacheValid(cache.searchResultsLastFetched.get(keyword) ?? 0)
  ) {
    return cache.searchResults.get(keyword);
  }
  const results = await searchBooks(keyword);
  cache.searchResults.set(keyword, results);
  cache.searchResultsLastFetched.set(keyword, Date.now());
  return results;
}

function createPaginationRow(type, identifier, page, maxPage) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`library_${type}_${identifier}_${page}_prev`)
      .setLabel('上一頁')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`library_${type}_${identifier}_${page}_next`)
      .setLabel('下一頁')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= maxPage - 1),
  );
}

// 新增：顯示資料夾內容（子資料夾 + 書籍）
async function showFolderContents(interaction, folderId, page = 1) {
  const subfolders = await getCachedFolders(folderId);
  const books = await getCachedBooksInFolder(folderId);

  const totalItems = subfolders.length + books.length;
  const maxPage = Math.max(1, Math.ceil(totalItems / BOOKSPAGE));
  if (page > maxPage) page = maxPage;
  if (page < 1) page = 1;
  const pageIndex = page - 1;

  // 合併子資料夾與書籍，資料夾優先
  const combinedItems = [
    ...subfolders.map(f => ({ type: 'folder', data: f })),
    ...books.map(b => ({ type: 'book', data: b })),
  ];

  const pageItems = combinedItems.slice(pageIndex * BOOKSPAGE, (pageIndex + 1) * BOOKSPAGE);

  const embed = new EmbedBuilder()
    .setTitle(folderId ? `資料夾內容（ID: ${folderId}）` : '根目錄')
    .setDescription(`共 ${subfolders.length} 個子資料夾，${books.length} 本書籍，顯示第 ${page} 頁 / 共 ${maxPage} 頁`)
    .setColor('#5865F2');

  for (const item of pageItems) {
    if (item.type === 'folder') {
      embed.addFields({
        name: `📁 資料夾：${item.data.name}`,
        value: `ID: ${item.data.id}`,
        inline: false,
      });
    } else if (item.type === 'book') {
      embed.addFields({
        name: `📖 書籍：${item.data.title}`,
        value: `作者：${item.data.author || '未知'}`,
        inline: false,
      });
    }
  }

  const row = createPaginationRow('folder', encodeURIComponent(folderId ?? 'root'), pageIndex, maxPage);

  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row] });
  }
}

module.exports = {
  name: 'library',
  description: '圖書館相關功能指令',
  options: [
    { name: 'categories', description: '列出所有分類', type: 1 },
    {
      name: 'list',
      description: '列出指定分類或子資料夾書籍',
      type: 1,
      options: [
        {
          name: 'category',
          description: '分類名稱',
          type: 3,
          required: true,
          autocomplete: true,
        },
        {
          name: 'page',
          description: '頁碼，從1開始',
          type: 4,
          required: false,
        },
        {
          name: 'parent_id',
          description: '父資料夾ID（用於多層瀏覽）',
          type: 3,
          required: false,
        },
      ],
    },
    {
      name: 'search',
      description: '搜尋書籍',
      type: 1,
      options: [
        {
          name: 'keyword',
          description: '關鍵字',
          type: 3,
          required: true,
        },
        {
          name: 'page',
          description: '頁碼，從1開始',
          type: 4,
          required: false,
        },
      ],
    },
    { name: 'random', description: '隨機推薦書籍', type: 1 },
    { name: 'stats', description: '圖書館統計資訊', type: 1 },
  ],

  async autocomplete(interaction) {
    if (interaction.options.getSubcommand() === 'list') {
      const focused = interaction.options.getFocused();
      const suggestions = await autocompleteCategory(focused);
      await interaction.respond(suggestions);
    }
  },

  async run(client, interaction, lang) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'categories') {
      const folders = await getCachedFolders();
      const embed = createCategoryListEmbed(folders);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'list') {
      const categoryName = interaction.options.getString('category');
      let page = interaction.options.getInteger('page') || 1;
      page = page < 1 ? 1 : page;

      const parentId = interaction.options.getString('parent_id') || null;

      // 找該父資料夾下的所有子資料夾
      const folders = await getCachedFolders(parentId);

      // 找名稱符合的子資料夾
      const folder = folders.find(f => f.name.toLowerCase() === categoryName.toLowerCase());
      if (!folder) {
        return interaction.reply({ content: `❌ 找不到分類「${categoryName}」`, ephemeral: true });
      }

      // 顯示該資料夾內容（多層資料夾＋書籍）
      return await showFolderContents(interaction, folder.id, page);
    }

    if (subcommand === 'search') {
      const keywordRaw = interaction.options.getString('keyword');
      const keyword = encodeURIComponent(keywordRaw);

      let page = interaction.options.getInteger('page') || 1;
      page = page < 1 ? 1 : page;

      const results = await getCachedSearchResults(keywordRaw);
      if (results.length === 0) {
        return interaction.reply({ content: `🔍 沒有找到符合「${keywordRaw}」的書籍`, ephemeral: true });
      }

      const maxPage = Math.ceil(results.length / 10);
      if (page > maxPage) page = maxPage;

      const pageIndex = page - 1;

      const embed = createSearchResultEmbed(keywordRaw, results, pageIndex);

      const row = createPaginationRow('search', keyword, pageIndex, maxPage);

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (subcommand === 'random') {
      const book = await getRandomBook();
      const embed = createRandomBookEmbed(book);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'stats') {
      const stat = await getLibraryStat();
      const embed = createStatEmbed(stat);
      return interaction.reply({ embeds: [embed] });
    }

    return interaction.reply({ content: '❌ 不支援的子指令', ephemeral: true });
  },

  async handleButton(interaction) {
    try {
      const [prefix, type, identifierRaw, pageStr, direction] = interaction.customId.split('_');
      if (prefix !== 'library') return;

      let page = parseInt(pageStr, 10);
      if (isNaN(page)) page = 0;

      const identifier = decodeURIComponent(identifierRaw);

      if (direction === 'next') page++;
      else if (direction === 'prev') page--;

      page = page < 0 ? 0 : page;

      if (type === 'list') {
        // 這裡仍維持用 root 資料夾快取，不支援多層資料夾
        const folders = await getCachedFolders(null);
        const folder = folders.find(f => f.id === identifier);
        if (!folder) return interaction.reply({ content: '❌ 找不到該分類', ephemeral: true });

        const books = await getCachedBooksInFolder(identifier);
        if (books.length === 0) return interaction.reply({ content: '📂 此分類沒有書籍', ephemeral: true });

        const maxPage = Math.ceil(books.length / BOOKSPAGE);
        page = page >= maxPage ? maxPage - 1 : page;

        const embed = createPaginatedEmbed(folder.name, books, page);
        const row = createPaginationRow('list', identifier, page, maxPage);

        return interaction.update({ embeds: [embed], components: [row] });
      }

      if (type === 'search') {
        const results = await getCachedSearchResults(identifier);
        if (results.length === 0) return interaction.reply({ content: '🔍 沒有找到相關書籍', ephemeral: true });

        const maxPage = Math.ceil(results.length / 10);
        page = page >= maxPage ? maxPage - 1 : page;

        const embed = createSearchResultEmbed(identifier, results, page);
        const row = createPaginationRow('search', encodeURIComponent(identifier), page, maxPage);

        return interaction.update({ embeds: [embed], components: [row] });
      }

      if (type === 'folder') {
        // 多層資料夾分頁支援
        const folderId = identifier === 'root' ? null : identifier;
        return showFolderContents(interaction, folderId, page);
      }
    } catch (error) {
      console.error('library handleButton error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ 操作失敗，請稍後再試', ephemeral: true });
      }
    }
  },
};
