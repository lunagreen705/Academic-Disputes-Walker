const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
    listSubfolders,
    listBooksAtLevel,      // 【修正】使用正確的函式名稱
    searchBooks,
    getRandomBook,
    getLibraryStat,
    autocompleteCategory,
    BOOKSPAGE,
    LIBRARY_FOLDER_ID,
} = require('../../utils/normal/libraryManager');

// --- 指令端快取機制 (簡化後) ---
// 只快取使用者操作頻繁且 Manager 未快取的內容
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
    return lastFetched && (Date.now() - lastFetched) < cache.cacheTTL;
}

// 這些 getCached 函式維持不變，它們運作得很好
async function getCachedFolders(parentId = null) {
    const cacheKey = parentId || 'root';
    if (isCacheValid(cache.foldersLastFetched.get(cacheKey))) {
        return cache.folders.get(cacheKey);
    }
    const folders = await listSubfolders(parentId);
    cache.folders.set(cacheKey, folders);
    cache.foldersLastFetched.set(cacheKey, Date.now());
    return folders;
}

async function getCachedBooksInFolder(folderId) {
    const cacheKey = folderId || 'root';
    if (isCacheValid(cache.folderBooksLastFetched.get(cacheKey))) {
        return cache.folderBooks.get(cacheKey);
    }
    const books = await listBooksAtLevel(folderId); // 【修正】使用正確的函式
    cache.folderBooks.set(cacheKey, books);
    cache.folderBooksLastFetched.set(cacheKey, Date.now());
    return books;
}

async function getCachedSearchResults(keyword) {
    if (isCacheValid(cache.searchResultsLastFetched.get(keyword))) {
        return cache.searchResults.get(keyword);
    }
    const results = await searchBooks(keyword);
    cache.searchResults.set(keyword, results);
    cache.searchResultsLastFetched.set(keyword, Date.now());
    return results;
}

// --- Embed 與按鈕產生器 ---
// 將 Manager 中的 Embed 產生器移到這裡，讓職責更清晰
function createSearchResultEmbed(keyword, results, page = 0) {
    const start = page * BOOKSPAGE;
    const end = start + BOOKSPAGE;
    const pageResults = results.slice(start, end);

    const embed = new EmbedBuilder()
        .setTitle(`🔍 搜尋「${keyword}」的結果`)
        .setColor('#32CD32')
        .setTimestamp()
        .setFooter({ text: `第 ${page + 1} / ${Math.ceil(results.length / BOOKSPAGE)} 頁` });

    if (!pageResults.length) {
        embed.setDescription('沒有找到相關的書籍。');
    } else {
        const desc = pageResults.map(f => `📖 [${f.name}](${f.webViewLink}) | [下載](${f.downloadLink})`).join('\n');
        embed.setDescription(desc);
    }
    return embed;
}

function createStatEmbed(stat) {
    const embed = new EmbedBuilder()
        .setTitle('📊 圖書館統計資訊')
        .setColor('#9370DB')
        .setTimestamp()
        .setFooter({ text: '圖書館' })
        .addFields(
            { name: '總分類數', value: `${stat.totalCategories}`, inline: true },
            { name: '總藏書量', value: `${stat.totalBooks}`, inline: true }
        );

    const breakdown = Object.entries(stat.breakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `📁 ${k}：${v} 本`)
        .join('\n');

    embed.addFields({ name: '各分類藏書', value: breakdown || '無資料' });
    return embed;
}

function createRandomBookEmbed(book) {
    const embed = new EmbedBuilder()
        .setTitle('🎲 隨機推薦書籍')
        .setColor('#FF69B4')
        .setTimestamp()
        .setFooter({ text: '圖書館' });

    if (!book) {
        embed.setDescription('圖書館目前沒有任何書籍可以推薦。');
    } else {
        embed.setDescription(`📖 [${book.name}](${book.webViewLink}) | [下載](${book.downloadLink})`);
    }
    return embed;
}

