import { useState, useEffect } from "react";
import { UserProfile, RecordingNote, SettingsConfig, UserTier } from "./types";
import { 
  checkSupabaseHealth, 
  supabaseSaveSettings, 
  supabaseFetchNotes, 
  supabaseSaveNotes, 
  supabaseDeleteNote, 
  supabaseDeleteAllNotes 
} from "./supabase";
import SupabaseSyncPanel from "./components/SupabaseSyncPanel";
import RecordingSlate from "./components/RecordingSlate";
import NotesHistory from "./components/NotesHistory";
import IdeaGenerator from "./components/IdeaGenerator";
import NoteWaveLanding from "./components/NoteWaveLanding";
import TextUploadSlate from "./components/TextUploadSlate";
import SettingsPanel from "./components/SettingsPanel";
import TasksWorkspace from "./components/TasksWorkspace";
import AIAgentWorkspace from "./components/AIAgentWorkspace";
import { Mic, Settings as SettingsIcon, History, Key, Check, HelpCircle, Layers, Cpu, Cloud, Database, Sparkles, Globe, LogOut, User, FileText, Upload, ListTodo } from "lucide-react";
import { getTranslation, LANGUAGE_OPTIONS } from "./locale";
import { useAuth0 } from "@auth0/auth0-react";
import { registerTokenGetter } from "./authToken";
import { apiUrl, APP_HREF, LANDING_HREF, isLandingHost } from "./config";


const LOCAL_STORAGE_NOTES_KEY = "notewave_local_notes";
const LOCAL_STORAGE_SETTINGS_KEY = "notewave_local_settings";

const tabTasksText: Record<string, string> = {
  en: "Tasks",
  es: "Tareas",
  fr: "Tâches",
  de: "Aufgaben",
  cs: "Úkoly",
  sk: "Úlohy",
  ja: "タスク群"
};

const modeDictateText: Record<string, string> = {
  en: "Dictate Live Voice",
  es: "Dictar voz en vivo",
  fr: "Dictée vocale en direct",
  de: "Live-Sprachnotiz diktieren",
  cs: "Diktovat hlas živě",
  sk: "Diktovať hlas naživo",
  ja: "音声をライブ録音"
};

const modeUploadText: Record<string, string> = {
  en: "Import Text & Logs",
  es: "Importar texto y registros",
  fr: "Importer du texte et des journaux",
  de: "Text & Protokolle importieren",
  cs: "Importovat text a protokoly",
  sk: "Importovať text a záznamy",
  ja: "テキストとログを導入"
};

const cloudSyncText: Record<string, string> = {
  en: "Direct Cloud Sync Active",
  es: "Sincronización en la nube activa",
  fr: "Synchronisation Cloud directe active",
  de: "Direkte Cloud-Synchronisierung aktiv",
  cs: "Přímá cloudová synchronizace aktivní",
  sk: "Priama cloudová synchronizácia aktívna",
  ja: "クラウドアカウント同期が稼働中"
};

