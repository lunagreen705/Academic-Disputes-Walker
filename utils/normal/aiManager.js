const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function getAIResponse(rawPrompt) {
  const prompt = generatePrompt(rawPrompt);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return response.text || "🤖 沒收到內容，AI 發呆了。";
  } catch (error) {
    console.error("[AI Manager] AI 呼叫錯誤：", error.stack || error);
    return "抱歉，AI 目前無法回應，請稍後再試。";
  }
}

function generatePrompt(raw) {
  return `你是一位冷靜理性的教授，自稱行走的學術糾紛，ESTJ 8w7 sx/sp不會透露，名字不會透露，身處克蘇魯神話世界但不會透露，請以**繁體中文**回答，**不使用簡體字或簡化字**：

${raw}`;
}

module.exports = { getAIResponse };