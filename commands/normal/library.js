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

module.exports = {
  name: 'library',
  description: '圖書館相關功能指令',
  options: [
    {
      name: 'categories',
      description: '列出所有分類',
      type: 1, // subcommand
    },
    {
      name: 'list',
      description: '列出指定分類書籍',
      type: 1,
      options: [
        {
          name: 'category',
          description: '分類名稱',
          type: 3, // string
          required: true,
          autocomplete: true,
        },
        {
          name: 'page',
          description: '頁碼，從1開始',
          type: 4, // integer
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
    {
      name: 'random',
      description: '隨機推薦書籍',
      type: 1,
    },
    {
      name: 'stats',
      description: '圖書館統計資訊',
      type: 1,
    },
  ],

  // 🔄 自動補全分類
  async autocomplete(interaction) {
    if (interaction.options.getSubcommand() === 'list') {
      const focused = interaction.options.getFocused();
      const suggestions = await autocompleteCategory(focused);
      await interaction.respond(suggestions);
    }
  },

  // 🧠 核心指令執行邏輯（主體功能）
  async run(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'categories') {
      const folders = await listSubfolders();
      const embed = createCategoryListEmbed(folders);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'list') {
      const categoryName = interaction.options.getString('category');
      let page = interaction.options.getInteger('page') || 1;
      page = page < 1 ? 1 : page;

      const folders = await listSubfolders();
      const folder = folders.find(f => f.name.toLowerCase() === categoryName.toLowerCase());

      if (!folder) {
        return interaction.reply({ content: `❌ 找不到分類「${categoryName}」`, ephemeral: true });
      }

      const books = await listBooksInFolder(folder.id);
      if (books.length === 0) {
        return interaction.reply({ content: `📂 分類「${categoryName}」目前沒有書籍`, ephemeral: true });
      }

      const maxPage = Math.ceil(books.length / BOOKSPAGE);
      if (page > maxPage) page = maxPage;

      const embed = createPaginatedEmbed(categoryName, books, page - 1);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`library_list_${folder.id}_${page - 1}_prev`)
          .setLabel('上一頁')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId(`library_list_${folder.id}_${page - 1}_next`)
          .setLabel('下一頁')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page >= maxPage),
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (subcommand === 'search') {
      const keyword = interaction.options.getString('keyword');
      let page = interaction.options.getInteger('page') || 1;
      page = page < 1 ? 1 : page;

      const results = await searchBooks(keyword);
      if (results.length === 0) {
        return interaction.reply({ content: `🔍 沒有找到符合「${keyword}」的書籍`, ephemeral: true });
      }

      const maxPage = Math.ceil(results.length / 10);
      if (page > maxPage) page = maxPage;

      const embed = createSearchResultEmbed(keyword, results, page - 1);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`library_search_${keyword}_${page - 1}_prev`)
          .setLabel('上一頁')
          .setStyle(ButtonStyle.Success)
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId(`library_search_${keyword}_${page - 1}_next`)
          .setLabel('下一頁')
          .setStyle(ButtonStyle.Success)
          .setDisabled(page >= maxPage),
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

  // 🧩 處理按鈕交互
  async handleButton(interaction) {
    const [prefix, type, identifier, pageStr, direction] = interaction.customId.split('_');
    if (prefix !== 'library') return;

    let page = parseInt(pageStr);
    if (direction === 'next') page++;
    else if (direction === 'prev') page--;

    if (type === 'list') {
      const folders = await listSubfolders();
      const folder = folders.find(f => f.id === identifier);
      if (!folder) return interaction.reply({ content: '❌ 找不到該分類', ephemeral: true });

      const books = await listBooksInFolder(identifier);
      if (books.length === 0) return interaction.reply({ content: '📂 此分類沒有書籍', ephemeral: true });

      const maxPage = Math.ceil(books.length / BOOKSPAGE);
      page = Math.max(0, Math.min(page, maxPage - 1));

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
      const keyword = identifier;

      const results = await searchBooks(keyword);
      if (results.length === 0) return interaction.reply({ content: '🔍 沒有找到相關書籍', ephemeral: true });

      const maxPage = Math.ceil(results.length / 10);
      page = Math.max(0, Math.min(page, maxPage - 1));

      const embed = createSearchResultEmbed(keyword, results, page);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`library_search_${keyword}_${page}_prev`)
          .setLabel('上一頁')
          .setStyle(ButtonStyle.Success)
          .setDisabled(page <= 0),
        new ButtonBuilder()
          .setCustomId(`library_search_${keyword}_${page}_next`)
          .setLabel('下一頁')
          .setStyle(ButtonStyle.Success)
          .setDisabled(page >= maxPage - 1),
      );

      return interaction.update({ embeds: [embed], components: [row] });
    }
  },
};
