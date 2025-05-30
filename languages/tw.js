module.exports = {
    footer: "測試中",
    ping: {
      description: "檢查機器人延遲",
      response: "正在測試延遲...",
      embed: {
        title: "機器人延遲",
        responseTime: "- 機器人響應時間：**{latency}毫秒**",
        websocketPing: "- WebSocket延遲：**{ping}毫秒**",
        uptime: "- 運行時間：**{uptime}**",
        footer: "測試中"
      }
    },
    addsong: {
      embed: {
          playlistNotFound: "未找到播放列表",
          playlistNotFoundDescription: "- 未找到播放列表。",
          accessDenied: "訪問被拒絕",
          accessDeniedDescription: "- 您沒有權限向此播放列表添加歌曲。",
          songAdded: "已添加歌曲",
          songAddedDescription: "- 歌曲 **{songInput}** 已添加到播放列表 **{playlistName}**。",
          error: "錯誤",
          errorDescription: "- 添加歌曲時發生錯誤。"
      }
    },
    allplaylists: {
      embed: {
          noPlaylistsFound: "未找到播放列表",
          noPlaylistsFoundDescription: "- 目前沒有可用的公共播放列表。",
          createdBy: "創建者：{userId}",
          serverName: "服務器：{serverName}",
          songs: "歌曲數：**{songCount}**",
          publicPlaylistsTitle: "公共播放列表（第 {currentPage}/{totalPages} 頁）",
          error: "錯誤",
          errorDescription: "- 獲取播放列表時發生錯誤。"
      }
    },
    autoplay: {
      embed: {
          autoplayUpdated: "自動播放已更新",
          autoplayStatus: "- 此服務器的自動播放已被**{status}**。",
          enabled: "啟用",
          disabled: "禁用",
          error: "錯誤",
          errorDescription: "- 更新自動播放時發生錯誤。"
      },
      commandDescription: "啟用或禁用自動播放"
    },
    createplaylist: {
      embed: {
          playlistExists: "播放列表已存在",
          playlistExistsDescription: "- 已存在同名播放列表。",
          playlistCreated: "播放列表已創建",
          playlistCreatedDescription: "- 播放列表 **{playlistName}** 已創建。\n- 可見性：**{visibility}**。",
          private: "私密",
          public: "公開",
          error: "錯誤",
          errorDescription: "- 創建播放列表時發生錯誤。"
      },
      commandDescriptionName: "輸入播放列表名稱",
      commandDescriptionPrivate: "將播放列表設為私密（僅您可見）"
    },
    deleteplaylist: {
      embed: {
          playlistNotFound: "未找到播放列表",
          playlistNotFoundDescription: "- 未找到播放列表。",
          accessDenied: "訪問被拒絕",
          accessDeniedDescription: "- 您沒有權限刪除此播放列表。",
          playlistDeleted: "播放列表已刪除",
          playlistDeletedDescription: "- 播放列表 **{playlistName}** 已被刪除。",
          error: "錯誤",
          errorDescription: "- 刪除播放列表時發生錯誤。"
      },
      commandDescriptionName: "輸入播放列表名稱"
    },
    deletesong: {
      embed: {
          playlistNotFound: "未找到播放列表",
          playlistNotFoundDescription: "- 未找到播放列表。",
          songDeleted: "歌曲已刪除",
          songDeletedDescription: "- 歌曲 **{songName}** 已從播放列表 **{playlistName}** 中刪除。",
          error: "錯誤",
          errorDescription: "- 刪除歌曲時發生錯誤。"
      },
      commandDescriptionPlaylist: "輸入播放列表名稱",
      commandDescriptionSong: "輸入歌曲名稱"
    },
    filters: {
      embed: {
          error: "錯誤",
          noPlayer: "- 未找到活動播放器。請先播放歌曲。",
          wrongChannel: "- 您需要與機器人在同一語音頻道才能使用此命令。",
          filtersCleared: "所有過濾器已清除。",
          invalidFilter: "選擇的過濾器無效。",
          filterApplied: "過濾器 **{filter}** 已應用。",
          errorProcessing: "- 處理您的請求時發生錯誤。"
      },
      commandDescription: "選擇要應用的過濾器"
    },
    help: {
      embed: {
          title: "📜 {botName} 幫助菜單",
          author: "幫助",
          description: `
          **歡迎使用 {botName}！**

          > 您在 Discord 上的終極音樂伴侶。
          > 以下是機器人的詳細信息：
                  
          **📂 命令數：** {totalCommands}
          **🌐 服務器數：** {totalServers}
          **👥 用戶數：** {totalUsers}
          **⏳ 運行時間：** {uptimeString}
          **📡 延遲：** {ping}毫秒
          `,
          availableCommands: "可用命令",
          noDescription: "暫無描述。",
          noCommands: "未找到命令。",
          error: "❌ 獲取幫助菜單時發生錯誤。"
      },
      commandDescription: "獲取機器人信息"
    },
    myplaylists: {
      embed: {
          noPlaylistsFound: "未找到播放列表",
          noPlaylistsFoundDescription: "- 您還沒有創建任何播放列表。",
          yourPlaylistsTitle: "您的播放列表（第 {currentPage}/{totalPages} 頁）",
          visibility: "可見性",
          private: "私密",
          public: "公開",
          server: "服務器",
          songs: "歌曲",
          error: "錯誤",
          errorDescription: "- 獲取您的播放列表時發生錯誤。"
      }
    },
    nowPlaying: {
      embed: {
          error: "錯誤",
          noSong: "- 當前沒有正在播放的歌曲。",
          nowPlaying: "正在播放！",
          errorDescription: "- 處理您的請求時發生錯誤。"
      }
    },
    pause: {
      embed: {
          error: "錯誤",
          noActivePlayer: "- 未找到活動播放器。",
          paused: "已暫停！",
          pausedDescription: "**- 播放已暫停！**",
          errorDescription: "- 處理您的請求時發生錯誤。"
      }
    },
    play: {
      embed: {
          error: "錯誤",
          noVoiceChannel: "- 您需要在語音頻道中才能使用此命令。",
          noLavalinkNodes: "- 沒有可用的 Lavalink 節點來處理請求。",
          noResults: "- 未找到結果。",
          requestUpdated: "請求已更新！",
          successProcessed: "- 您的請求已成功處理。\n- 請使用按鈕控制播放",
          errorProcessing: "- 處理您的請求時發生錯誤。"
      },
      commandDescription: "輸入歌曲名稱/鏈接或播放列表"
    },
    playCustomPlaylist: {
      embed: {
          error: "錯誤",
          noVoiceChannel: "- 您需要在語音頻道中才能使用此命令。",
          playlistNotFound: "- 未找到播放列表。",
          accessDenied: "訪問被拒絕",
          noPermission: "- 您沒有權限播放此私密播放列表。",
          emptyPlaylist: "- 播放列表為空。",
          playingPlaylist: "正在播放列表！",
          playlistPlaying: "- 播放列表 **{playlistName}** 正在播放。\n- 請使用按鈕控制播放",
          errorResolvingSong: "- 解析歌曲時出錯。",
          errorPlayingPlaylist: "- 播放列表時發生錯誤。"
      },
      commandDescription: "輸入播放列表名稱"
    },
    queue: {
      embed: {
          queueEmpty: "隊列為空",
          queueEmptyDescription: "- 當前隊列為空。使用 `/play` 命令添加歌曲。",
          currentQueue: "當前隊列",
          noMoreSongs: "- 隊列中沒有更多歌曲。",
          error: "錯誤",
          errorDescription: "- 獲取隊列時發生錯誤。"
      }
    },
    remove: {
      embed: {
          queueEmpty: "隊列為空",
          queueEmptyDescription: "- 當前隊列為空。使用 `/play` 命令添加歌曲。",
          invalidPosition: "錯誤",
          invalidPositionDescription: "- 無效的位置。請輸入 1 到 {queueLength} 之間的數字。",
          songRemoved: "歌曲已移除",
          songRemovedDescription: "- 已從隊列中移除歌曲：**{songTitle}**",
          error: "錯誤",
          errorDescription: "- 從隊列中移除歌曲時發生錯誤。"
      }
    },
    resume: {
      embed: {
          noActivePlayer: "錯誤",
          noActivePlayerDescription: "- 未找到活動播放器。",
          resumed: "已恢覆！",
          resumedDescription: "**- 播放已恢覆！**",
          error: "錯誤",
          errorDescription: "- 處理您的請求時發生錯誤。"
      }
    },
    showsongs: {
      embed: {
          error: "錯誤",
          playlistNotFound: "- 未找到播放列表。",
          accessDenied: "訪問被拒絕",
          noPermission: "- 您沒有權限查看此私密播放列表。",
          noSongs: "- 此播放列表中沒有歌曲。",
          songsInPlaylist: "{playlistName} 中的歌曲",
          songsInPlaylistPage: "{playlistName} 中的歌曲（第 {currentPage}/{totalPages} 頁）",
          errorDescription: "- 顯示歌曲時發生錯誤。"
      }
    },
    shuffle: {
      embed: {
          queueEmpty: "隊列為空",
          queueEmptyDescription: "- 當前隊列為空。使用 `/play` 命令添加歌曲。",
          queueShuffled: "隊列已打亂",
          queueShuffledDescription: "- 隊列已成功打亂。",
          error: "錯誤",
          errorDescription: "- 打亂隊列時發生錯誤。"
      }
    },
    skip: {
      embed: {
          noActivePlayer: "錯誤",
          noActivePlayerDescription: "- 未找到活動播放器。",
          songSkipped: "已跳過歌曲！",
          songSkippedDescription: "**- 播放器將播放下一首歌曲！**",
          error: "錯誤",
          errorDescription: "- 處理您的請求時發生錯誤。"
      }
    },
    stop: {
      embed: {
          noActivePlayer: "錯誤",
          noActivePlayerDescription: "- 未找到活動播放器。",
          musicHalted: "音樂已停止！",
          musicHaltedDescription: "**- 播放已停止並且播放器已銷毀！**",
          error: "錯誤",
          errorDescription: "- 處理您的請求時發生錯誤。"
      }
    },
    support: {
      embed: {
          authorName: "支持服務器",
          description: "➡️ **加入我們的 Discord 服務器獲取支持和更新：**\n- Discord - {supportServerLink}\n\n➡️ **關注我們：**\n- GitHub - {githubLink}\n- Replit - {replitLink}\n- YouTube - {youtubeLink}",
          error: "錯誤",
          errorDescription: "- 處理您的請求時發生錯誤。"
      }
    },
    volume: {
      embed: {
          noActivePlayer: "錯誤",
          noActivePlayerDescription: "- 未找到活動播放器。",
          volumeUpdated: "音量已更新！",
          volumeUpdatedDescription: "- 音量已設置為 **{volume}%**",
          error: "錯誤",
          errorDescription: "設置音量時發生錯誤。"
      },
      volumeRangeError: "音量必須在 0 到 100 之間。"
    },
    errors: {
      noPermission: "您沒有權限使用此命令。",
      generalError: "- 錯誤：{error}"
    }
};
