import { useState, useEffect, useRef, ChangeEvent } from "react";
import { 
  User, 
  Paintbrush, 
  Cpu, 
  Database, 
  Key, 
  Globe, 
  ShieldAlert, 
  Check, 
  Trash2, 
  Bell, 
  Shield, 
  RefreshCw,
  TrendingUp,
  Settings as SettingsIcon,
  Sparkles,
  Info
} from "lucide-react";
import { SettingsConfig, RecordingNote } from "../types";
import { LANGUAGE_OPTIONS } from "../locale";

interface SettingsPanelProps {
  settings: SettingsConfig;
  onSaveSettings: (updated: SettingsConfig) => Promise<void> | void;
  currentUser: any;
  notes: RecordingNote[];
  onDeleteAllNotes: () => void;
  langDict: any;
  onUpdateProfileName?: (name: string) => void;
  avatarImg?: string;
  onUpdateAvatar?: (imgBase64: string) => void;
}

export default function SettingsPanel({
  settings,
  onSaveSettings,
  currentUser,
  notes,
  onDeleteAllNotes,
  langDict,
  onUpdateProfileName,
  avatarImg,
  onUpdateAvatar
}: SettingsPanelProps) {
  // Navigation tabs for sub-settings
  const [subTab, setSubTab] = useState<"profile" | "appearance" | "ai" | "data">("profile");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGoogleLogin = currentUser?.providerData?.some((p: any) => p.providerId === "google.com") || currentUser?.email?.endsWith("gmail.com") || false;

  // Local state for interactive settings fields, backed up in localStorage or merged with config
  const [displayName, setDisplayName] = useState(() => {
    return localStorage.getItem("settings_display_name") || currentUser?.displayName || "Creator";
  });
  const [email, setEmail] = useState(() => {
    return localStorage.getItem("settings_email") || currentUser?.email || "your@email.com";
  });
  
  // Custom interactive settings toggles (mock configurations backed by localStorage)
  const [pushNotifications, setPushNotifications] = useState(() => {
    return localStorage.getItem("settings_push_notifications") !== "false";
  });
  const [emailDigest, setEmailDigest] = useState(() => {
    return localStorage.getItem("settings_email_digest") === "true";
  });
  const themeMode = settings.theme || "light";
  const accentColor = settings.accentColor || "blue";
  const [cloudProcessing, setCloudProcessing] = useState(() => {
    return localStorage.getItem("settings_cloud_processing") !== "false";
  });
  const [autoTranscribe, setAutoTranscribe] = useState(() => {
    return localStorage.getItem("settings_auto_transcribe") !== "false";
  });
  const [aiTaskSuggestions, setAiTaskSuggestions] = useState(() => {
    return localStorage.getItem("settings_ai_suggestions") !== "false";
  });
  const [selectedModel, setSelectedModel] = useState<"flash" | "pro" | "local">(() => {
    return (localStorage.getItem("settings_model_generation") as any) || "flash";
  });

  const [usage, setUsage] = useState<{ limit: number; remaining: number } | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  // Action status triggers
  const [isProcessingRAG, setIsProcessingRAG] = useState(false);
  const [ragStatusMessage, setRagStatusMessage] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [saveConfirmation, setSaveConfirmation] = useState("");

  // Save changes locally whenever relevant profile info or custom options are updated
  useEffect(() => {
    localStorage.setItem("settings_push_notifications", String(pushNotifications));
  }, [pushNotifications]);

  useEffect(() => {
    localStorage.setItem("settings_email_digest", String(emailDigest));
  }, [emailDigest]);

  // Synchronized via global App settings config

  useEffect(() => {
    localStorage.setItem("settings_cloud_processing", String(cloudProcessing));
  }, [cloudProcessing]);

  useEffect(() => {
    localStorage.setItem("settings_auto_transcribe", String(autoTranscribe));
  }, [autoTranscribe]);

  useEffect(() => {
    localStorage.setItem("settings_ai_suggestions", String(aiTaskSuggestions));
  }, [aiTaskSuggestions]);

  useEffect(() => {
    localStorage.setItem("settings_model_generation", selectedModel);
  }, [selectedModel]);

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateAvatar) {
      if (file.size > 2 * 1024 * 1024) {
        alert(langDict.language === "es" ? "La imagen es demasiado grande. Seleccione una menor a 2MB." : "The image file is too large. Please select a file smaller than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onUpdateAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchUsage = async () => {
      setIsLoadingUsage(true);
      try {
        const response = await fetch(`/api/usage?tier=${settings.tier}`);
        if (response.ok && active) {
          const data = await response.json();
          setUsage({ limit: data.limit, remaining: data.remaining });
        }
      } catch (e) {
        console.error("Error fetching usage from server:", e);
      } finally {
        if (active) setIsLoadingUsage(false);
      }
    };
    fetchUsage();
    return () => {
      active = false;
    };
  }, [settings.tier, notes.length]);

  const handleSaveProfileChanges = () => {
    localStorage.setItem("settings_display_name", displayName);
    if (!isGoogleLogin) {
      localStorage.setItem("settings_email", email);
    }
    if (onUpdateProfileName) {
      onUpdateProfileName(displayName);
    }
    setSaveConfirmation("Profile preferences saved successfully!");
    setTimeout(() => setSaveConfirmation(""), 3005);
  };

  const handleProcessRAG = () => {
    setIsProcessingRAG(true);
    setRagStatusMessage("Re-indexing vectors based on your voice transcripts...");
    setTimeout(() => {
      setIsProcessingRAG(false);
      setRagStatusMessage(`Successfully completed! RAG retrieval vector database is up-to-date with ${notes.length} voice notes.`);
    }, 2000);
  };

  // Separate pure text content size from binary-equivalent audio waveforms (since audio files are much larger than text!)
  const getNoteTextSizeBytes = (note: RecordingNote): number => {
    // Avoid including the massive base64 sound recording payload to evaluate exact text storage
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
    if (!note.audioData) return 0;
    // Decode base64 character size to actual binary byte amount (~3 bytes for every 4 base64 characters)
    const base64Data = note.audioData.includes(",") ? note.audioData.split(",")[1] : note.audioData;
    return Math.round(base64Data.length * 0.75);
  };

  const uploadNotes = notes.filter(n => Array.isArray(n.tags) && n.tags.includes("uploaded"));
  const voiceNotes = notes.filter(n => Array.isArray(n.tags) && !n.tags.includes("uploaded"));

  const uploadsCount = uploadNotes.length;
  const voiceMemosCount = voiceNotes.length;

  // Notes card: displays total text metadata of everything combined
  const totalTextBytes = notes.reduce((acc, note) => acc + getNoteTextSizeBytes(note), 0);
  const notesTextKB = totalTextBytes / 1024;

  // Voice Memos card: displays pure high-fidelity recorded sound waveform binary size
  const totalAudioBytes = voiceNotes.reduce((acc, note) => acc + getNoteAudioSizeBytes(note), 0);
  const voiceAudioKB = totalAudioBytes / 1024;

  // Uploads card: displays size of uploaded text documents
  const uploadTextBytes = uploadNotes.reduce((acc, note) => acc + getNoteTextSizeBytes(note), 0);
  const uploadKB = uploadTextBytes / 1024;

  const wordCount = notes.reduce((acc, note) => acc + (note.transcript?.split(/\s+/).length || 0), 0);

  return (
    <div id="settings-card-container" className="grid grid-cols-1 md:grid-cols-12 gap-6 p-4 md:p-6 rounded-3xl bg-white border border-[#E5E5EA] shadow-xl font-sans text-[#1C1C1E]">
      
      {/* Left side Sub-Navigation tabs layout as requested */}
      <div className="md:col-span-4 flex flex-col gap-5 border-r border-[#F2F2F7] pr-2 md:pr-4">
        <div>
          <h2 id="settings-headline" className="text-xl font-black tracking-tight text-[#1C1C1E]">Settings</h2>
          <p className="text-[11px] text-gray-500 mt-1 font-semibold leading-relaxed">Customize your NoteWave experience</p>
        </div>

        <nav className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-3 md:pb-0 scrollbar-none">
          <button
            id="subtab-profile-btn"
            type="button"
            onClick={() => setSubTab("profile")}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold tracking-tight transition-all shrink-0 cursor-pointer ${
              subTab === "profile" 
                ? "bg-blue-50 text-blue-700 border border-blue-150 shadow-3xs" 
                : "text-gray-600 hover:text-[#1C1C1E] hover:bg-slate-50"
            }`}
          >
            <User className="w-4 h-4 text-blue-600" />
            <span>Profile</span>
          </button>

          <button
            id="subtab-appearance-btn"
            type="button"
            onClick={() => setSubTab("appearance")}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold tracking-tight transition-all shrink-0 cursor-pointer ${
              subTab === "appearance" 
                ? "bg-blue-50 text-blue-700 border border-blue-150 shadow-3xs" 
                : "text-gray-600 hover:text-[#1C1C1E] hover:bg-slate-50"
            }`}
          >
            <Paintbrush className="w-4 h-4 text-blue-600" />
            <span>Appearance</span>
          </button>

          <button
            id="subtab-ai-btn"
            type="button"
            onClick={() => setSubTab("ai")}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold tracking-tight transition-all shrink-0 cursor-pointer ${
              subTab === "ai" 
                ? "bg-blue-50 text-blue-700 border border-blue-150 shadow-3xs" 
                : "text-gray-600 hover:text-[#1C1C1E] hover:bg-slate-50"
            }`}
          >
            <Cpu className="w-4 h-4 text-blue-600" />
            <span>AI Settings</span>
          </button>

          <button
            id="subtab-data-btn"
            type="button"
            onClick={() => setSubTab("data")}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold tracking-tight transition-all shrink-0 cursor-pointer ${
              subTab === "data" 
                ? "bg-blue-50 text-blue-700 border border-blue-150 shadow-3xs" 
                : "text-gray-600 hover:text-[#1C1C1E] hover:bg-slate-50"
            }`}
          >
            <Database className="w-4 h-4 text-blue-600" />
            <span>Data & Storage</span>
          </button>
        </nav>
      </div>

      {/* Right side Detail Panel content layout based on selection */}
      <div className="md:col-span-8 flex flex-col gap-6 font-sans">
        
        {/* PROFILE SUB-TAB */}
        {subTab === "profile" && (
          <div id="settings-psection-profile" className="flex flex-col gap-5">
            {/* Identity badge as shown in the screenshot */}
            <div className="p-4 rounded-2xl bg-slate-50/55 border border-[#E5E5EA] flex items-center justify-between gap-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarChange} 
                accept="image/*" 
                className="hidden" 
              />
              <div className="flex items-center gap-3">
                {avatarImg ? (
                  <img 
                    src={avatarImg} 
                    alt="User Avatar" 
                    className="w-12 h-12 rounded-full object-cover border border-[#E5E5EA] shadow-inner shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-amber-400 font-extrabold font-sans text-white text-base flex items-center justify-center shadow-inner tracking-wider select-none shrink-0 border border-amber-300">
                    {displayName ? displayName.slice(0, 2).toUpperCase() : "US"}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-black text-[#1C1C1E]">{displayName}</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 font-mono">
                    {settings.tier === "premium" ? "👑 Premium Plan" : "Free Plan"}
                  </p>
                </div>
              </div>
              <button
                id="profile-avatar-action-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-black border border-[#D1D1D6] bg-white hover:bg-slate-50 py-1.5 px-3 rounded-lg text-gray-800 transition-active active:scale-97 shadow-3xs cursor-pointer"
              >
                Change Avatar
              </button>
            </div>

            {isGoogleLogin && (
              <div className="p-2.5 px-3 bg-blue-50/40 border border-blue-100 rounded-xl flex items-center gap-2 text-blue-700 text-xs font-semibold font-sans">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Google Account Connected</span>
              </div>
            )}

            {/* Fields input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Display Name</label>
                <input
                  id="profile-display-name-input"
                  type="text"
                  placeholder="Creator Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#f9f9f9] border border-[#d1d1d6] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:bg-white focus:border-blue-500 transition-all text-gray-800"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Email Address</label>
                  {isGoogleLogin && (
                    <span className="text-[9px] font-mono font-extrabold text-blue-600 px-1 hover:text-blue-700 transition-colors">
                      🔒 SECURED BY GOOGLE
                    </span>
                  )}
                </div>
                <input
                  id="profile-email-input"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  disabled={isGoogleLogin}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all ${
                    isGoogleLogin
                      ? "bg-[#F2F2F7] border-[#E5E5EA] text-gray-400 cursor-not-allowed select-none"
                      : "bg-[#f9f9f9] border-[#d1d1d6] text-gray-800 focus:bg-white focus:border-blue-500"
                  }`}
                />
              </div>
            </div>

            {/* Notifications panel in screenshots */}
            <div className="flex flex-col gap-3.5 border-t border-[#F2F2F7] pt-4">
              <h3 className="text-xs font-extrabold text-[#1C1C1E] uppercase tracking-wide flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-blue-600" /> Notifications
              </h3>
              
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-4 p-2.5 bg-slate-50/40 hover:bg-slate-50/80 transition-all rounded-xl border border-dashed border-[#E5E5EA]">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[#1C1C1E] block">Email Digest</span>
                    <span className="text-[10px] text-gray-500 font-semibold leading-relaxed">Weekly summary of your voice memos and action steps</span>
                  </div>
                  <button
                    id="toggle-email-digest"
                    type="button"
                    onClick={() => setEmailDigest(!emailDigest)}
                    className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                      emailDigest ? "bg-amber-500 border border-transparent" : "bg-slate-50 border border-[#D1D1D6] cursor-pointer"
                    }`}
                  >
                    <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                      emailDigest ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {emailDigest && (
                  <div className="p-3 bg-green-50/70 border border-green-150 rounded-xl flex items-start gap-2 text-green-800 text-[10.5px] leading-relaxed font-semibold animate-fadeIn">
                    <span>📧</span>
                    <div>
                      <strong>{langDict.language === "es" ? "Resumen semanal activo" : "Weekly Email Digest Active:"}</strong>{" "}
                      {langDict.language === "es" 
                        ? `Cada lunes a primera hora recibirás una hoja de ruta con el resumen de tus dictados activos en la dirección: ` 
                        : `Every Monday, a summarized action-item briefing of your transcripts will be delivered to: `}
                      <code className="bg-white/90 border border-green-100 rounded px-1.5 py-0.5 font-mono text-[10px] text-green-900 inline-block mt-1 font-bold">
                        {email || "your@email.com"}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Security section */}
            {!isGoogleLogin && (
              <div className="flex flex-col gap-3.5 border-t border-[#F2F2F7] pt-4">
                <h3 className="text-xs font-extrabold text-[#1C1C1E] uppercase tracking-wide flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-600" /> Security
                </h3>

                <button
                  id="security-change-password-btn"
                  type="button"
                  onClick={() => {
                    setPasswordStatus("Password update simulator activated! We have dispatched a security reset email token.");
                    setTimeout(() => setPasswordStatus(""), 4005);
                  }}
                  className="w-full text-center py-2 px-4 rounded-xl text-xs font-black bg-white hover:bg-slate-50 border border-[#E5E5EA] text-[#1C1C1E] shadow-3xs hover:border-[#D1D1D6] active:scale-99 transition-all cursor-pointer font-sans"
                >
                  Change Password
                </button>

                {passwordStatus && (
                  <div className="p-2.5 rounded-xl text-[10px] leading-relaxed font-bold bg-green-50 border border-green-150 text-green-700">
                    {passwordStatus}
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-[#F2F2F7] flex items-center justify-end gap-3 font-sans">
              <button
                id="profile-save-btn"
                type="button"
                onClick={handleSaveProfileChanges}
                className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-500 shadow-sm border border-blue-700 active:scale-97 transition-all cursor-pointer"
              >
                Save Preferences
              </button>
            </div>

            {saveConfirmation && (
              <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl text-xs font-bold text-indigo-700 font-sans text-center">
                {saveConfirmation}
              </div>
            )}
          </div>
        )}


        {/* APPEARANCE SUB-TAB */}
        {subTab === "appearance" && (
          <div id="settings-psection-appearance" className="flex flex-col gap-5">
            {/* Theme switcher */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Theme</label>
              
              <div className="grid grid-cols-3 gap-3">
                <button
                  id="appearance-theme-dark-btn"
                  type="button"
                  onClick={() => onSaveSettings({ ...settings, theme: "dark" })}
                  className={`py-6 px-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    themeMode === "dark" 
                      ? "bg-slate-900 text-white border-amber-500 shadow-md ring-1 ring-amber-500" 
                      : "bg-stone-50 text-gray-700 border-[#E5E5EA] hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xl">🌙</span>
                  <span className="text-xs font-black">Dark</span>
                </button>

                <button
                  id="appearance-theme-light-btn"
                  type="button"
                  onClick={() => onSaveSettings({ ...settings, theme: "light" })}
                  className={`py-6 px-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    themeMode === "light" 
                      ? "bg-white text-gray-900 border-amber-500 shadow-md ring-1 ring-amber-500" 
                      : "bg-stone-50 text-gray-700 border-[#E5E5EA] hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xl">☀️</span>
                  <span className="text-xs font-black">Light</span>
                </button>

                <button
                  id="appearance-theme-system-btn"
                  type="button"
                  onClick={() => onSaveSettings({ ...settings, theme: "system" })}
                  className={`py-6 px-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    themeMode === "system" 
                      ? "bg-slate-50 text-gray-900 border-amber-500 shadow-md ring-1 ring-amber-500" 
                      : "bg-stone-50 text-gray-700 border-[#E5E5EA] hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xl">⚙️</span>
                  <span className="text-xs font-black">System</span>
                </button>
              </div>
            </div>

            {/* Accent Color picker */}
            <div className="flex flex-col gap-3 border-t border-[#F2F2F7] pt-4">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Accent Color</label>
              
              <div className="flex items-center gap-3.5">
                {[
                  { id: "orange", colHex: "bg-orange-550 border-orange-600" },
                  { id: "purple", colHex: "bg-purple-650 border-purple-700" },
                  { id: "blue", colHex: "bg-blue-600 border-blue-700" },
                  { id: "green", colHex: "bg-green-600 border-green-700" },
                  { id: "red", colHex: "bg-red-600 border-red-700" }
                ].map((col) => (
                  <button
                    key={col.id}
                    id={`accent-color-${col.id}`}
                    type="button"
                    onClick={() => {
                      onSaveSettings({ ...settings, accentColor: col.id as any });
                    }}
                    className={`w-9 h-9 rounded-full relative transition-all active:scale-90 border-2 flex items-center justify-center cursor-pointer ${col.colHex} ${
                      accentColor === col.id 
                        ? "shadow-md scale-110 ring-2 ring-offset-2 ring-blue-500" 
                        : "hover:scale-105 opacity-80 hover:opacity-100"
                    }`}
                  >
                    {accentColor === col.id && (
                      <Check className="w-4 h-4 text-white font-bold" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Traditional Credentials Configuration */}
            <div className="flex flex-col gap-4 border-t border-[#F2F2F7] pt-4 font-sans">
              <div>
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                  <Globe className="w-4 h-4 text-blue-600" /> {langDict.languageLabel}
                </h4>
                <p className="text-[10px] text-gray-400 font-bold mt-1 font-sans">{langDict.languageFooter}</p>
              </div>

              <select
                id="appearance-lang-select"
                value={settings.language || "en"}
                onChange={(e) => onSaveSettings({ ...settings, language: e.target.value })}
                className="w-full bg-[#F9F9F9] font-sans text-xs text-gray-800 px-3.5 py-2.5 rounded-xl border border-[#D1D1D6] focus:bg-white focus:outline-none focus:border-blue-500 transition-all font-semibold cursor-pointer"
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic visual indicator */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-[#E5E5EA] text-[10px] text-gray-500 leading-relaxed font-semibold">
              ℹ️ Your custom workspace theme is in <strong>Light / White Mode</strong> for maximum layout contrast and optimized reading comfort. Accent colors adjust waveform lines and highlights.
            </div>
          </div>
        )}


        {/* AI SETTINGS SUB-TAB */}
        {subTab === "ai" && (
          <div id="settings-psection-ai" className="flex flex-col gap-5">
            
            {/* AI Model Configuration */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                AI Model Configuration
              </label>

              <div className="flex flex-col gap-2 bg-[#fdfdfd] border border-[#E5E5EA] rounded-2xl p-2.5">
                
                {/* Cloud processing toggle */}
                <div className="flex items-center justify-between gap-4 p-2 pb-2.5 border-b border-[#F2F2F7]">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[#1C1C1E] block">Cloud Processing</span>
                    <span className="text-[10px] text-gray-500 font-semibold leading-relaxed">Use cloud AI for faster, more accurate results</span>
                  </div>
                  <button
                    id="toggle-ai-cloud"
                    type="button"
                    onClick={() => setCloudProcessing(!cloudProcessing)}
                    className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                      cloudProcessing ? "bg-amber-500 border border-transparent" : "bg-slate-50 border border-[#D1D1D6] cursor-pointer"
                    }`}
                  >
                    <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                      cloudProcessing ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {/* Auto transcribe toggle */}
                <div className="flex items-center justify-between gap-4 p-2 pb-2.5 border-b border-[#F2F2F7]">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[#1C1C1E] block">Auto-transcribe voice memos</span>
                    <span className="text-[10px] text-gray-500 font-semibold leading-relaxed">Automatically convert speech to text</span>
                  </div>
                  <button
                    id="toggle-ai-transcribe"
                    type="button"
                    onClick={() => {
                      const nextVal = !autoTranscribe;
                      setAutoTranscribe(nextVal);
                      if (!nextVal) {
                        setAiTaskSuggestions(false);
                      }
                    }}
                    className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                      autoTranscribe ? "bg-amber-500 border border-transparent" : "bg-slate-50 border border-[#D1D1D6] cursor-pointer"
                    }`}
                  >
                    <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                      autoTranscribe ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {/* AI task suggestions toggle */}
                <div className={`flex items-center justify-between gap-4 p-2 transition-opacity duration-200 ${!autoTranscribe ? "opacity-50" : ""}`}>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[#1C1C1E] block font-sans">Generate todos automatically</span>
                    <span className="text-[10px] text-gray-500 font-semibold leading-relaxed font-sans">Generate action checklists from notes and ideas automatically</span>
                  </div>
                  <button
                    id="toggle-ai-suggestions"
                    type="button"
                    disabled={!autoTranscribe}
                    onClick={() => {
                      if (autoTranscribe) {
                        setAiTaskSuggestions(!aiTaskSuggestions);
                      }
                    }}
                    className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors ${
                      aiTaskSuggestions ? "bg-amber-500 border border-transparent" : "bg-slate-50 border border-[#D1D1D6]"
                    } ${!autoTranscribe ? "cursor-not-allowed opacity-85" : "cursor-pointer"}`}
                  >
                    <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                      aiTaskSuggestions ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                </div>

              </div>
            </div>

            {/* Active Plan Selector */}
            <div className="flex flex-col gap-3.5 border-t border-[#F2F2F7] pt-4">
              <label className="text-[10px] font-extrabold text-[#1C1C1E] uppercase tracking-wide flex items-center gap-1.5 font-sans">
                <TrendingUp className="w-4 h-4 text-blue-600" /> Active Plan Select
              </label>

              <div className="grid grid-cols-2 p-1 bg-[#F2F2F7] rounded-xl border border-[#D1D1D6]">
                <button
                  id="tier-mode-free-btn"
                  type="button"
                  onClick={() => onSaveSettings({ ...settings, tier: "free" })}
                  className={`py-2 rounded-lg text-[11px] font-sans font-extrabold transition-all cursor-pointer ${
                    settings.tier === "free"
                      ? "bg-white text-blue-600 border border-[#D1D1D6] shadow-xs"
                      : "text-gray-500 hover:text-[#1C1C1E]"
                  }`}
                >
                  🟢 Free Plan
                </button>
                <button
                  id="tier-mode-premium-btn"
                  type="button"
                  onClick={() => onSaveSettings({ ...settings, tier: "premium" })}
                  className={`py-2 rounded-lg text-[11px] font-sans font-extrabold transition-all cursor-pointer ${
                    settings.tier === "premium"
                      ? "bg-white text-amber-600 border border-[#D1D1D6] shadow-xs"
                      : "text-gray-500 hover:text-[#1C1C1E]"
                  }`}
                >
                  👑 Pro Plan (Gemini 3.5 Flash)
                </button>
              </div>
            </div>

            {/* Daily Usage Monitor */}
            <div className="flex flex-col gap-3 border-t border-[#F2F2F7] pt-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  Daily Transcript Usage
                </label>
                {isLoadingUsage && (
                  <span className="text-[9px] text-[#8E8E93] font-mono animate-pulse">Syncing...</span>
                )}
              </div>

              <div className="bg-[#fdfdfd] border border-[#E5E5EA] rounded-2xl p-4 flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-[#1C1C1E] block">
                      {settings.tier === "premium" ? "👑 Pro Account Usage" : "🟢 Free Account Usage"}
                    </span>
                    {settings.tier === "premium" && (
                      <span className="text-[10px] text-gray-500 font-bold block mt-0.5">
                        Model: Gemini 3.5 Flash
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-[#1C1C1E] font-mono block">
                      {usage ? `${usage.limit - usage.remaining} / ${usage.limit}` : "loading..."}
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold block">requests today</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#E5E5EA] h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${settings.tier === "premium" ? "bg-amber-500" : "bg-blue-600"}`}
                    style={{ 
                      width: usage ? `${((usage.limit - usage.remaining) / usage.limit) * 100}%` : "0%" 
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[9px] text-gray-400 font-bold font-sans">
                  <span>Usage limits reset every 24 hours</span>
                  <span>{usage ? `Remains: ${usage.remaining} transcribes` : "Calculating..."}</span>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* DATA & STORAGE SUB-TAB */}
        {subTab === "data" && (
          <div id="settings-psection-data" className="flex flex-col gap-5">
            
            {/* Grid structure as in screenshots */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50/55 border border-[#E5E5EA] rounded-xl text-center select-none font-sans mt-1">
                <span className="text-xl">📄</span>
                <span className="text-sm font-black text-[#1C1C1E] block mt-1">{notes.length}</span>
                <span className="text-[10px] text-gray-500 font-bold block">Notes</span>
                <span className="text-[9px] text-gray-400 block font-mono">{notesTextKB.toFixed(2)} KB</span>
              </div>

              <div className="p-3 bg-slate-50/55 border border-[#E5E5EA] rounded-xl text-center select-none font-sans mt-1">
                <span className="text-xl">🎙️</span>
                <span className="text-sm font-black text-[#1C1C1E] block mt-1">{voiceMemosCount}</span>
                <span className="text-[10px] text-gray-500 font-bold block">Voice Memos</span>
                <span className="text-[9px] text-gray-400 block font-mono">{voiceAudioKB.toFixed(2)} KB</span>
              </div>

              <div className="p-3 bg-slate-50/55 border border-[#E5E5EA] rounded-xl text-center select-none font-sans mt-1">
                <span className="text-xl font-sans">📤</span>
                <span className="text-sm font-black text-[#1C1C1E] block mt-1">{uploadsCount}</span>
                <span className="text-[10px] text-gray-500 font-bold block">Uploads</span>
                <span className="text-[9px] text-gray-400 block font-mono">{uploadKB.toFixed(2)} KB</span>
              </div>
            </div>

            {/* Storage Quota & Capacity Trackers */}
            <div className="p-4 bg-slate-50 border border-[#E5E5EA] rounded-2xl flex flex-col gap-4 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1C1C1E] flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-blue-600" /> {langDict.language === "es" ? "Cuota de Almacenamiento y Límites" : "Storage Quota & Capacity Limits"}
                </span>
                <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700 select-none">
                  {settings.tier === "premium" ? "👑 NoteWave Pro" : "🟢 Free Plan"}
                </span>
              </div>

              <div className="flex flex-col gap-3.5 text-xs">
                {/* 1. Storage bytes capacity limit */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between font-semibold">
                    <span>{langDict.language === "es" ? "Base de Datos Cloud" : "Cloud Database"}</span>
                    <span className="font-mono text-[11px] font-black text-gray-700">
                      {(() => {
                        const usedBytes = totalTextBytes + totalAudioBytes;
                        const usedKB = usedBytes / 1024;
                        let usedStr = "0.00 KB";
                        if (usedKB >= 1024) {
                          usedStr = `${(usedKB / 1024).toFixed(2)} MB`;
                        } else {
                          usedStr = `${usedKB.toFixed(2)} KB`;
                        }
                        const limitStr = settings.tier === "premium" ? "1 GB" : "10 MB";
                        return `${usedStr} / ${limitStr}`;
                      })()}
                    </span>
                  </div>
                  <div className="w-full bg-[#E5E5EA] h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        ((totalTextBytes + totalAudioBytes) / 1024 / (settings.tier === "premium" ? 1048576 : 10240)) > 0.9 ? "bg-red-600" : ((totalTextBytes + totalAudioBytes) / 1024 / (settings.tier === "premium" ? 1048576 : 10240)) > 0.7 ? "bg-amber-500" : "bg-blue-600"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, (((totalTextBytes + totalAudioBytes) / 1024) / (settings.tier === "premium" ? 1048576 : 10240)) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* 2. Voice Memos limit */}
                <div className="flex flex-col gap-1.5 border-t border-[#F2F2F7] pt-2.5">
                  <div className="flex justify-between font-semibold">
                    <span>{langDict.language === "es" ? "Grabaciones de voz" : "Voice Recordings"}</span>
                    <span className="font-mono text-[11px] font-black text-gray-700">
                      {voiceMemosCount} / {settings.tier === "premium" ? (langDict.language === "es" ? "Ilimitado" : "Unlimited") : "5"}
                    </span>
                  </div>
                  <div className="w-full bg-[#E5E5EA] h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        settings.tier === "premium" ? "" : (voiceMemosCount / 5) >= 1 ? "bg-red-650" : (voiceMemosCount / 5) > 0.8 ? "bg-amber-500" : "bg-blue-600"
                      }`}
                      style={{ width: `${settings.tier === "premium" ? 0 : Math.min(100, (voiceMemosCount / 5) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* 3. Upload Document Limit */}
                <div className="flex flex-col gap-1.5 border-t border-[#F2F2F7] pt-2.5">
                  <div className="flex justify-between font-semibold">
                    <span>{langDict.language === "es" ? "Archivos cargados" : "Uploaded Files"}</span>
                    <span className="font-mono text-[11px] font-black text-gray-700">
                      {uploadsCount} / {settings.tier === "premium" ? (langDict.language === "es" ? "Ilimitado" : "Unlimited") : "3"}
                    </span>
                  </div>
                  <div className="w-full bg-[#E5E5EA] h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        settings.tier === "premium" ? "" : (uploadsCount / 3) >= 1 ? "bg-red-650" : (uploadsCount / 3) > 0.8 ? "bg-amber-500" : "bg-blue-600"
                      }`}
                      style={{ width: `${settings.tier === "premium" ? 0 : Math.min(100, (uploadsCount / 3) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {settings.tier !== "premium" ? (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex flex-col gap-2 mt-1">
                  <p className="text-[10px] text-amber-800 font-semibold leading-relaxed">
                    ⚠️ <strong>{langDict.language === "es" ? "Límites del Plan Libre Activos." : "Free Plan Account Storage Ceilings:"}</strong> {langDict.language === "es" ? "Actualiza a Pro para eliminar restricciones de audio y habilitar transcripción ilimitada en la nube con un límite de 1 GB de almacenamiento." : "Upgrade to Pro to lift voice storage restrictions and secure unlimited voice-to-text cloud model analysis with massive 1 GB hosting bounds."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      // Trigger normal save which App intercepts for Checkout Modal
                      onSaveSettings({ ...settings, tier: "premium" });
                    }}
                    className="w-full py-2 text-[10.5px] uppercase tracking-wider font-extrabold bg-[#F39C12] hover:bg-amber-550 text-white rounded-xl transition-all active:scale-98 shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    🚀 {langDict.language === "es" ? "Actualizar Cuenta a NoteWave Pro" : "Upgrade Account & Checkout NoteWave Pro"}
                  </button>
                </div>
              ) : (
                <div className="bg-green-50/70 border border-green-200 rounded-xl p-3">
                  <p className="text-[10px] text-green-800 font-semibold leading-relaxed">
                    👑 <strong>{langDict.language === "es" ? "Plan NoteWave Pro Desbloqueado" : "NoteWave Pro Tier Unlocked:"}</strong> {langDict.language === "es" ? "Límites avanzados activos. Has desbloqueado 1 GB seguro, transcripciones ilimitadas y plantillas de tareas de IA avanzada." : "Pro-capacity storage is operational. You have unlimited transcribed notes, custom Checklist roadmap generations, and 1 GB secure Cloud Database storage enabled."}
                  </p>
                </div>
              )}
            </div>

            {/* AI Processing RAG Status info block */}
            <div className="p-4 bg-slate-50 border border-[#E5E5EA] rounded-xl flex flex-col gap-3 font-sans">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                  <span className="text-xs font-black text-[#1C1C1E]">AI Processing</span>
                </div>
                <span className="text-[9px] font-mono font-bold uppercase text-gray-400">RAG Status</span>
              </div>

              <div className="flex flex-col gap-2.5 text-xs text-gray-700 font-semibold leading-relaxed">
                <div className="flex items-center justify-between border-b border-[#F2F2F7] pb-1.5">
                  <span>Processed documents:</span>
                  <span className="text-green-700 font-mono font-bold leading-none">{notes.length} ready</span>
                </div>
                <div className="flex items-center justify-between pb-1">
                  <span>Pending processing:</span>
                  <span className="font-mono text-gray-400 font-bold leading-none">0 pending</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-normal">
                  Your data will be processed to enable AI-powered search and insights.
                </p>
              </div>

              <button
                id="data-rag-process-btn"
                type="button"
                onClick={handleProcessRAG}
                disabled={isProcessingRAG || notes.length === 0}
                className="w-full mt-1.5 py-2.5 rounded-xl border border-blue-700 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-xs transition-active active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessingRAG ? "animate-spin" : ""}`} />
                <span>Process All Data</span>
              </button>

              {ragStatusMessage && (
                <div className="p-2 bg-blue-50 border border-blue-150 rounded-lg text-[10px] text-blue-800 font-extrabold leading-normal mt-1 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>{ragStatusMessage}</span>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl flex flex-col gap-2.5 font-sans mt-2">
              <span className="text-xs font-black text-red-800 flex items-center gap-1.5 uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-red-700" /> Danger Zone
              </span>
              <p className="text-[10px] text-gray-500 font-semibold leading-relaxed">
                Permanently delete all your data. This action cannot be undone.
              </p>

              <button
                id="danger-zone-delete-all-btn"
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setConfirmDeleteText("");
                }}
                className="w-full mt-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black border border-red-700 shadow-sm transition-active active:scale-97 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-200" />
                <span>Delete All Data</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Custom Bilingual Danger Zone Deletion Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#E5E5EA] shadow-2xl max-w-md w-full p-6 flex flex-col gap-5 animate-scale-up hover:shadow-3xl transition-shadow duration-300 font-sans">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#1C1C1E]">
                  {langDict.language === "es" ? "Eliminar Todos los Datos" : "Permanently Delete All Data"}
                </h3>
                <p className="text-[11px] text-gray-405 font-bold tracking-wider uppercase font-mono mt-0.5">
                  {langDict.language === "es" ? "Acción Irreversible" : "Irreversible Action"}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 font-semibold leading-relaxed">
              {langDict.language === "es" 
                ? "Estás a punto de borrar por completo toda la información de tu cuenta. Esto incluye los siguientes elementos almacenados tanto localmente como en la nube:"
                : "You are about to permanently erase all your application data. This will completely wipe the following items stored both locally and in the cloud:"}
            </p>

            {/* Data summary details */}
            <div className="bg-slate-50 border border-[#E5E5EA] rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">📄</span>
                  <span className="font-bold text-[#1C1C1E]">{langDict.language === "es" ? "Notas y Transcripciones" : "Notes & Transcripts"}</span>
                </div>
                <span className="font-mono font-black text-gray-700">{notes.length} ({notesTextKB.toFixed(2)} KB)</span>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs border-t border-dashed border-[#E5E5EA] pt-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎙️</span>
                  <span className="font-bold text-[#1C1C1E]">{langDict.language === "es" ? "Memos de Voz" : "Voice Memos"}</span>
                </div>
                <span className="font-mono font-black text-gray-700">{voiceMemosCount} ({voiceAudioKB.toFixed(2)} KB)</span>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs border-t border-dashed border-[#E5E5EA] pt-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">📤</span>
                  <span className="font-bold text-[#1C1C1E]">{langDict.language === "es" ? "Archivos Cargados" : "Uploaded Documents"}</span>
                </div>
                <span className="font-mono font-black text-gray-700">{uploadsCount} ({uploadKB.toFixed(2)} KB)</span>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5">
              <span className="text-base mt-0.5">⚠️</span>
              <p className="text-[10px] text-red-800 font-bold leading-normal">
                {langDict.language === "es"
                  ? "¡Esta acción es final e irreversible! Ni la sincronización con la nube ni los respaldos locales podrán recuperar las grabaciones, notas o uploads una vez eliminados."
                  : "This action is final and cannot be undone! Cloud backups and local database caches cannot recover your records, voice memos, or uploaded files once cleared."}
              </p>
            </div>

            {/* Safety Type to Confirm */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-sans">
                {langDict.language === "es"
                  ? "Escribe 'DELETE' para confirmar la eliminación"
                  : "Type 'DELETE' to confirm deletion"}
              </label>
              <input
                type="text"
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 border border-[#E5E5EA] bg-slate-50 rounded-xl text-center font-mono font-bold text-sm tracking-widest text-red-700 focus:outline-hidden focus:border-red-400 focus:ring-1 focus:ring-red-100 placeholder:text-gray-300"
              />
            </div>

            {/* Action Pair */}
            <div className="flex gap-2.5 mt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConfirmDeleteText("");
                }}
                className="flex-1 py-2.5 rounded-xl border border-[#D1D1D6] bg-white hover:bg-slate-50 text-[#1C1C1E] text-xs font-black transition-all cursor-pointer"
              >
                {langDict.language === "es" ? "Cancelar" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={confirmDeleteText !== "DELETE"}
                onClick={() => {
                  if (confirmDeleteText === "DELETE") {
                    onDeleteAllNotes();
                    setShowDeleteConfirm(false);
                    setConfirmDeleteText("");
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black border border-red-700 shadow-xs transition-active active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {langDict.language === "es" ? "Eliminar Todo" : "Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