// --- 核心顯示函式 ---
async function showFolderContents(interaction, folderId, page = 1) {
    // ... 此函式本身邏輯正確，無需修改 ...
    // (此處省略函式內容，與你提供的一致)
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
    
    const currentFolder = folderId ? (await getCachedFolders(null)).find(f => f.id === folderId) : null;
    const title = currentFolder ? `📁 分類：${currentFolder.name}` : '📚 圖書館根目錄';

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`共 ${subfolders.length} 個子資料夾，${books.length} 本書籍。\n目前顯示第 ${page} / ${maxPage} 頁`)
        .setColor('#5865F2')
        .setFooter({ text: `資料夾ID: ${folderId || 'root'}` });

    if (pageItems.length === 0) {
        embed.addFields({ name: '空空如也', value: '這個資料夾中沒有任何項目。' });
    } else {
        pageItems.forEach(item => {
            if (item.type === 'folder') {
                embed.addFields({
                    name: `📁 ${item.data.name}`,
                    value: `點擊下方同名按鈕進入此資料夾。`,
                    inline: false,
                });
            } else if (item.type === 'book') {
                const bookData = item.data;
                const downloadLink = bookData.webContentLink || bookData.webViewLink;
                embed.addFields({
                    name: `📖 ${bookData.name}`,
                    value: `[在瀏覽器中開啟](${bookData.webViewLink}) | [下載](${downloadLink})`,
                    inline: false,
                });
            }
        });
    }

    const components = [];
    const folderButtons = new ActionRowBuilder();
    const visibleFolders = pageItems.filter(i => i.type === 'folder').map(i => i.data);

    if (visibleFolders.length > 0) {
        visibleFolders.slice(0, 5).forEach(folder => {
            folderButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`library_nav_${folder.id}_1`) // 簡化ID: type_id_page
                    .setLabel(folder.name.length > 20 ? folder.name.slice(0, 17) + '...' : folder.name)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📁')
            );
        });
        components.push(folderButtons);
    }
    
    const navRow = new ActionRowBuilder();
    // 返回按鈕
    if (folderId) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`library_nav_${'root'}_1`)
                .setLabel('返回根目錄')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('↩️')
        );
    }
    // 分頁按鈕
    if (maxPage > 1) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`library_page_${folderId || 'root'}_${page - 1}`)
                .setLabel('上一頁')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page <= 1),
            new ButtonBuilder()
                .setCustomId(`library_page_${folderId || 'root'}_${page + 1}`)
                .setLabel('下一頁')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page >= maxPage)
        );
    }

    if (navRow.components.length > 0) {
        components.push(navRow);
    }
    
    const replyOptions = { embeds: [embed], components };
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply(replyOptions);
    } else {
        await interaction.reply(replyOptions);
    }
}


// --- 指令主體 ---
module.exports = {
    name: 'library',
    description: '圖書館相關功能指令',
    // ... options 與你提供的一致 ...
    options: [ /* ... */ ],

    async autocomplete(interaction) {
        // ... 此函式本身邏輯正確，無需修改 ...
    },

    async run(client, interaction) {
        try {
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
                    if (!results || results.length === 0) {
                        return interaction.editReply({ content: `🔍 沒有找到符合「${keyword}」的書籍` });
                    }

                    const page = 0;
                    const embed = createSearchResultEmbed(keyword, results, page);
                    const totalPages = Math.ceil(results.length / BOOKSPAGE);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`library_search_${encodeURIComponent(keyword)}_${page}_prev`)
                            .setLabel('上一頁')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`library_search_${encodeURIComponent(keyword)}_${page}_next`)
                            .setLabel('下一頁')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(totalPages <= 1)
                    );

                    await interaction.editReply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
                    break;
                }

                case 'random': {
                    const book = await getRandomBook(); // 直接呼叫，因為 manager 已快取
                    const embed = createRandomBookEmbed(book);
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'stats': {
                    const stat = await getLibraryStat(); // 直接呼叫，因為 manager 已快取
                    const embed = createStatEmbed(stat);
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
            }
        } catch (error) {
            console.error('[Library Command] Unhandled error in run:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: '❌ 指令執行時發生未預期的錯誤。', components: [] });
            }
        }
    },

    async handleButton(interaction) {
        try {
            await interaction.deferUpdate();
            const [prefix, type, ...rest] = interaction.customId.split('_');
            if (prefix !== 'library') return;

            if (type === 'nav') {
                const [folderId, pageStr] = rest;
                await showFolderContents(interaction, folderId === 'root' ? null : folderId, parseInt(pageStr, 10));
            } else if (type === 'page') {
                const [folderId, pageStr] = rest;
                await showFolderContents(interaction, folderId === 'root' ? null : folderId, parseInt(pageStr, 10));
            } else if (type === 'search') {
                const keyword = decodeURIComponent(rest[0]);
                let pageIndex = parseInt(rest[1], 10);
                const action = rest[2];

                if (action === 'next') pageIndex++;
                else if (action === 'prev') pageIndex--;

                const results = await getCachedSearchResults(keyword);
                if (!results) {
                    return interaction.editReply({ content: '❌ 搜尋結果已過期，請重新搜尋。', components: [] });
                }

                const embed = createSearchResultEmbed(keyword, results, pageIndex);
                const totalPages = Math.ceil(results.length / BOOKSPAGE);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`library_search_${encodeURIComponent(keyword)}_${pageIndex}_prev`)
                        .setLabel('上一頁')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pageIndex <= 0),
                    new ButtonBuilder()
                        .setCustomId(`library_search_${encodeURIComponent(keyword)}_${pageIndex}_next`)
                        .setLabel('下一頁')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pageIndex >= totalPages - 1)
                );
                await interaction.editReply({ embeds: [embed], components: [row] });
            }
        } catch (error) {
            console.error('[Library Button] Unhandled error:', error);
            await interaction.editReply({ content: '❌ 操作失敗，請稍後再試。', components: [] });
        }
    },
};