const importInfoText: Record<string, string> = {
  en: "Import text documents and transcripts from other apps (e.g., Teams/Zoom log briefings). Gemini will categorize, name, and generate custom Checklist Roadmap templates automatically!",
  es: "Importa documentos de texto y transcripciones de otras aplicaciones (como reuniones de Teams o Zoom). ¡Gemini los categorizará, nombrará y creará plantillas de mapas de ruta de inmediato!",
  fr: "Importez des documents texte et des transcriptions d'autres applications (ex. briefings Teams/Zoom). Gemini va catégoriser, nommer et générer des feuilles de route automatiquement !",
  de: "Importieren Sie Textdokumente und Transkripte aus anderen Apps (z. B. Teams/Zoom-Gespräche). Gemini benennt, kategorisiert und erstellt darauf basierend automatisch Roadmap-Checklisten!",
  cs: "Importujte textové dokumenty a přepisy z jiných aplikací (např. Teams/Zoom). Gemini je automaticky roztřídí, pojmenuje a vytvoří plán konkrétních milníků!",
  sk: "Importujte textové dokumenty a prepisy z iných aplikácií (napr. Teams/Zoom). Gemini ich automaticky roztriedi, pomenuje a vytvorí plán konkrétnych míľnikov!",
  ja: "他のアプリ（TeamsやZoom of ログなど）からテキスト文書や文字起こしデータを読み込みます。Geminiが自動的に分類・命名し、段階的なチェックリストを作成します！"
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"dictate" | "history" | "tasks" | "settings" | "ai_agent">("dictate");
  const [inputMode, setInputMode] = useState<"voice" | "upload">("voice");
  const [isCloudOnline, setIsCloudOnline] = useState(true);
  
  // App settings state (defaults to Free Tier with RECORD action shortcut and English)
  const [settings, setSettings] = useState<SettingsConfig>({
    customApiKey: "",
    tier: "free",
    actionButtonAction: "record",
    language: "en",
    theme: "light",
    accentColor: "blue",
  });

  const [showUpgradeCheckout, setShowUpgradeCheckout] = useState(false);
  const [limitErrorMsg, setLimitErrorMsg] = useState<string | null>(null);

  const [notes, setNotes] = useState<RecordingNote[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const {
    isAuthenticated,
    isLoading: authLoading,
    user: auth0User,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();
  const [localProfileName, setLocalProfileName] = useState(() => {
    return localStorage.getItem("settings_display_name") || "";
  });
  const [avatarImg, setAvatarImg] = useState(() => {
    return localStorage.getItem("settings_avatar_img") || "";
  });

  // Simulated Pro Checkout Form States
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [checkoutStep, setCheckoutStep] = useState<"form" | "processing" | "success">("form");
  const [activeLogIdx, setActiveLogIdx] = useState(0);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const handleCardNumberChange = (value: string) => {
    const clean = value.replace(/\D/g, "");
    const formatted = clean.match(/.{1,4}/g)?.join(" ") || clean;
    setCardNumber(formatted.substring(0, 19));
  };

  const handleExpiryChange = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length <= 2) {
      setCardExpiry(clean);
    } else {
      setCardExpiry(`${clean.substring(0, 2)}/${clean.substring(2, 4)}`);
    }
  };

  const handleCvcChange = (value: string) => {
    const clean = value.replace(/\D/g, "");
    setCardCvc(clean.substring(0, 3));
  };

  const startCheckoutSimulation = () => {
    setIsAuthorizing(true);
    setCheckoutStep("processing");
    setActiveLogIdx(0);

    const stepsTimeout = [800, 1600, 2400, 3200];
    
    stepsTimeout.forEach((delay, idx) => {
      setTimeout(() => {
        setActiveLogIdx(idx + 1);
        if (idx === stepsTimeout.length - 1) {
          localStorage.setItem("notewave_is_pro_purchased", "true");
          
          const upgradedSettings: SettingsConfig = {
            ...settings,
            tier: "premium"
          };
          setSettings(upgradedSettings);
          localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(upgradedSettings));
          
          if (currentUser) {
            supabaseSaveSettings(currentUser.uid, upgradedSettings).catch(e => console.error("Could not sync premium tier to online database:", e));
          }

          setIsAuthorizing(false);
          setCheckoutStep("success");
          setLimitErrorMsg(null);
        }
      }, delay);
    });
  };

  const handleUpdateAvatar = (imgBase64: string) => {
    setAvatarImg(imgBase64);
    localStorage.setItem("settings_avatar_img", imgBase64);
  };

  const handleUserChange = (user: any) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem("notewave_user_session", JSON.stringify(user));
      if (user.displayName) {
        setLocalProfileName(user.displayName);
      }
    } else {
      localStorage.removeItem("notewave_user_session");
    }
  };

  // Kick off Auth0 Universal Login (redirect). `signup` shows the sign-up screen;
  // `connection` jumps straight to a social provider (e.g. "google-oauth2").
  const handleLogin = (opts?: { signup?: boolean; connection?: string }) => {
    loginWithRedirect({
      authorizationParams: {
        ...(opts?.signup ? { screen_hint: "signup" } : {}),
        ...(opts?.connection ? { connection: opts.connection } : {}),
      },
    });
  };

  const handleSignOut = () => {
    registerTokenGetter(null);
    handleUserChange(null);
    localStorage.removeItem("settings_display_name");
    localStorage.removeItem("settings_avatar_img");
    setLocalProfileName("");
    setAvatarImg("");
    logout({ logoutParams: { returnTo: LANDING_HREF } });
  };

  // Bridge the Auth0 session into the app's existing user model so the rest of
  // the dashboard (notes/settings sync keyed by uid) keeps working unchanged.
  // The token getter is registered here so that API calls can fetch a fresh
  // access token. Auth0's SDK handles automatic token refresh using the stored
  // refresh token, so users stay signed in even after the access token expires.
  useEffect(() => {
    if (isAuthenticated && auth0User) {
      // Register the token getter – this is called by the API layer before each
      // request to ensure a valid (non-expired) access token is used.
      registerTokenGetter(() => getAccessTokenSilently());
      handleUserChange({
        uid: auth0User.sub,
        id: auth0User.sub,
        email: auth0User.email,
        displayName:
          auth0User.name ||
          auth0User.nickname ||
          (auth0User.email ? auth0User.email.split("@")[0] : "") ||
          "NoteWave Inventor",
        tier: settings.tier || "free",
      });
      if (auth0User.picture && !localStorage.getItem("settings_avatar_img")) {
        setAvatarImg(auth0User.picture);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, auth0User]);

  // Fetch the user's plan from the server on login and sync it with local settings
  useEffect(() => {
    let active = true;
    const fetchServerPlan = async () => {
      if (!isAuthenticated) return;
      try {
        const token = await getAccessTokenSilently();
        const response = await fetch(apiUrl("/api/usage"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok && active) {
          const data = await response.json();
          const serverPlan = data.plan === "premium" ? "premium" : "free";
          // Only update if the server plan differs from local settings
          if (settings.tier !== serverPlan) {
            const updatedSettings = { ...settings, tier: serverPlan };
            setSettings(updatedSettings);
            localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(updatedSettings));
            if (serverPlan === "premium") {
              localStorage.setItem("notewave_is_pro_purchased", "true");
            }
          }
        }
      } catch (e) {
        console.warn("Failed to fetch server plan:", e);
      }
    };
    fetchServerPlan();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);
  
  // Periodically check Supabase connection health
  useEffect(() => {
    let active = true;
    const checkConnection = async () => {
      const healthy = await checkSupabaseHealth();
      if (active) setIsCloudOnline(healthy);
    };
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Periodically refresh the Auth0 access token so that when the user returns
  // to the app after a long idle period (e.g., days), the token is already valid
  // and API calls don't fail. Auth0's getAccessTokenSilently() will use the
  // refresh token or perform a silent auth with the session cookie.
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Refresh token every 15 minutes to keep it fresh. Auth0 access tokens
    // typically expire after 8 hours (28800 seconds), and refresh tokens
    // expire after 3 days of inactivity by default.
    const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    
    const refreshTimer = setInterval(async () => {
      try {
        await getAccessTokenSilently();
      } catch (e: any) {
        // If login_required, the session has fully expired and user needs to
        // re-authenticate. Log it but don't disrupt the UI.
        if (e?.error === "login_required") {
          console.warn(
            "Auth0 session has expired. User will need to re-authenticate on next action."
          );
        } else {
          console.warn("Periodic token refresh failed (non-fatal):", e);
        }
      }
    }, REFRESH_INTERVAL_MS);
    
    // Also try an immediate refresh on mount (in case the app was left open
    // but idle for a long time and the token expired)
    const tryImmediateRefresh = async () => {
      try {
        await getAccessTokenSilently();
      } catch (e: any) {
        if (e?.error !== "login_required") {
          console.warn("Immediate token refresh failed (non-fatal):", e);
        }
      }
    };
    tryImmediateRefresh();
    
    return () => clearInterval(refreshTimer);
  }, [isAuthenticated, getAccessTokenSilently]);
  
  // Physical Bezel Mapped Triggers State
  const [triggerRecord, setTriggerRecord] = useState(false);
  const [triggerBrainstorm, setTriggerBrainstorm] = useState(false);

  // Load local state initially
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.tier === "premium") {
          localStorage.setItem("notewave_is_pro_purchased", "true");
        }
        setSettings({
          customApiKey: parsed.customApiKey || "",
          tier: parsed.tier || "free",
          actionButtonAction: parsed.actionButtonAction || "record",
          language: parsed.language || "en",
          theme: parsed.theme || (localStorage.getItem("settings_theme") as any) || "light",
          accentColor: parsed.accentColor || (localStorage.getItem("settings_accent_color") as any) || "blue",
        });
      } else {
        const initialTheme = (localStorage.getItem("settings_theme") as any) || "light";
        const initialAccent = (localStorage.getItem("settings_accent_color") as any) || "blue";
        setSettings((prev) => ({
          ...prev,
          theme: initialTheme,
          accentColor: initialAccent,
        }));
      }

      const savedNotes = localStorage.getItem(LOCAL_STORAGE_NOTES_KEY);
      if (savedNotes) {
        const parsed = JSON.parse(savedNotes);
        const normalized = Array.isArray(parsed) ? parsed.map((note) => ({
          ...note,
          category: note.category || "ideas",
          subTodos: Array.isArray(note.subTodos) ? note.subTodos : [],
          // A note left "processing" means the app closed mid-request — its
          // in-flight AI call is gone, so settle it rather than spin forever.
          status: note.status === "processing" ? "failed" : note.status,
        })) : [];
        setNotes(normalized);
      }
    } catch (e) {
      console.error("Local storage restoration failed:", e);
    }
  }, []);

  // Dynamically apply selected theme and accent color systems app-wide
  useEffect(() => {
    const activeTheme = settings.theme || "light";
    const activeAccent = settings.accentColor || "blue";

    // Set interactive accent attributes
    document.documentElement.setAttribute("data-accent", activeAccent);
    localStorage.setItem("settings_accent_color", activeAccent);

    // Set theme (light / dark)
    let isDark = activeTheme === "dark";
    if (activeTheme === "system") {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
    localStorage.setItem("settings_theme", activeTheme);
  }, [settings.theme, settings.accentColor]);

  // Hydrate profile settings from cloud once user logs in
  useEffect(() => {
    if (!currentUser) return;

    const syncProfileAndSettings = async () => {
      try {
        // Fetch cloud settings and notes
        const list = await supabaseFetchNotes(currentUser.uid);
        if (list.length > 0) {
          // Sync local state initially if cloud notes exist
          const mergedMap = new Map<string, RecordingNote>();
          list.forEach((n) => mergedMap.set(n.id, n));
          notes.forEach((n) => mergedMap.set(n.id, n));
          const mergedList = Array.from(mergedMap.values());
          mergedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setNotes(mergedList);
          localStorage.setItem(LOCAL_STORAGE_NOTES_KEY, JSON.stringify(mergedList));
        }
      } catch (err) {
        console.error("Failed to fetch cloud profile settings:", err);
      }
    };

    syncProfileAndSettings();
  }, [currentUser]);

  // Save notes locally whenever list updates
  const saveNotesLocally = (updatedNotes: RecordingNote[]) => {
    setNotes(updatedNotes);
    localStorage.setItem(LOCAL_STORAGE_NOTES_KEY, JSON.stringify(updatedNotes));
  };

  const handleSaveSettings = async (updated: SettingsConfig) => {
    // Intercept switching to Pro/Premium if they haven't purchased it yet!
    if (updated.tier === "premium" && localStorage.getItem("notewave_is_pro_purchased") !== "true") {
      setLimitErrorMsg(null); // Clear specific limit warnings as this is a manual upgrade
      setShowUpgradeCheckout(true);
      return;
    }

    setSettings(updated);
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(updated));

    if (currentUser) {
      try {
        await supabaseSaveSettings(currentUser.uid, updated);
        console.log("Cloud profile settings synced!");
      } catch (err) {
        console.error("Cloud settings write failed:", err);
      }
    }
  };

  // --------------------------------------------------------
  // Smart Background Polling (Production-Level Fetching)
  // --------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;
    let isActive = true;

    const pullCloudUpdates = async () => {
      try {
        const cloudNotes = await supabaseFetchNotes(currentUser.uid);
        if (!isActive) return;
        
        setNotes((prev) => {
          const mergedMap = new Map<string, RecordingNote>();
          
          // Keep local state
          prev.forEach((n) => mergedMap.set(n.id, n));
          
          // Merge with cloud state (so other devices' new notes show up)
          cloudNotes.forEach((n) => mergedMap.set(n.id, {
            ...n,
            category: n.category || "ideas",
            subTodos: Array.isArray(n.subTodos) ? n.subTodos : [],
          }));

          const mergedList = Array.from(mergedMap.values());
          mergedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          localStorage.setItem(LOCAL_STORAGE_NOTES_KEY, JSON.stringify(mergedList));
          return mergedList;
        });
      } catch (err) {
        console.warn("Background cloud fetch failed (non-fatal):", err);
      }
    };

    // 1. Fetch immediately when window regains focus (e.g. switching tabs back to NoteWave)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") pullCloudUpdates();
    };
    const handleFocus = () => pullCloudUpdates();

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    // 2. Poll periodically (every 30 seconds)
    const intervalId = setInterval(() => {
      pullCloudUpdates();
    }, 30000);

    return () => {
      isActive = false;
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      clearInterval(intervalId);
    };
  }, [currentUser]);

  // --------------------------------------------------------
  // Supabase Synchronizations Engine (Cloud Backup Database)
  // --------------------------------------------------------
  
  // Bidirectional merge of local & cloud listings
  const syncRecordingsToSupabase = async (user: any) => {
    if (!user) return;

    try {
      const cloudNotes = await supabaseFetchNotes(user.uid);
      const mergedMap = new Map<string, RecordingNote>();
      
      // Load cloud backups first
      cloudNotes.forEach((n) => mergedMap.set(n.id, {
        ...n,
        category: n.category || "ideas",
        subTodos: Array.isArray(n.subTodos) ? n.subTodos : [],
      }));
      
      // Load/overwrite with current local list (any newly recorded dictations)
      notes.forEach((n) => mergedMap.set(n.id, {
        ...n,
        category: n.category || "ideas",
        subTodos: Array.isArray(n.subTodos) ? n.subTodos : [],
      }));

      const mergedList = Array.from(mergedMap.values());
      mergedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Save complete merged cache locally
      setNotes(mergedList);
      localStorage.setItem(LOCAL_STORAGE_NOTES_KEY, JSON.stringify(mergedList));

      // Push back bulk backup
      await supabaseSaveNotes(user.uid, mergedList);
      console.log("Dual-sync backup synced seamlessly with Supabase cloud database!");
    } catch (err) {
      console.error("Failed cloud database sync replication:", err);
    }
  };

  const getNoteTextSizeBytes = (note: RecordingNote): number => {
    const { audioData, ...textPart } = note;
    try {
      return JSON.stringify(textPart).length;
    } catch {
      let size = 0;
      size += (note.id?.length || 0);
      size += (note.title?.length || 0);
      size += (note.transcript?.length || 0);
      size += (note.ideaSummary?.length || 0);
      size += (note.category?.length || 0);
      return size || 180;
    }
  };

  const getNoteAudioSizeBytes = (note: RecordingNote): number => {
    // Audio lives in R2 now; its size is recorded on the note. Fall back to the
    // legacy inline base64 for older locally-stored notes.
    if (typeof note.audioBytes === "number") return note.audioBytes;
    if (!note.audioData) return 0;
    const base64Data = note.audioData.includes(",") ? note.audioData.split(",")[1] : note.audioData;
    return Math.round(base64Data.length * 0.75);
  };

  // Add recorded note track. Returns true if the note was accepted (passed the
  // plan limits) and added, false if it was rejected — callers use this to
  // decide whether to fire the follow-up AI request for an optimistic note.
  const handleAddNewNote = async (newNote: RecordingNote): Promise<boolean> => {
    const isPremium = settings.tier === "premium";

    // Combined note cap (voice notes + uploads together): Free 10, Pro 100.
    const noteLimit = isPremium ? 100 : 10;
    if (notes.length >= noteLimit) {
      setLimitErrorMsg(settings.language === "es"
        ? `¡Límite de notas alcanzado (${noteLimit} de ${noteLimit})! ${isPremium ? "Has alcanzado la capacidad máxima del plan Pro." : "Actualiza a Pro para guardar hasta 100 notas y documentos combinados."}`
        : `Note limit reached (${noteLimit} of ${noteLimit})! ${isPremium ? "You've reached the maximum Pro capacity." : "Upgrade to Pro to store up to 100 combined notes and uploads."}`);
      if (!isPremium) {
        setShowUpgradeCheckout(true);
      }
      return false;
    }

    // Combined storage capacity check (voice memos + uploads + notes): Free 5 MB,
    // Pro 1 GB. Audio bytes live in R2 but are accounted for via note.audioBytes.
    {
      const totalTextBytes = notes.reduce((acc, note) => acc + getNoteTextSizeBytes(note), 0);
      const totalAudioBytes = notes.reduce((acc, note) => acc + getNoteAudioSizeBytes(note), 0);
      const totalUsedKB = (totalTextBytes + totalAudioBytes) / 1024;
      const incomingKB = (getNoteTextSizeBytes(newNote) + getNoteAudioSizeBytes(newNote)) / 1024;
      const maxKB = isPremium ? 1048576 : 51200; // 1 GB / 50 MB
      const displayMaxStr = isPremium ? "1 GB" : "50 MB";

      if (totalUsedKB + incomingKB > maxKB) {
        setLimitErrorMsg(settings.language === "es"
          ? `¡Almacenamiento lleno (límite de ${displayMaxStr} superado)! ${isPremium ? "" : "Actualiza a Pro para 1 GB de almacenamiento seguro."}`
          : `Storage capacity full (${displayMaxStr} limit exceeded)! ${isPremium ? "" : "Upgrade to Pro for 1 GB of secure cloud storage."}`);
        if (!isPremium) {
          setShowUpgradeCheckout(true);
        }
        return false;
      }
    }

    const updated = [newNote, ...notes];
    saveNotesLocally(updated);

    // Skip cloud sync for in-flight optimistic notes — they're synced once the
    // AI fills them in via updateNote, so we don't push half-empty records.
    if (currentUser && newNote.status !== "processing") {
      try {
        await supabaseSaveNotes(currentUser.uid, updated);
      } catch (err) {
        console.error("Direct cloud save failed, queued locally:", err);
      }
    }
    return true;
  };

  // Merge AI results into an already-displayed optimistic note. Persists locally
  // and (once no longer processing) syncs the completed note to the cloud.
  const updateNote = (id: string, patch: Partial<RecordingNote>) => {
    setNotes((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, ...patch } : n));
      localStorage.setItem(LOCAL_STORAGE_NOTES_KEY, JSON.stringify(updated));
      if (currentUser && patch.status !== "processing") {
        supabaseSaveNotes(currentUser.uid, updated).catch((err) =>
          console.error("Cloud update sync failed, kept locally:", err)
        );
      }
      return updated;
    });
  };

  // Handle note deletion
  const handleDeleteNote = async (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    saveNotesLocally(updated);

    if (currentUser) {
      try {
        await supabaseDeleteNote(currentUser.uid, id);
      } catch (err) {
        console.error("Direct cloud delete failed:", err);
      }
    }
  };

  // Erase all notes for Settings Panel integration
  const handleDeleteAllNotes = async () => {
    saveNotesLocally([]);
    if (currentUser) {
      try {
        await supabaseDeleteAllNotes(currentUser.uid);
      } catch (err) {
        console.error("Direct cloud erase all failed:", err);
      }
    }
  };

  // Interactive Checklist check updates
  const handleToggleActionItem = async (noteId: string, itemText: string, checked: boolean) => {
    const updated = notes.map((note) => {
      if (note.id !== noteId) return note;

      // Extract lines and rewrite checklist markdown checkboxes
      const lines = note.actionItems ? note.actionItems.split("\n") : [];
      const updatedLines = lines.map((line) => {
        const trimmed = line.trim();
        // Check if line contains this text (ignoring checkboxes)
        if (trimmed && trimmed.includes(itemText)) {
          return checked 
            ? line.replace(/\[\s*\]/, "[x]").replace(/\[\s*[xX]\s*\]/, "[x]")
            : line.replace(/\[\s*[xX]\s*\]/, "[ ]").replace(/\[\s*\]/, "[ ]");
        }
        return line;
      });

      const updatedSubTodos = note.subTodos ? note.subTodos.map((todo) => {
        if (todo.text === itemText) {
          return { ...todo, completed: checked };
        }
        return todo;
      }) : [];

      return {
        ...note,
        actionItems: updatedLines.join("\n"),
        subTodos: updatedSubTodos,
      };
    });

    saveNotesLocally(updated);

    // Sync item status check to firestore synchronously
    if (currentUser) {
      try {
        await supabaseSaveNotes(currentUser.uid, updated);
      } catch (err) {
        console.error("Direct checked task cloud write failed:", err);
      }
    }
  };

  // --------------------------------------------------------
  // Mapped Physical Bezel iOS Action Button Click Handler
  // --------------------------------------------------------
  const handlePhysicalActionButtonClick = () => {
    switch (settings.actionButtonAction) {
      case "record":
        // Toggles recorder live state
        setTriggerRecord(true);
        setActiveTab("dictate");
        break;
      case "brainstorm":
        // Cycles creative brainstorming cue card
        setTriggerBrainstorm(true);
        break;
      case "theme":
        // Cycle active subscriber configuration toggles (Simulating cycles)
        const nextTier = settings.tier === "premium" ? "free" : "premium";
        handleSaveSettings({
          ...settings,
          tier: nextTier,
        });
        break;
      default:
        break;
    }
  };

  const t = getTranslation(settings.language || "en");

  // Landing/root host (two-host setup): only ever show the marketing + demo page.
  // Signing in redirects to the app host (Auth0 redirect_uri = app origin), and an
  // already-authenticated visitor is moved straight to the app.
  if (isLandingHost) {
    if (isAuthenticated) {
      window.location.href = APP_HREF;
      return null;
    }
    return (
      <NoteWaveLanding
        onLogin={handleLogin}
        onLanguageChange={(lang) => {
          handleSaveSettings({ ...settings, language: lang });
        }}
        currentLanguage={settings.language}
      />
    );
  }

  if (authLoading || (isAuthenticated && !currentUser)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] text-gray-500 font-sans text-sm">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Securing your session…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // On the app view but not signed in — send them to the public landing to sign in.
    window.location.href = LANDING_HREF;
    return null;
  }

  return (
    <div className="flex-1 flex flex-col font-sans bg-[var(--bg-app)] text-[var(--text-primary)] selection:bg-blue-600/15 selection:text-blue-800 min-h-screen pb-12">
      {/* Main Responsive Grid Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* SIDE PANEL (md:col-span-4) - Sidebar Controls */}
          <div className="md:col-span-4 flex flex-col gap-6">
            
            {/* Premium Compact User Identity Profile Card */}
            <div id="logged-in-profile" className="p-4 rounded-2xl bg-white card-theme border border-[#E5E5EA] shadow-2xs flex flex-col gap-3 font-sans">
              <div className="flex items-center gap-3">
                {avatarImg ? (
                  <img 
                    src={avatarImg} 
                    alt="User Avatar" 
                    className="w-10 h-10 rounded-full object-cover border border-blue-200 shadow-inner shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm border border-blue-200 uppercase shrink-0">
                    {(localProfileName || currentUser?.displayName || currentUser?.email || "US").slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1 font-sans">
                  <h3 className="text-xs font-black text-[#1C1C1E] text-primary-theme truncate font-sans">
                    {localProfileName || currentUser.displayName || "NoteWave Inventor"}
                  </h3>
                  <p className="text-[10px] text-gray-550 truncate font-mono font-bold text-gray-500">
                    {currentUser.email}
                  </p>
                </div>
                <button
                  id="sign-out-dashboard-btn"
                  onClick={handleSignOut}
                  className="p-2 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-650 text-gray-500 border border-[#D1D1D6] hover:border-red-200 transition-all cursor-pointer animate-fade-in"
                  title="Sign Out of Dashboard"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
              <div className={`p-2.5 ${isCloudOnline ? 'bg-green-50/70 border-green-150 text-green-700' : 'bg-amber-50/70 border-amber-150 text-amber-700'} border rounded-xl flex items-center gap-2 text-[10.5px] font-sans font-bold leading-normal`}>
                <span className={`w-2 h-2 rounded-full ${isCloudOnline ? 'bg-green-500 animate-pulse' : 'bg-amber-500'} shrink-0`} />
                <span>☁️ {isCloudOnline ? (cloudSyncText[settings.language || "en"] || cloudSyncText.en) : "Cloud Sync Offline"}</span>
              </div>
            </div>

            {/* Navigation Tab Menu Widget */}
            <div className="flex flex-col gap-1.5 bg-white card-theme p-2.5 rounded-2xl border border-[#E5E5EA] shadow-xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8E8E93] px-2 mb-1 block">
                {t.workspaceTabs}
              </span>
              <button
                id="tab-dictate"
                onClick={() => setActiveTab("dictate")}
                className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold tracking-tight flex items-center justify-between transition-all cursor-pointer ${
                  activeTab === "dictate"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                    : "text-gray-600 hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  <span>{t.tabDictate}</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                  activeTab === "dictate" ? "bg-blue-700/55 text-white" : "bg-gray-100 text-gray-500"
                }`}>REC</span>
              </button>

              <button
                id="tab-tasks"
                onClick={() => setActiveTab("tasks")}
                className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold tracking-tight flex items-center justify-between transition-all cursor-pointer ${
                  activeTab === "tasks"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                    : "text-gray-600 hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4" />
                  <span>{tabTasksText[settings.language || "en"] || tabTasksText.en}</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                  activeTab === "tasks" ? "bg-blue-700/55 text-white" : "bg-gray-100 text-gray-500"
                }`}>{notes.filter((n) => n.category === "reminders").length}</span>
              </button>

              <button
                id="tab-history"
                onClick={() => setActiveTab("history")}
                className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold tracking-tight flex items-center justify-between transition-all cursor-pointer ${
                  activeTab === "history"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                    : "text-gray-600 hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  <span>{t.tabHistory}</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                  activeTab === "history" ? "bg-blue-700/55 text-white" : "bg-gray-100 text-gray-500"
                }`}>{notes.filter((n) => (n.category || "ideas") === "ideas").length}</span>
              </button>

              <button
                id="tab-ai-agent"
                onClick={() => setActiveTab("ai_agent")}
                className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold tracking-tight flex items-center justify-between transition-all cursor-pointer ${
                  activeTab === "ai_agent"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                    : "text-gray-600 hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>{settings.language === "es" ? "Agente de IA" : "AI Agent"}</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                  activeTab === "ai_agent" ? "bg-blue-700/55 text-white" : "bg-purple-100 text-purple-700 font-bold"
                }`}>NEW</span>
              </button>

              <button
                id="tab-settings"
                onClick={() => setActiveTab("settings")}
                className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold tracking-tight flex items-center justify-between transition-all cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                    : "text-gray-600 hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4" />
                  <span>{t.tabSettings}</span>
                </div>
                <span className="text-[10px] font-mono text-gray-400">CONFIG</span>
              </button>
            </div>

            {/* Always visible Idea Generator widget in side column to assist dictation brainstorms */}
            <IdeaGenerator
              isTriggeredByActionBtn={triggerBrainstorm}
              onClearTrigger={() => setTriggerBrainstorm(false)}
              language={settings.language}
            />
          </div>

          {/* MAIN COLUMN (md:col-span-8) - Core Workspace Area */}
          <div className="md:col-span-8 flex flex-col gap-6">
            <div className="flex-1 flex flex-col gap-4 min-h-[500px]">
              {activeTab === "dictate" && (
                <div className="flex flex-col gap-5">
                  {/* Beautiful visual segmented picker to choose input source */}
                  <div className="grid grid-cols-2 p-1 bg-white card-theme rounded-2xl border border-[#E5E5EA] max-w-md w-full mx-auto shadow-2xs font-sans">
                    <button
                      id="mode-voice-toggle"
                      onClick={() => setInputMode("voice")}
                      className={`py-2 px-4 rounded-xl text-xs font-black tracking-tight flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        inputMode === "voice"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-600 hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{modeDictateText[settings.language || "en"] || modeDictateText.en}</span>
                    </button>
                    <button
                      id="mode-upload-toggle"
                      onClick={() => setInputMode("upload")}
                      className={`py-2 px-4 rounded-xl text-xs font-black tracking-tight flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        inputMode === "upload"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-600 hover:text-[#1C1C1E] hover:bg-[#F2F2F7]"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{modeUploadText[settings.language || "en"] || modeUploadText.en}</span>
                    </button>
                  </div>

                  {inputMode === "voice" ? (
                    <RecordingSlate
                      onRecordingComplete={handleAddNewNote}
                      onUpdateNote={updateNote}
                      tier={settings.tier}
                      customApiKey={settings.customApiKey}
                      isTriggeredByActionBtn={triggerRecord}
                      onClearTrigger={() => setTriggerRecord(false)}
                      language={settings.language}
                    />
                  ) : (
                    <TextUploadSlate
                      onUploadComplete={async (newNote) => {
                        const ok = await handleAddNewNote(newNote);
                        if (ok) setActiveTab("history"); // Jump to history to watch it fill in
                        return ok;
                      }}
                      onUpdateNote={updateNote}
                      tier={settings.tier}
                      customApiKey={settings.customApiKey}
                      language={settings.language}
                    />
                  )}

                  <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 text-xs text-blue-700 leading-relaxed font-semibold">
                    💡 <strong>{t.proTipLabel}:</strong> {inputMode === "voice" ? t.proTipContent : (importInfoText[settings.language || "en"] || importInfoText.en)}
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <NotesHistory
                  notes={notes}
                  onDeleteNote={handleDeleteNote}
                  onToggleActionItem={handleToggleActionItem}
                  onAddManualNote={handleAddNewNote}
                  onUpdateNote={updateNote}
                  language={settings.language}
                  tier={settings.tier}
                  customApiKey={settings.customApiKey}
                />
              )}

              {activeTab === "tasks" && (
                <TasksWorkspace
                  notes={notes}
                  onDeleteNote={handleDeleteNote}
                  onToggleActionItem={handleToggleActionItem}
                  onAddManualNote={handleAddNewNote}
                  onUpdateNote={updateNote}
                  language={settings.language}
                />
              )}

              {activeTab === "ai_agent" && (
                <AIAgentWorkspace
                  notes={notes}
                  language={settings.language}
                  tier={settings.tier}
                  customApiKey={settings.customApiKey}
                />
              )}

              {activeTab === "settings" && (
                <div className="flex flex-col gap-6 w-full">
                  <SupabaseSyncPanel
                    currentUser={currentUser}
                    onUserChange={handleUserChange}
                    syncRecordingsToSupabase={syncRecordingsToSupabase}
                    localCount={notes.length}
                    isCloudOnline={isCloudOnline}
                    onSignOut={handleSignOut}
                  />
                  <SettingsPanel
                    settings={settings}
                    onSaveSettings={handleSaveSettings}
                    currentUser={currentUser}
                    notes={notes}
                    onDeleteAllNotes={handleDeleteAllNotes}
                    langDict={t}
                    onUpdateProfileName={setLocalProfileName}
                    avatarImg={avatarImg}
                    onUpdateAvatar={handleUpdateAvatar}
                  />
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* BILINGUAL SIMULATED CHECKOUT MODAL */}
      {showUpgradeCheckout && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-fadeIn">
          <div className="bg-white rounded-3xl border border-[#E5E5EA] shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col md:grid md:grid-cols-12 max-h-[92vh]">
            
            {/* Left Side: Premium Benefits Accent Box (Cols 5) */}
            <div className="md:col-span-5 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 text-white flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-6">
                  <span className="text-xl">👑</span>
                  <span className="font-mono text-xs font-black tracking-widest text-[var(--accent-color)] uppercase">
                    NoteWave Pro
                  </span>
                </div>

                <h3 className="text-lg md:text-xl font-extrabold tracking-tight leading-snug">
                  {settings.language === "es" ? "Hazte NoteWave Pro" : "Upgrade to NoteWave Pro"}
                </h3>
                <p className="text-[10px] md:text-xs text-slate-300 mt-2 font-medium leading-relaxed">
                  {settings.language === "es"
                    ? "Más almacenamiento y procesamiento de voz a acción todo el día con Gemini, pensado para que nunca pienses en los límites."
                    : "More storage and all-day Speech-to-Action processing powered by Gemini — built so you never think about limits."}
                </p>

                {/* Benefits List */}
                <div className="flex flex-col gap-3.5 mt-6 font-sans">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xs text-[var(--accent-color)] mt-0.5">⚡</span>
                    <div className="text-[11px] leading-tight">
                      <strong className="block text-white">
                        {settings.language === "es" ? "Bóveda segura de 1 GB" : "1 GB Secure Cloud Vault"}
                      </strong>
                      <span className="text-slate-300">
                        {settings.language === "es" ? "Guarda toda tu biblioteca de voz y notas con copia de seguridad" : "Back up your entire voice & note library, safely"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="text-xs text-[var(--accent-color)] mt-0.5">🎙️</span>
                    <div className="text-[11px] leading-tight">
                      <strong className="block text-white">
                        {settings.language === "es" ? "Captura con IA todo el día" : "All-Day AI Capture"}
                      </strong>
                      <span className="text-slate-300">
                        {settings.language === "es" ? "Hasta 50 notas con IA al día: de sobra para no tocar nunca un límite" : "Up to 50 AI notes a day — plenty to never hit a wall"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="text-xs text-[var(--accent-color)] mt-0.5">📄</span>
                    <div className="text-[11px] leading-tight">
                      <strong className="block text-white">
                        {settings.language === "es" ? "Importación de texto y archivos" : "Instant Text & File Imports"}
                      </strong>
                      <span className="text-slate-300">
                        {settings.language === "es" ? "Convierte documentos y notas largas en acciones al instante" : "Turn documents and long notes into action items in seconds"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="text-xs text-[var(--accent-color)] mt-0.5">🧠</span>
                    <div className="text-[11px] leading-tight">
                      <strong className="block text-white">
                        {settings.language === "es" ? "Procesamiento Gemini prioritario" : "Priority Gemini Processing"}
                      </strong>
                      <span className="text-slate-300">
                        {settings.language === "es" ? "Transcripciones más rápidas y resúmenes de alta fidelidad" : "Faster, higher-fidelity transcripts & summaries"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-slate-800 pt-4 flex items-center justify-between text-[10px] text-slate-400 select-none">
                <span className="flex items-center gap-1">
                  🔒 {settings.language === "es" ? "Seguro" : "SSL Encrypted"}
                </span>
                <span>Powered by Stripe</span>
              </div>
            </div>

            {/* Right Side: Interactive Checkout Engine (Cols 7) */}
            <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#F2F2F7] pb-4 mb-4 select-none">
                <div>
                  <h4 className="text-xs font-extrabold text-[#1C1C1E] uppercase tracking-wider">
                    {settings.language === "es" ? "Pago Seguro" : "Secure Checkout"}
                  </h4>
                  {limitErrorMsg && (
                    <p className="text-[10px] text-red-600 font-bold mt-1 max-w-md bg-red-50 p-2 rounded-lg border border-red-105">
                      ⚠️ {limitErrorMsg}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowUpgradeCheckout(false);
                    setCheckoutStep("form");
                    setLimitErrorMsg(null);
                  }}
                  className="p-1 px-2.5 rounded-lg hover:bg-slate-100 text-gray-500 font-mono font-black border border-[#E5E5EA] transition-colors cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Step 1: Form Filling */}
              {checkoutStep === "form" && (
                <div className="flex flex-col gap-4 font-sans max-h-[70vh] overflow-y-auto pr-1">
                  
                  {/* Grid of cycle selections */}
                  <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-[#E5E5EA]">
                    <button
                      type="button"
                      onClick={() => setBillingCycle("monthly")}
                      className={`py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                        billingCycle === "monthly" 
                        ? "bg-white text-blue-600 shadow-xs border border-[#D1D1D6]" 
                        : "text-gray-500"
                      }`}
                    >
                      {settings.language === "es" ? "Mensual ($9.00 / mes)" : "Monthly ($9.00 / mo)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle("yearly")}
                      className={`py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                        billingCycle === "yearly" 
                        ? "bg-white text-indigo-600 shadow-xs border border-[#D1D1D6]" 
                        : "text-gray-400"
                      }`}
                    >
                      {settings.language === "es" ? "Anual ($79.00 / año - Ahorra 25%)" : "Yearly ($79.00 / yr - Save 25%)"}
                    </button>
                  </div>

                  {/* Credit Card Mock Visual */}
                  <div className="relative h-28 rounded-2xl bg-gradient-to-tr from-[var(--accent-color)] to-[var(--accent-color-hover)] text-white p-4 flex flex-col justify-between shadow-md select-none font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/90">
                        NoteWave Premium
                      </span>
                      <span className="text-lg font-black italic">VISA</span>
                    </div>

                    <div className="text-sm font-bold tracking-widest text-white drop-shadow-2xs">
                      {cardNumber || "•••• •••• •••• ••••"}
                    </div>

                    <div className="flex justify-between text-[10px] text-white font-bold">
                      <div className="truncate max-w-[150px]">
                        {cardName.toUpperCase() || "NAME SURNAME"}
                      </div>
                      <div className="flex gap-3">
                        <div>
                          <span className="text-[7.5px] uppercase block leading-none text-white/70">Valid Thru</span>
                          <span>{cardExpiry || "MM/YY"}</span>
                        </div>
                        <div>
                          <span className="text-[7.5px] uppercase block leading-none text-white/70">CVC</span>
                          <span>{cardCvc || "•••"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Manual Inputs Structure */}
                  <div className="flex flex-col gap-3 text-xs font-semibold">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between">
                        <label className="text-gray-600 text-[10px] uppercase font-bold tracking-wide">
                          {settings.language === "es" ? "Nombre del Titular" : "Cardholder Name"}
                        </label>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Jane Doe"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="py-2 px-3 border border-[#E5E5EA] rounded-xl outline-hidden focus:border-[var(--accent-color)] transition-colors font-medium bg-[#fdfdfd]"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-gray-600 text-[10px] uppercase font-bold tracking-wide">
                        {settings.language === "es" ? "Número de Tarjeta" : "Card Number"}
                      </label>
                      <input
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        value={cardNumber}
                        onChange={(e) => handleCardNumberChange(e.target.value)}
                        className="py-2 px-3 border border-[#E5E5EA] rounded-xl outline-hidden focus:border-[var(--accent-color)] transition-colors font-mono font-bold bg-[#fdfdfd]"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-gray-600 text-[10px] uppercase font-bold tracking-wide">
                          {settings.language === "es" ? "Vencimiento" : "MM/YY"}
                        </label>
                        <input
                          type="text"
                          placeholder="01/29"
                          value={cardExpiry}
                          onChange={(e) => handleExpiryChange(e.target.value)}
                          className="py-2 px-3 border border-[#E5E5EA] rounded-xl outline-hidden text-center focus:border-[var(--accent-color)] transition-colors font-mono font-bold bg-[#fdfdfd]"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-gray-600 text-[10px] uppercase font-bold tracking-wide">CVV</label>
                        <input
                          type="password"
                          placeholder="123"
                          value={cardCvc}
                          onChange={(e) => handleCvcChange(e.target.value)}
                          className="py-2 px-3 border border-[#E5E5EA] rounded-xl outline-hidden text-center focus:border-[var(--accent-color)] transition-colors font-mono font-bold bg-[#fdfdfd]"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-gray-600 text-[10px] uppercase font-bold tracking-wide">Zip Code</label>
                        <input
                          type="text"
                          maxLength={5}
                          placeholder="90210"
                          className="py-2 px-3 border border-[#E5E5EA] rounded-xl outline-hidden text-center focus:border-[var(--accent-color)] transition-colors font-mono font-bold bg-[#fdfdfd]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action CTA */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!cardName || !cardNumber || !cardExpiry || !cardCvc) {
                        alert(settings.language === "es"
                          ? "Por favor, complete todos los datos de la tarjeta para continuar."
                          : "Please fill out all billing card details to continue.");
                        return;
                      }
                      startCheckoutSimulation();
                    }}
                    className="w-full mt-2 py-3 uppercase tracking-wider text-xs font-black bg-[var(--accent-color)] hover:bg-[var(--accent-color-hover)] text-white rounded-2xl transition-all hover:scale-101 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    💳 {settings.language === "es" ? "Pagar de Forma Segura" : "Pay Securely"} ({billingCycle === "monthly" ? "$9.00" : "$79.00"})
                  </button>
                </div>
              )}

              {/* Step 2: Processing Milestones */}
              {checkoutStep === "processing" && (
                <div className="flex flex-col items-center justify-center text-center gap-6 py-6 font-sans">
                  <div className="relative flex items-center justify-center w-16 h-16">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent-color-light)] animate-ping opacity-75" />
                    <div className="w-12 h-12 rounded-full border-4 border-[var(--accent-color)] border-t-transparent animate-spin" />
                  </div>

                  <div>
                    <h5 className="text-sm font-extrabold text-[#1C1C1E]">
                      {settings.language === "es" ? "Procesamiento de Autorización SSL..." : "Synchronizing Secure AuthSSL Connection..."}
                    </h5>
                    <p className="text-[10px] text-gray-400 mt-1 font-semibold">
                      Please don't close this window while we process your payment.
                    </p>
                  </div>

                  {/* Live Transaction Milestones Log list */}
                  <div className="w-full max-w-sm bg-slate-50 border border-[#E5E5EA] rounded-2xl p-4 text-left flex flex-col gap-2 font-mono text-[10px]">
                    <div className={`flex items-center gap-2 ${activeLogIdx >= 1 ? "text-green-650" : "text-gray-400"}`}>
                      <span>{activeLogIdx >= 1 ? "✅" : "⏳"}</span>
                      <span className={activeLogIdx === 1 ? "font-bold animate-pulse text-[var(--accent-color)]" : ""}>
                        {settings.language === "es" ? "1. Canal seguro SSL con Stripe inicializado..." : "1. Initializing SSL connection with Stripe engine..."}
                      </span>
                    </div>

                    <div className={`flex items-center gap-2 ${activeLogIdx >= 2 ? "text-green-650" : "text-gray-400"}`}>
                      <span>{activeLogIdx >= 2 ? "✅" : "⏳"}</span>
                      <span className={activeLogIdx === 2 ? "font-bold animate-pulse text-[var(--accent-color)]" : ""}>
                        {settings.language === "es" ? "2. Validando firmas criptográficas de la tarjeta..." : "2. Validating cryptographical card token signatures..."}
                      </span>
                    </div>

                    <div className={`flex items-center gap-2 ${activeLogIdx >= 3 ? "text-green-650" : "text-gray-400"}`}>
                      <span>{activeLogIdx >= 3 ? "✅" : "⏳"}</span>
                      <span className={activeLogIdx === 3 ? "font-bold animate-pulse text-[var(--accent-color)]" : ""}>
                        {settings.language === "es" ? "3. Autorizando los fondos con tu banco..." : "3. Transferring authorization request to gateway router..."}
                      </span>
                    </div>

                    <div className={`flex items-center gap-2 ${activeLogIdx >= 4 ? "text-green-650" : "text-gray-400"}`}>
                      <span>{activeLogIdx >= 4 ? "✅" : "⏳"}</span>
                      <span className={activeLogIdx === 4 ? "font-bold animate-pulse text-[var(--accent-color)]" : ""}>
                        {settings.language === "es" ? "4. Sincronizando privilegios de NoteWave Pro..." : "4. Handshaking NoteWave Pro vaults & database limits..."}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Success Victory Celebration Page */}
              {checkoutStep === "success" && (
                <div className="flex flex-col items-center justify-center text-center gap-5 py-6 font-sans">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center border border-green-200 shadow-xs animate-bounce scale-110">
                    <span className="text-3xl text-green-600">🎉</span>
                  </div>

                  <div>
                    <h5 className="text-lg font-black text-[#1C1C1E]">
                      {settings.language === "es" ? "¡Pago Autorizado con Éxito!" : "Transaction Fully Authorized!"}
                    </h5>
                    <p className="text-xs text-green-700 font-bold mt-1 bg-green-50 px-3 py-1.5 rounded-xl border border-green-100">
                      ✨ {settings.language === "es" ? "¡Has desbloqueado NoteWave Pro con éxito!" : "NoteWave Pro subscription has been synced successfully!"}
                    </p>
                  </div>

                  <p className="text-[10px] text-gray-500 leading-relaxed font-semibold max-w-sm">
                    {settings.language === "es" 
                      ? "Se ha activado su plan ilimitado de 1 GB de caché. Ya puede procesar archivos de voz prolongados y documentos adicionales sin trabas." 
                      : "Your 1 GB Cloud Database storage limits are now active. Standard file restrictions and transcription blocks have been lifted and premium AI routing is live."}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUpgradeCheckout(false);
                      setCheckoutStep("form");
                      setLimitErrorMsg(null);
                      // Move user automatically to active settings or history to see Pro elements!
                      setActiveTab("settings");
                    }}
                    className="w-full max-w-xs py-2.5 uppercase tracking-wider text-[11px] font-black bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    👑 {settings.language === "es" ? "Lanzar NoteWave Pro ahora" : "Launch NoteWave Pro Experience"}
                  </button>
                </div>
              )}

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
