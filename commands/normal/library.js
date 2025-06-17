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
  createCategoryContentEmbed, // 新增：顯示資料夾內容
  BOOKSPAGE,
} = require('../../utils/normal/libraryManager');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const cache = {
  folders: null,
  folderBooks: new Map(),
  searchResults: new Map(),
  cacheTTL: 1000 * 60 * 5,
  lastFetched: 0,
};

function isCacheValid() {
  return Date.now() - cache.lastFetched < cache.cacheTTL;
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

      const components = folders.map((folder) =>
        new ButtonBuilder()
          .setCustomId(`library_category_click_${folder.id}`)
          .setLabel(folder.name)
          .setStyle(ButtonStyle.Secondary)
      );

      const row = new ActionRowBuilder().addComponents(components.slice(0, 5));
      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // 其他 subcommand（list、search、random、stats）保持原樣
    // ...（此處省略已存在邏輯）
  },

  async handleButton(interaction) {
    try {
      const [prefix, type, click, folderId] = interaction.customId.split('_');
      if (prefix !== 'library' || type !== 'category' || click !== 'click') return;

      const folders = await getCachedFolders();
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) {
        return interaction.reply({ content: '❌ 找不到該分類', ephemeral: true });
      }

      const subfolders = folders.filter((f) => f.parentId === folderId);
      const books = await getCachedBooksInFolder(folderId);
      const embed = createCategoryContentEmbed(folder.name, subfolders, books);

      const buttons = subfolders.map((f) =>
        new ButtonBuilder()
          .setCustomId(`library_category_click_${f.id}`)
          .setLabel(f.name)
          .setStyle(ButtonStyle.Secondary)
      );

      const row = new ActionRowBuilder().addComponents(buttons.slice(0, 5));

      return interaction.reply({ embeds: [embed], components: buttons.length > 0 ? [row] : [] });
    } catch (error) {
      console.error('library handleButton error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ 操作失敗，請稍後再試', ephemeral: true });
      }
    }
  },
};
