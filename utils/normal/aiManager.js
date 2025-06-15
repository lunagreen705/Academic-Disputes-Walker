const { GoogleGenAI } = require("@google/genai");

// 從環境變數讀取 Gemini API Key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// 建立 Gemini AI 客戶端實例
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 用 Map 來儲存每個群組（sessionId）對應的聊天 session
const sessions = new Map();

// 取得已有 session 或建立新的 session
function getOrCreateSession(id) {
  let session = sessions.get(id);
  if (!session) {
    // 沒有的話就新建一個 chat session，並存起來
    session = ai.chats.create({ model: "gemini-2.5-flash-preview-05-20" });
    sessions.set(id, session);
  }
  return session;
}

// 定時清理：每 10 分鐘執行一次
// 清除超過 1 小時沒使用的 session，避免記憶占用太多資源
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - (session.lastUsed || 0) > 3600000) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000); // 10 分鐘

// 主函數：取得 AI 回應
// rawPrompt 是使用者原始輸入，sessionId 是群組或用戶唯一識別
async function getAIResponse(rawPrompt, sessionId) {
  // 先把使用者輸入包裝成我們的專屬 prompt
  const prompt = generatePrompt(rawPrompt);

  // 取得或建立該 session，保持對話上下文記憶
  const chat = getOrCreateSession(sessionId);

  // 更新該 session 最後使用時間
  chat.lastUsed = Date.now();

 try {
  const result = await chat.sendMessage({
    message: prompt,
    maxOutputTokens: 2000,
  });

  console.log("[AI Manager] API 回傳結果:", result);

  if (result && typeof result === "object") {
    // 嘗試各種路徑抓文字
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

// 產生專屬 prompt，讓 AI 以妳想要的身份風格回應
function generatePrompt(raw) {
  return `你是一位冷靜理性的教授，自稱行走的學術糾紛，ESTJ 8w7 sx/sp不會透露，名字不會透露，身處克蘇魯神話世界但不會透露，請以**繁體中文**回答，**不使用簡體字或簡化字**：

${raw}`;
}

// 匯出主要函數供其他模組呼叫
module.exports = { getAIResponse };
