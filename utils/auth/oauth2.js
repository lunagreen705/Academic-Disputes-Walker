const { google } = require('googleapis');
// const fs = require('fs'); // 不再需要用於令牌儲存，可以移除
// const path = require('path'); // 不再需要用於令牌儲存，可以移除

// 引入你的 MongoDB 連線模組
const { getCollections } = require('../db/mongodb'); // <--- 重要：請再次確認這個路徑！

const CLIENT_SECRET_PATH = '/etc/secrets/CLIENT_SECRETS_JSON'; // 你的 client secret JSON 路徑

// 讀取 client secret 並返回 OAuth2 client
function createOAuth2Client() {
  const content = require('fs').readFileSync(CLIENT_SECRET_PATH, 'utf8'); // 仍保留 fs 用於讀取 client secret
  const credentials = JSON.parse(content);
  const { client_id, client_secret, redirect_uris } = credentials.web || credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  return oAuth2Client;
}

// 從 MongoDB 載入令牌
async function loadToken(oAuth2Client) {
  try {
    const { googleTokensCollection } = getCollections(); // 從你的 MongoDB 模組取得集合
    const tokenDoc = await googleTokensCollection.findOne({ _id: 'googleAuthToken' }); // 透過 _id 查找文件

    if (tokenDoc && tokenDoc.token) {
      // Google API 客戶端預期直接接收令牌的詳細資訊，
      // 而不是包裝在另一個 'token' 物件中。
      // 你的 MongoDB 文件將實際的憑證儲存在 tokenDoc.token 裡
      oAuth2Client.setCredentials(tokenDoc.token);
      console.log('[INFO] 令牌已成功從 MongoDB 載入。');
      return true;
    }
    console.log('[INFO] 在 MongoDB 中找不到有效的令牌。');
    return false;
  } catch (error) {
    console.error('[ERROR] 從 MongoDB 載入令牌失敗:', error.message);
    return false;
  }
}

// 將令牌儲存到 MongoDB
async function saveToken(token) {
  try {
    const { googleTokensCollection } = getCollections(); // 取得集合
    // 使用 upsert: true 以便在文件不存在時插入，存在時更新。
    await googleTokensCollection.updateOne(
      { _id: 'googleAuthToken' }, // 目標 _id 為 'googleAuthToken' 的文件
      { $set: { token: token, lastUpdated: new Date() } }, // 設定新的令牌並更新時間戳
      { upsert: true } // 如果文件不存在則創建
    );
    console.log('[INFO] 令牌已儲存/更新至 MongoDB。');
  } catch (error) {
    console.error('[ERROR] 儲存令牌到 MongoDB 失敗:', error.message);
  }
}

/**
 * 取得經過授權並自動刷新令牌的 OAuth2 client。
 * @returns {OAuth2Client} 經過授權的 OAuth2 client。
 */
async function getAuth() {
  const oAuth2Client = createOAuth2Client();

  // 嘗試從 MongoDB 載入令牌
  if (!(await loadToken(oAuth2Client))) {
    // *** 這裡的錯誤訊息已更新為你的實際資料庫和集合名稱 ***
    throw new Error('在 MongoDB 中找不到有效的令牌。請手動取得令牌並儲存到 "google" 資料庫中 "token" 集合裡的 "googleAuthToken" 文件。');
  }

  // 自動監聽令牌更新事件（刷新），然後將新令牌儲存到 MongoDB。
  oAuth2Client.on('tokens', async (tokens) => {
    // 檢查 refresh_token 或 access_token 是否有更新
    if (tokens.refresh_token || tokens.access_token) {
      await saveToken(oAuth2Client.credentials); // oAuth2Client.credentials 包含了最新的令牌資訊
    }
  });

  return oAuth2Client;
}

module.exports = {
  getAuth,
  CLIENT_SECRET_PATH,
  // TOKEN_PATH 已不再相關，因為它不再是本地檔案
};