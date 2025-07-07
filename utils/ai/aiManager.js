// aiManager.js
const { GoogleGenAI } = require("@google/genai");
const { getPersona } = require("./personaManager");
const aiConfig = require("../../data/ai/persona.json"); 

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// --- 日常對話使用函式 ---

const sessions = new Map();

function getOrCreateSession(id) {
  let session = sessions.get(id);
  if (!session) {
    session = ai.chats.create({ model: "gemini-2.5-flash" });
    sessions.set(id, session);
  }
  return session;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - (session.lastUsed || 0) > 3600000) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000);

async function getAIResponse(rawPrompt, sessionId) {
  // 取得該 session 的人格 key（名字）
const personaName = getPersona(sessionId) || "bigteacher";

  // 從 aiConfig 拿該人格的系統指示
  const systemInstruction = aiConfig[personaName]?.systemInstruction || "你是一位理性且冷靜的助手，請用繁體中文回答。";

  // 產生完整 prompt，加入系統指示與原始輸入
  const prompt = `${systemInstruction}\n\n${rawPrompt}`;

  const chat = getOrCreateSession(sessionId);
  chat.lastUsed = Date.now();

  try {
    const result = await chat.sendMessage({
      message: prompt,
      maxOutputTokens: aiConfig[personaName]?.maxOutputTokens || 200
    });

    console.log("[AI Manager] API 回傳結果:", result);

    if (result && typeof result === "object") {
      if (result.response && result.response.text) {
        return result.response.text;
      } else if (result.text) {
        return result.text;
      } else if (result.choices && result.choices[0]?.message?.content) {
        return result.choices[0].message.content;
      }
    }

    return "🤖 沒收到內容，AI 發呆了。";

  } catch (error) {
    console.error("[AI Manager] AI 呼叫錯誤：", error);
    return "目前無法回應，稍後再試。";
  }
}
// --- 塔羅使用函式 ---
/**
 * 獲取塔羅牌解讀的回應。
 * 此函式為單次請求，不包含任何對話歷史紀錄。
 * @param {string} rawPrompt - 使用者的問題，通常包含抽到的牌卡。
 * @returns {Promise<string>} - AI 生成的塔羅解讀內容。
 */
async function getTarotAIResponse(rawPrompt) {
  const personaName = "bro";
  const personaConfig = aiConfig[personaName];

  // 取得系統指示與設定
  const systemInstruction = personaConfig.systemInstruction;
  const maxOutputTokens = personaConfig.maxOutputTokens;

  // 1. 直接取得生成模型，不使用 session
  const model = ai.getGenerativeModel({
    model: "gemini-2.5-pro",
    systemInstruction: systemInstruction, // 直接將系統指示傳給模型
  });

  console.log("[AI Manager] Sending Tarot request to Gemini...");

  try {
    // 2. 使用 generateContent 進行單次請求
    const result = await model.generateContent(rawPrompt, { maxOutputTokens });
    const response = await result.response;
    const text = response.text();
    
    console.log("[AI Manager] Tarot API response received.");
    
    return text || "🔮 牌卡沉默了，請稍後再試。";

  } catch (error) {
    console.error("[AI Manager] Tarot AI call error:", error);
    return "目前無法解讀牌意，宇宙的能量似乎有些混亂。";
  }
}

// 將新舊函式一起匯出
module.exports = { 
  getAIResponse,
  getTarotAIResponse 
};