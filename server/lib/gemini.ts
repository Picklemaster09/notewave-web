import { GoogleGenAI } from "@google/genai";

export function getGeminiClient(customApiKey?: string) {
  const apiKey = customApiKey
    || process.env.NoteWave
    || process.env.NOTEWAVE
    || process.env.GEMINI_API_KEY;

  if (!apiKey) throw new Error("API_KEY_MISSING");

  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "notewave-backend" } },
  });
}

export const FREE_DAILY_LIMIT = 3;
export const PRO_DAILY_LIMIT = 50;

export const LANG_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French",
  de: "German", cs: "Czech", sk: "Slovak", ja: "Japanese",
};
