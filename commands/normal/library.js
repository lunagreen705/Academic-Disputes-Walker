//commands/normal/library.js
const {
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
  uploadBook,
  BOOKSPAGE,
} = require('../../utils/normal/libraryManager');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 快取機制
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

// 統一回應函式
async function safeInteractionReply(interaction, content, options = {}) {
  try {
    const replyOptions = { content, ...options, ephemeral: true };
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(replyOptions);
    } else {
      await interaction.editReply(replyOptions);
    }
  } catch (error) {
    // 避免在已有錯誤處理的情況下重複回應
  }
}

// 快取函式
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

// 核心顯示函式
async function showFolderContents(interaction, folderId, page = 1) {
  try {
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
      .setFooter({ text: '圖書館系統' });

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
    const foldersOnPage = pageItems.filter(item => item.type === 'folder');

    if (foldersOnPage.length > 0) {
      for (let i = 0; i < foldersOnPage.length && components.length < 4; i += 5) {
        const row = new ActionRowBuilder();
        const chunk = foldersOnPage.slice(i, i + 5);
        chunk.forEach(folderItem => {
          const safeFolderId = encodeURIComponent(folderItem.data.id).slice(0, 50);
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`library|folder-nav|${safeFolderId}|0|enter`)
              .setLabel(folderItem.data.name.length > 80 ? folderItem.data.name.slice(0, 77) + '...' : folderItem.data.name)
              .setStyle(ButtonStyle.Success)
              .setEmoji('📁')
          );
        });
        components.push(row);
      }
    }

    const controlRow = new ActionRowBuilder();
    if (folderId) {
      controlRow.addComponents(
        new ButtonBuilder()
          .setCustomId('library|folder-nav|root|0|enter')
          .setLabel('回到根目錄')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('↩️')
      );
    }
    if (totalItems > BOOKSPAGE) {
      const paginationRow = createPaginationRow('folder', encodeURIComponent(folderId ?? 'root'), pageIndex, maxPage);
      controlRow.addComponents(...paginationRow.components);
    }
    if (controlRow.components.length > 0 && components.length < 5) {
      components.push(controlRow);
    }

    await safeInteractionReply(interaction, null, { embeds: [embed], components });
  } catch (error) {
    console.error(`[ERROR] showFolderContents failed: ${error.message}, folderId: ${folderId}`);
    await safeInteractionReply(interaction, `❌ 無法顯示資料夾內容：${error.message}`, { embeds: [], components: [] });
  }
}

