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
  // Task-specific fields (for reminders category)
  taskPriority?: "Low" | "Medium" | "High" | "Urgent";
  taskCategory?: "Work" | "Personal" | "Health" | "Learning" | "Ideas";
  audioData?: string; // legacy base64 audio (older locally-stored notes)
  audioKey?: string; // R2 object key for cloud-stored audio; played back via /api/audio
  audioBytes?: number; // size of the stored audio in bytes (for storage accounting)
  modelUsed: string;
  userId?: string;
  // AI enrichment status for optimistic UI. Missing/"ready" = fully populated;
  // "processing" = added instantly, awaiting the AI response; "failed" = AI errored.
  status?: "processing" | "ready" | "failed";
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
