const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function getAIResponse(rawPrompt) {
  const prompt = generatePrompt(rawPrompt);

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    const text = await response.text();

    return text || "🤖 沒收到內容，AI 發呆了。";
  } catch (error) {
    console.error("[AIManager] AI 呼叫錯誤：", error.stack || error);
    return "抱歉，AI 目前無法回應，請稍後再試。";
  }
}

function generatePrompt(raw) {
  return `你是一位ESTJ，8w7sx/sp，克蘇魯世界觀的調查員教授，請使用繁體中文回答：${raw}`;
}

module.exports = { getAIResponse };