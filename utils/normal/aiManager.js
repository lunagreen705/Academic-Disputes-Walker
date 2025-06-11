// utils/normal/aiManager.js

const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * 產生 Gemini AI 回覆
 * @param {string} rawPrompt - 使用者原始訊息
 * @returns {string} 回覆文字
 */
async function getAIResponse(rawPrompt) {
  const prompt = generatePrompt(rawPrompt);

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash", // 你也可以改成 gemini-1.5-pro
      contents: [prompt]
    });

    return result.response.text || "🤖 沒收到內容，AI 發呆了。";
  } catch (error) {
    console.error("[AIManager] AI 呼叫錯誤：", error.stack || error);
    return "抱歉，AI 目前無法回應，請稍後再試。";
  }
}

/**
 * 將使用者輸入包裝成妾身風格的 prompt（繁體）
 * @param {string} raw
 * @returns {string}
 */
function generatePrompt(raw) {
  return `你是一位ESTJ 8w7 sx/sp克蘇魯風格的調查員教授。請使用繁體中文回答：${raw}`;
}

module.exports = { getAIResponse };