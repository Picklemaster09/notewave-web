export type UserTier = "free" | "premium";

export interface UserProfile {
  uid: string;
  email: string | null;
  tier: UserTier;
  createdAt: string;
}

export interface SubTodo {
  id: string;
  text: string;
  completed: boolean;
}

export interface RecordingNote {
  id: string;
  title: string;
  duration: number; // in seconds
  createdAt: string;
  transcript: string;
  ideaSummary: string;
  actionItems: string; // Markdown checkboxes (fallback compatibility)
  category: "ideas" | "reminders";
  ideaName?: string; // generated catchy name of the app or tool
  scheduledDate?: string; // parsed target day/time for Reminders
  projectStartDate?: string; // project specified starting point
  isComplex?: boolean; // whether the idea is complex and has multiple sub-tasks
  subTodos: SubTodo[]; // list of actionable checkpoints that can be checked off
  tags: string[];
  audioData?: string; // base64 representation for playing back
  modelUsed: string;
  userId?: string;
}

export interface SettingsConfig {
  customApiKey: string;
  tier: UserTier;
  actionButtonAction: "record" | "brainstorm" | "theme" | "none";
  language?: string; // e.g. "en", "es", "fr", "de", "cs", "sk", "ja"
  theme?: "light" | "dark" | "system";
  accentColor?: "orange" | "purple" | "blue" | "green" | "red";
}

export interface UsageStats {
  limit: number;
  remaining: number;
  resetInHours: number;
}
