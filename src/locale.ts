import enJSON from "./locales/en.json";
import esJSON from "./locales/es.json";
import frJSON from "./locales/fr.json";
import deJSON from "./locales/de.json";
import csJSON from "./locales/cs.json";
import skJSON from "./locales/sk.json";
import jaJSON from "./locales/ja.json";

export type LocaleJSON = typeof enJSON;

export interface LocalizationDict {
  appName: string;
  appSub: string;
  geminiCpu: string;
  localDb: string;
  workspaceTabs: string;
  tabDictate: string;
  tabHistory: string;
  tabSettings: string;
  proTipLabel: string;
  proTipContent: string;
  systemSettings: string;
  systemSettingsSub: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  apiKeyFooter: string;
  tierLabel: string;
  tierFree: string;
  tierPremium: string;
  tierFooter: string;
  languageLabel: string;
  languageFooter: string;
  searchPlaceholderAll: string;
  searchPlaceholderIdeas: string;
  searchPlaceholderReminders: string;
  tagFilterPrefix: string;
  allTags: string;
  noNotesTitle: string;
  noNotesDesc: string;
  noIdeasTitle: string;
  noIdeasDesc: string;
  noRemindersTitle: string;
  noRemindersDesc: string;
  categoryAll: string;
  categoryIdeas: string;
  categoryReminders: string;
  durationPrefix: string;
  completedRoadmaps: string;
  brandAssigned: string;
  targetKickoff: string;
  complexRoadmap: string;
  scheduledAgenda: string;
  insightTitle: string;
  roadmapsHeader: string;
  transcriptHeader: string;
  deleteBtn: string;
  saveSuccessMsg: string;
  recordingMicTipSpeak: string;
  recordingMicTipIdle: string;
  recordingActive: string;
  recordingProcessing: string;
  recordingDone: string;
  generatingIdeaPrompt: string;
  ideaGenTitle: string;
  ideaGenDesc: string;
  ideaGenPresetPrompt: string;
  ideaGenBtn: string;
  settingsSubtitle: string;
  tabProfile: string;
  tabAppearance: string;
  tabAiSettings: string;
  tabDataStorage: string;
  themeLabel: string;
  themeDark: string;
  themeLight: string;
  themeSystem: string;
  accentColorLabel: string;
}

const jsonLocales: Record<string, LocaleJSON> = {
  en: enJSON,
  es: esJSON,
  fr: frJSON,
  de: deJSON,
  cs: csJSON,
  sk: skJSON,
  ja: jaJSON,
};

export const LANGUAGE_OPTIONS = [
  { code: "en", name: "English (US)" },
  { code: "es", name: "Español (ES)" },
  { code: "fr", name: "Français (FR)" },
  { code: "de", name: "Deutsch (DE)" },
  { code: "cs", name: "Čeština (CZ)" },
  { code: "sk", name: "Slovenčina (SK)" },
  { code: "ja", name: "日本語 (JP)" },
];

export function getTranslation(lang?: string): LocaleJSON {
  const language = lang || "en";
  return jsonLocales[language] || jsonLocales.en;
}
