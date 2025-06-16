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

// 簡易快取物件 (可視需求換成更專業快取)
const cache = {
  folders: null,
  folderBooks: new Map(), // key: folderId, value: books[]
  searchResults: new Map(), // key: keyword, value: results[]
  cacheTTL: 1000 * 60 * 5, // 5分鐘
  lastFetched: 0,
};

function isCacheValid() {
  return (Date.now() - cache.lastFetched) < cache.cacheTTL;
}

async function getCachedFolders() {
  if (cache.folders && isCacheValid()) return cache.folders;
  const folders = await listSubfolders();
  cache.folders = folders;
  cache.lastFetched = Date.now();
  return folders;
}

async function getCachedBooksInFolder(folderId) {
  if (cache.folderBooks.has(folderId) && isCacheValid()) {
    return cache.folderBooks.get(folderId);
  }
  const books = await listBooksInFolder(folderId);
  cache.folderBooks.set(folderId, books);
  cache.lastFetched = Date.now();
  return books;
}

async function getCachedSearchResults(keyword) {
  if (cache.searchResults.has(keyword) && isCacheValid()) {
    return cache.searchResults.get(keyword);
  }
  const results = await searchBooks(keyword);
  cache.searchResults.set(keyword, results);
  cache.lastFetched = Date.now();
  return results;
}

module.exports = {
  name: 'library',
  description: '圖書館相關功能指令',
  options: [
    { name: 'categories', description: '列出所有分類', type: 1 },
    {
      name: 'list',
      description: '列出指定分類書籍',
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

      const folders = await getCachedFolders();
      const folder = folders.find(f => f.name.toLowerCase() === categoryName.toLowerCase());

      if (!folder) {
        return interaction.reply({ content: `❌ 找不到分類「${categoryName}」`, ephemeral: true });
      }

      const books = await getCachedBooksInFolder(folder.id);
      if (books.length === 0) {
        return interaction.reply({ content: `📂 分類「${categoryName}」目前沒有書籍`, ephemeral: true });
      }

      const maxPage = Math.ceil(books.length / BOOKSPAGE);
      if (page > maxPage) page = maxPage;

      // 內部頁碼 0基底
      const pageIndex = page - 1;

      const embed = createPaginatedEmbed(categoryName, books, pageIndex);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`library_list_${folder.id}_${pageIndex}_prev`)
          .setLabel('上一頁')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex <= 0),
        new ButtonBuilder()
          .setCustomId(`library_list_${folder.id}_${pageIndex}_next`)
          .setLabel('下一頁')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex >= maxPage - 1),
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (subcommand === 'search') {
      const keywordRaw = interaction.options.getString('keyword');
      // 對 customId 編碼，避免解析錯亂
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

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`library_search_${keyword}_${pageIndex}_prev`)
          .setLabel('上一頁')
          .setStyle(ButtonStyle.Success)
          .setDisabled(pageIndex <= 0),
        new ButtonBuilder()
          .setCustomId(`library_search_${keyword}_${pageIndex}_next`)
          .setLabel('下一頁')
          .setStyle(ButtonStyle.Success)
          .setDisabled(pageIndex >= maxPage - 1),
      );

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

      // 解碼搜尋關鍵字（identifier可能是encodeURIComponent後的字串）
      const identifier = decodeURIComponent(identifierRaw);

      if (direction === 'next') page++;
      else if (direction === 'prev') page--;

      // 分頁頁碼限制下界
      page = page < 0 ? 0 : page;

      if (type === 'list') {
        const folders = await getCachedFolders();
        const folder = folders.find(f => f.id === identifier);
        if (!folder) return interaction.reply({ content: '❌ 找不到該分類', ephemeral: true });

        const books = await getCachedBooksInFolder(identifier);
        if (books.length === 0) return interaction.reply({ content: '📂 此分類沒有書籍', ephemeral: true });

        const maxPage = Math.ceil(books.length / BOOKSPAGE);
        page = page >= maxPage ? maxPage - 1 : page;

        const embed = createPaginatedEmbed(folder.name, books, page);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`library_list_${identifier}_${page}_prev`)
            .setLabel('上一頁')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page <= 0),
          new ButtonBuilder()
            .setCustomId(`library_list_${identifier}_${page}_next`)
            .setLabel('下一頁')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= maxPage - 1),
        );

        return interaction.update({ embeds: [embed], components: [row] });
      }

      if (type === 'search') {
        const results = await getCachedSearchResults(identifier);
        if (results.length === 0) return interaction.reply({ content: '🔍 沒有找到相關書籍', ephemeral: true });

        const maxPage = Math.ceil(results.length / 10);
        page = page >= maxPage ? maxPage - 1 : page;

        const embed = createSearchResultEmbed(identifier, results, page);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`library_search_${encodeURIComponent(identifier)}_${page}_prev`)
            .setLabel('上一頁')
            .setStyle(ButtonStyle.Success)
            .setDisabled(page <= 0),
          new ButtonBuilder()
            .setCustomId(`library_search_${encodeURIComponent(identifier)}_${page}_next`)
            .setLabel('下一頁')
            .setStyle(ButtonStyle.Success)
            .setDisabled(page >= maxPage - 1),
        );

        return interaction.update({ embeds: [embed], components: [row] });
      }
    } catch (error) {
      // 錯誤處理，防止DiscordAPIError崩潰
      console.error('library handleButton error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ 操作失敗，請稍後再試', ephemeral: true });
      }
    }
  },
};
