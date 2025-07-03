// aiManager.js
const { GoogleGenAI } = require("@google/genai");
const { getPersona } = require("./personaManager");
const aiConfig = require("../../data/ai/persona.json"); 

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const sessions = new Map();

function getOrCreateSession(id) {
  let session = sessions.get(id);
  if (!session) {
    session = ai.chats.create({ model: "gemini-2.5-pro" });
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
      maxOutputTokens: aiConfig[personaName]?.maxOutputTokens || 2000
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
    return "抱歉，AI 目前無法回應，請稍後再試。";
  }
}

module.exports = { getAIResponse };