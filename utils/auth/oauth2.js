const { google } = require('googleapis');
const fs = require('fs');
const { getCollections } = require('../db/mongodb'); // 請確認路徑正確

const CLIENT_SECRET_PATH = '/etc/secrets/CLIENT_SECRETS_JSON'; // 你的 client secret JSON 路徑

// 讀取 client secret 並返回 OAuth2 client
function createOAuth2Client() {
  const content = fs.readFileSync(CLIENT_SECRET_PATH, 'utf8');
  const credentials = JSON.parse(content);
  const { client_id, client_secret, redirect_uris } = credentials.web || credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  return oAuth2Client;
}

// 從 MongoDB 載入令牌
async function loadToken(oAuth2Client) {
  try {
    const { googleTokensCollection } = getCollections();
    const tokenDoc = await googleTokensCollection.findOne({ _id: 'googleAuthToken' });

    if (tokenDoc) {
      // 直接攤平成欄位，不是包成 token 物件
      const { _id, lastUpdated, ...token } = tokenDoc;
      oAuth2Client.setCredentials(token);
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
    const { googleTokensCollection } = getCollections();
    if (!googleTokensCollection) throw new Error('無法取得 googleTokensCollection');

    await googleTokensCollection.updateOne(
      { _id: 'googleAuthToken' },
      { $set: { ...token, lastUpdated: new Date() } }, // 令牌攤平成欄位存
      { upsert: true }
    );
    console.log('[INFO] 令牌已儲存/更新至 MongoDB。');
  } catch (error) {
    console.error('[ERROR] 儲存令牌到 MongoDB 失敗:', error.message);
  }
}

/**
 * 取得經過授權並自動刷新令牌的 OAuth2 client。
 * @returns {OAuth2Client}
 */
async function getAuth() {
  const oAuth2Client = createOAuth2Client();

  if (!(await loadToken(oAuth2Client))) {
    throw new Error(
      '在 MongoDB 中找不到有效的令牌。請手動取得令牌並儲存到 "google" 資料庫中 "token" 集合裡的 "googleAuthToken" 文件。'
    );
  }

  // 監聽令牌更新，自動存回 MongoDB
  oAuth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token || tokens.access_token) {
      await saveToken(oAuth2Client.credentials);
    }
  });

  return oAuth2Client;
}

module.exports = {
  getAuth,
  CLIENT_SECRET_PATH,
};
