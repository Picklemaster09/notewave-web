import { api } from "./client";
import type { SettingsConfig } from "../types";

interface DbSettings {
  language: string;
  theme: string;
  accent_color: string;
  action_button_action: string;
  // custom_api_key is intentionally omitted from responses to avoid leaking it
}

export async function fetchSettings(): Promise<Partial<SettingsConfig> | null> {
  try {
    const res = await api.get<{ settings: DbSettings | null }>("/api/settings");
    if (!res.settings) return null;
    return {
      language: res.settings.language as SettingsConfig["language"],
      theme: res.settings.theme as SettingsConfig["theme"],
      accentColor: res.settings.accent_color as SettingsConfig["accentColor"],
      actionButtonAction: res.settings.action_button_action as SettingsConfig["actionButtonAction"],
    };
  } catch {
    return null;
  }
}

export async function saveSettings(s: SettingsConfig): Promise<void> {
  await api.put("/api/settings", {
    language: s.language ?? "en",
    theme: s.theme ?? "light",
    accent_color: s.accentColor ?? "blue",
    action_button_action: s.actionButtonAction ?? "record",
    // Only send custom_api_key if user actually set one; empty string clears it
    ...(s.customApiKey !== undefined && { custom_api_key: s.customApiKey }),
  });
}

export async function syncUser(email?: string): Promise<void> {
  await api.post("/api/users/sync", { email });
}
