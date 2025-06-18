const personaMap = new Map(); // 記錄每個 sessionId 的 persona

// 設定某個 sessionId 的 persona
function setPersona(sessionId, personaName) {
  personaMap.set(sessionId, personaName);
}

// 取得 persona，預設為 default
function getPersona(sessionId) {
  return personaMap.get(sessionId) || "default";
}

module.exports = { setPersona, getPersona };