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
  BOOKSPAGE,
} = require('../../utils/normal/libraryManager');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
  // parentId null 表示根資料夾
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
          name: 'parent_id', // 新增選項：指定父資料夾ID來支援多層
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

      // 先取得指定父資料夾下的子資料夾
      const folders = await getCachedFolders(parentId);

      // 先嘗試在該父資料夾中找分類名稱對應的資料夾
      const folder = folders.find(f => f.name.toLowerCase() === categoryName.toLowerCase());

      if (!folder) {
        return interaction.reply({ content: `❌ 找不到分類「${categoryName}」`, ephemeral: true });
      }

      // 取得此分類資料夾下的書籍
      const books = await getCachedBooksInFolder(folder.id);

      if (books.length === 0) {
        return interaction.reply({ content: `📂 分類「${categoryName}」目前沒有書籍`, ephemeral: true });
      }

      const maxPage = Math.ceil(books.length / BOOKSPAGE);
      if (page > maxPage) page = maxPage;

      const pageIndex = page - 1;

      const embed = createPaginatedEmbed(categoryName, books, pageIndex);

      const row = createPaginationRow('list', folder.id, pageIndex, maxPage);

      return interaction.reply({ embeds: [embed], components: [row] });
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
        // 這邊你可以改成支援 parentId，方便支援子資料夾更多層
        const folders = await getCachedFolders(null); // 根資料夾快取
        // 直接用 id 找 folder（有需要可以改成支援多層快取）
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
    } catch (error) {
      console.error('library handleButton error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ 操作失敗，請稍後再試', ephemeral: true });
      }
    }
  },
};