// 指令主體
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
    {
      name: 'upload',
      description: '上傳電子書到圖書館',
      type: 1,
      options: [
        {
          name: 'file',
          description: '要上傳的電子書檔案',
          type: 11, // ATTACHMENT
          required: true,
        },
      ],
    },
  ],

  async autocomplete(interaction) {
    if (interaction.options.getSubcommand() === 'list') {
      const focused = interaction.options.getFocused();
      try {
        const suggestions = await autocompleteCategory(focused);
        await interaction.respond(suggestions);
      } catch (error) {
        console.error(`[ERROR] Autocomplete failed: ${error.message}`);
      }
    }
  },

  async run(client, interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
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
            return safeInteractionReply(interaction, `❌ 找不到分類「${categoryName}」`);
          }
          await showFolderContents(interaction, folder.id, 1);
          break;
        }

        case 'search': {
          const keyword = interaction.options.getString('keyword');
          const results = await getCachedSearchResults(keyword);
          if (!results.length) {
            return safeInteractionReply(interaction, `🔍 沒有找到符合「${keyword}」的書籍`);
          }
          const maxPage = Math.ceil(results.length / BOOKSPAGE);
          const embed = createSearchResultEmbed(keyword, results, 0, maxPage, BOOKSPAGE);
          const components = maxPage > 1 ? [createPaginationRow('search', encodeURIComponent(keyword), 0, maxPage)] : [];
          return safeInteractionReply(interaction, null, { embeds: [embed], components });
        }

        case 'random': {
          const book = await getRandomBook();
          const embed = createRandomBookEmbed(book);
          return safeInteractionReply(interaction, null, { embeds: [embed] });
        }

        case 'stats': {
          const stat = await getLibraryStat();
          const embed = createStatEmbed(stat);
          return safeInteractionReply(interaction, null, { embeds: [embed] });
        }

        case 'upload': {
          const attachment = interaction.options.getAttachment('file');
          if (!attachment) {
            return safeInteractionReply(interaction, '❌ 請提供要上傳的檔案。');
          }

          // 允許的副檔名驗證
          const ext = attachment.name.split('.').pop().toLowerCase();
          const allowedExt = ['pdf', 'epub', 'mobi', 'azw3', 'txt', 'doc', 'docx', 'odt', 'rtf', 'html', 'md', 'xlsx', 'jpg'];
          if (!allowedExt.includes(ext)) {
            return safeInteractionReply(interaction, `❌ 不支援的檔案格式：.${ext}`);
          }

          try {
            const tempFilePath = path.join(os.tmpdir(), `${Date.now()}_${attachment.name}`);

            const response = await fetch(attachment.url);
            if (!response.ok) throw new Error('下載檔案失敗');

            const buffer = await response.buffer();
            fs.writeFileSync(tempFilePath, buffer);

            // 上傳到你指定的 LIBRARY_FOLDER_ID 資料夾
            const uploadedFile = await uploadBook(tempFilePath, attachment.name);

            fs.unlinkSync(tempFilePath);

            return safeInteractionReply(
              interaction,
              `✅ 成功上傳檔案：${uploadedFile.name}\n[點此檢視](${uploadedFile.webViewLink})`
            );
          } catch (error) {
            console.error(`[ERROR] Upload failed: ${error.message}`);
            return safeInteractionReply(interaction, `❌ 上傳失敗：${error.message}`);
          }
        }

        default:
          return safeInteractionReply(interaction, '❌ 未知的子指令。');
      }
    } catch (error) {
      console.error(`[ERROR] Command run failed: ${error.message}`);
      await safeInteractionReply(interaction, `❌ 執行指令時發生錯誤：${error.message}`, { embeds: [], components: [] });
    }
  },

  async handleButton(interaction) {
    try {
      if (!interaction.isButton()) {
        return safeInteractionReply(interaction, '❌ 無效的交互類型！');
      }
      if (Date.now() - interaction.message.createdTimestamp > 15 * 60 * 1000) {
        return safeInteractionReply(interaction, '❌ 此交互已超時，請重新執行 `/library browse` 指令！', { components: [] });
      }

      await interaction.deferUpdate();

      const parts = interaction.customId.split('|');
      if (parts.length !== 5 || parts[0] !== 'library') {
        return safeInteractionReply(interaction, '❌ 無效的按鈕操作！');
      }

      const [prefix, type, identifierRaw, pageStr, action] = parts;
      let identifier;
      try {
        identifier = decodeURIComponent(identifierRaw);
      } catch (err) {
        return safeInteractionReply(interaction, '❌ 無效的按鈕資料！');
      }
      let pageIndex = parseInt(pageStr, 10) || 0;

      if (type === 'folder-nav' && action === 'enter') {
        const targetFolderId = identifier === 'root' ? null : identifier;
        await showFolderContents(interaction, targetFolderId, 1);
        return;
      }

      if (type === 'search') {
        if (action === 'next') pageIndex++;
        else if (action === 'prev') pageIndex--;
        pageIndex = Math.max(0, pageIndex);

        const keyword = identifier;
        const results = await getCachedSearchResults(keyword);
        if (!results.length) {
          return safeInteractionReply(interaction, '🔍 搜尋結果已過期或不存在', { components: [] });
        }
        const maxPage = Math.ceil(results.length / BOOKSPAGE);
        pageIndex = Math.max(0, Math.min(pageIndex, maxPage - 1));
        const embed = createSearchResultEmbed(keyword, results, pageIndex, maxPage, BOOKSPAGE);
        const row = createPaginationRow('search', encodeURIComponent(keyword), pageIndex, maxPage);
        await safeInteractionReply(interaction, null, { embeds: [embed], components: [row] });
        return;
      }

      if (type === 'folder') {
        if (action === 'next') pageIndex++;
        else if (action === 'prev') pageIndex--;
        pageIndex = Math.max(0, pageIndex);

        const folderId = identifier === 'root' ? null : identifier;
        await showFolderContents(interaction, folderId, pageIndex + 1);
        return;
      }

      console.error(`[ERROR] Unknown button type: ${type}`);
      await safeInteractionReply(interaction, '❌ 未知的按鈕操作！', { embeds: [], components: [] });
    } catch (error) {
      console.error(`[ERROR] handleButton failed: ${error.message}, customId: ${interaction.customId}`);
      await safeInteractionReply(interaction, `❌ 操作時發生錯誤：${error.message}`, { embeds: [], components: [] });
    }
  },
};
