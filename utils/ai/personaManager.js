// personaManager.js
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../data/ai/guild.json');

let personaMap = new Map();

// 讀取檔案並初始化 Map
function loadPersonas() {
  try {
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, 'utf8');
      const obj = JSON.parse(rawData);
      // 把物件轉成 Map
      personaMap = new Map(Object.entries(obj));
    } else {
      personaMap = new Map();
    }
  } catch (err) {
    console.error('讀取 guild.json 失敗:', err);
    personaMap = new Map();
  }
}

// 把 Map 存回 JSON 檔案
function savePersonas() {
  try {
    const obj = Object.fromEntries(personaMap);
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('寫入 guild.json 失敗:', err);
  }
}

// 設定某個伺服器的 persona
function setPersona(guildId, personaName) {
  personaMap.set(guildId, personaName);
  savePersonas();
}

// 取得某個伺服器的 persona，沒設定預設回 'default'
function getPersona(guildId) {
  return personaMap.get(guildId) || 'bigteacher';
}

// 初始化時讀取一次
loadPersonas();

module.exports = {
  setPersona,
  getPersona,
};