import { Client, GatewayIntentBits } from 'discord.js';
// aimanager.js
import { GoogleGenAI } from "@google/genai";

// 建立並匯出 singleton AI 實例
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * 呼叫 Gemini AI，取得回覆
 * @param {string} prompt - 使用者輸入內容
 * @returns {Promise<string>} AI 回覆文字
 */
export async function getAIResponse(prompt) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-05-20", // 妳之前用的模型版本
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("[AIManager] AI 呼叫錯誤：", error);
    return "抱歉，AI 目前無法回應，請稍後再試。";
  }
}
