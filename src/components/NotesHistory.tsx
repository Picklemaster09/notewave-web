import { useState, useEffect, useRef, MouseEvent, FormEvent } from "react";
import { RecordingNote, SubTodo, UserTier } from "../types";
import { 
  Search, Play, Pause, Trash2, Calendar, Clock, Sparkles, 
  Tag, Cpu, ChevronDown, ChevronUp, Check, Headphones, 
  ListTodo, Rocket, FileText, Plus, AlertCircle, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getTranslation } from "../locale";

interface NoteCardInternalProps {
  key?: string;
  note: RecordingNote;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  playingId: string | null;
  onPlayAudio: (note: RecordingNote) => void;
  onDeleteNote: (id: string) => void;
  onToggleActionItem: (noteId: string, itemText: string, checked: boolean) => void;
  complexTaskExpand: Record<string, boolean>;
  onToggleComplexRoadmap: (e: MouseEvent, id: string) => void;
  getCompletedSubTodosCount: (note: RecordingNote) => { total: number; completed: number };
  formatDuration: (s: number) => string;
  t: any;
  language: string;
}

function NoteCardInternal({
  note,
  isExpanded,
  onToggleExpand,
  playingId,
  onPlayAudio,
  onDeleteNote,
  onToggleActionItem,
  complexTaskExpand,
  onToggleComplexRoadmap,
  getCompletedSubTodosCount,
  formatDuration,
  t,
  language
}: NoteCardInternalProps) {
  const [realDuration, setRealDuration] = useState<number | null>(null);

  useEffect(() => {
    if (note.audioData) {
      const audio = new Audio(note.audioData);
      const onLoadedMetadata = () => {
        if (audio.duration && isFinite(audio.duration)) {
          setRealDuration(Math.round(audio.duration));
        }
      };
      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      return () => {
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      };
    }
  }, [note.audioData]);

  const displayDuration = realDuration !== null ? realDuration : note.duration;
  const { total, completed } = getCompletedSubTodosCount(note);

  const wordCount = note.transcript ? note.transcript.trim().split(/\s+/).filter(Boolean).length : 0;

  const getNoteTypeLabel = () => {
    const isVoice = !!note.audioData;
    switch (language) {
      case "es":
        return isVoice ? "Nota de voz" : "Nota escrita";
      case "fr":
        return isVoice ? "Note vocale" : "Note écrite";
      case "de":
        return isVoice ? "Sprachnotiz" : "Schriftliche Notiz";
      case "cs":
        return isVoice ? "Hlasová poznámka" : "Písemná poznámka";
      case "sk":
        return isVoice ? "Hlasová poznámka" : "Písomná poznámka";
      case "ja":
        return isVoice ? "音声メモ" : "テキストメモ";
      default:
        return isVoice ? "Voice Memo" : "Written Note";
    }
  };

  const getWordCountLabel = (count: number) => {
    switch (language) {
      case "es":
        return `${count} ${count === 1 ? "palabra" : "palabras"}`;
      case "fr":
        return `${count} ${count === 1 ? "mot" : "mots"}`;
      case "de":
        return `${count} ${count === 1 ? "Wort" : "Wörter"}`;
      case "cs":
        return `${count} ${count === 1 ? "slovo" : "slova"}`;
      case "sk":
        return `${count} ${count === 1 ? "slovo" : "slová"}`;
      case "ja":
        return `${count} 文字`;
      default:
        return `${count} ${count === 1 ? "word" : "words"}`;
    }
  };

  return (
    <div
      id={`note-ideas-card-${note.id}`}
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isExpanded
          ? "bg-slate-50/50 border-[#D1D1D6] shadow-xs"
          : "bg-white hover:bg-slate-50/20 border-[#E5E5EA] shadow-3xs"
      }`}
    >
      <div
        onClick={() => onToggleExpand(note.id)}
        className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
      >
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2 flex-wrap text-gray-400 font-mono text-[9px] font-bold uppercase tracking-wide">
            <Calendar className="w-3 h-3 text-gray-450" />
            <span>{new Date(note.createdAt).toLocaleDateString()}</span>
            
            {note.audioData && (
              <>
                <span className="text-gray-300">•</span>
                <Clock className="w-3 h-3 text-gray-450" />
                <span>{formatDuration(displayDuration)}</span>
              </>
            )}
            
            {total > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span className={`px-1.5 py-0.5 rounded border flex items-center gap-1 font-sans text-xs tracking-normal font-bold lowercase ${
                  completed === total 
                    ? "bg-green-50 text-green-700 border-green-200" 
                    : "bg-blue-50 text-blue-700 border-blue-100"
                }`}>
                  <ListTodo className="w-3 h-3" />
                  {completed}/{total} {t.completedRoadmaps}
                </span>
              </>
            )}

            {note.isComplex && (
              <>
                <span className="text-gray-300">•</span>
                <span className="px-1.5 py-0.5 rounded border text-[8px] font-mono font-bold uppercase bg-blue-55 text-blue-750 border-blue-150">
                  ⚒️ {t.complexRoadmap}
                </span>
              </>
            )}

            <span className="px-1.5 py-0.5 rounded-md border text-[8px] tracking-wide uppercase font-bold font-mono ml-1 bg-slate-100 text-gray-650 border-[#E5E5EA]">
              {(note.ideaName?.toLowerCase() === "idea") ? "💡 Idea" : "📝 Note"}
            </span>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {note.ideaName?.toLowerCase() === "idea" ? (
              <Rocket className="w-4 h-4 text-blue-600 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <h4 className="text-sm font-bold text-[#1C1C1E] truncate pr-2">
              {note.title}
            </h4>
          </div>
        </div>

        {/* Audio Controls */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {note.audioData && (
            <button
              onClick={() => onPlayAudio(note)}
              className={`p-2.5 rounded-xl transition-all border cursor-pointer ${
                playingId === note.id
                  ? "bg-red-50 text-red-600 border-red-250 animate-pulse"
                  : "bg-white text-gray-650 border-[#D1D1D6] hover:bg-slate-50"
              }`}
              title="Play Speech Voice Memo"
            >
              {playingId === note.id ? (
                <Pause className="w-3.5 h-3.5 fill-red-650" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-gray-500" />
              )}
            </button>
          )}
          
          <button
            onClick={() => onToggleExpand(note.id)}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-gray-500 hover:text-[#1C1C1E] border border-[#D1D1D6]"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#E5E5EA] bg-white p-5 flex flex-col gap-4 font-sans text-gray-800"
          >
            {/* Technical Info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-[#48484A] bg-slate-50 p-3 rounded-xl border border-[#E5E5EA]">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 text-[9px] font-mono leading-none bg-blue-50 text-blue-700 rounded border border-blue-200 uppercase font-black">
                  AI ENGINE
                </span>
                {note.modelUsed ? (
                  <span className="flex items-center gap-1.5 font-mono font-bold text-gray-700">
                    <Cpu className="w-3.5 h-3.5 text-blue-500" /> {note.modelUsed}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-gray-600 font-bold">
                    🔒 Local Offline Draft
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 text-[9px] font-mono leading-none bg-emerald-50 text-emerald-700 rounded border border-emerald-200 uppercase font-black">
                  FORMAT
                </span>
                <span className="flex items-center gap-1.5 font-bold text-gray-700">
                  <FileText className="w-3.5 h-3.5 text-emerald-500" /> {getNoteTypeLabel()} • <span className="font-mono text-[10.5px] text-gray-650">{getWordCountLabel(wordCount)}</span>
                </span>
              </div>
            </div>

            {/* Smart insight outline text */}
            {note.ideaSummary && (
              <div className="flex flex-col gap-1.5 bg-yellow-50/40 border border-yellow-200/50 p-4 rounded-xl">
                <div className="text-[10px] font-mono text-yellow-700 flex items-center gap-1 uppercase font-bold">
                  <Sparkles className="w-3.5 h-3.5" /> {t.insightTitle}
                </div>
                <p className="text-xs text-gray-750 leading-relaxed font-semibold">
                  {note.ideaSummary}
                </p>
              </div>
            )}

            {/* Subtodos checkable roadmaps logs */}
            {note.subTodos && note.subTodos.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-mono uppercase font-black tracking-wider text-gray-400">Step checklist tasks:</span>
                
                {note.isComplex ? (
                  <div className="flex flex-col gap-2">
                    <div
                      onClick={(e) => onToggleComplexRoadmap(e, note.id)}
                      className="p-3 bg-slate-50 border border-[#E5E5EA] hover:border-blue-600 hover:bg-slate-100/50 rounded-xl flex items-center justify-between cursor-pointer group transition-all"
                    >
                      <span className="text-xs font-bold text-gray-750 group-hover:text-blue-600">
                        📂 {language === "es" ? "Área de especificación de proyecto del plan" : "Comprehensive design roadmap specifications"}
                      </span>
                      <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                        {complexTaskExpand[note.id] ? "Minimize Checklist" : "Expand Checklist"}
                        {complexTaskExpand[note.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </span>
                    </div>

                    <AnimatePresence initial={false}>
                      {complexTaskExpand[note.id] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-slate-50/25 border border-dashed border-[#E5E5EA] p-4 rounded-xl flex flex-col gap-2.5"
                        >
                          {note.subTodos.map((todo) => (
                            <div
                              key={todo.id}
                              onClick={() => onToggleActionItem(note.id, todo.text, !todo.completed)}
                              className="flex items-start gap-2.5 cursor-pointer py-1.5 group font-sans select-none"
                            >
                              {todo.completed ? (
                                <div className="mt-0.5 p-0.5 rounded bg-green-50 text-green-600 border border-green-200">
                                  <Check className="w-3 h-3 text-green-600 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="mt-0.5 w-4 h-4 rounded border border-gray-300 bg-white group-hover:border-blue-600 transition-colors" />
                              )}
                              <span className={`text-xs font-semibold leading-relaxed ${
                                todo.completed ? "text-gray-400 line-through font-normal" : "text-gray-750 group-hover:text-blue-600"
                              }`}>
                                {todo.text}
                              </span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-50/50 border border-[#E5E5EA]">
                    {note.subTodos.map((todo) => (
                      <div
                        key={todo.id}
                        onClick={() => onToggleActionItem(note.id, todo.text, !todo.completed)}
                        className="flex items-start gap-2.5 cursor-pointer py-1 group font-sans select-none"
                      >
                        {todo.completed ? (
                          <div className="mt-0.5 p-0.5 rounded bg-green-50 text-green-600 border border-green-200">
                            <Check className="w-3 h-3 text-green-600 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="mt-0.5 w-4 h-4 rounded border border-gray-300 bg-white group-hover:border-blue-600 transition-colors" />
                        )}
                        <span className={`text-xs font-semibold leading-relaxed ${
                          todo.completed ? "text-gray-400 line-through font-normal" : "text-gray-750 group-hover:text-blue-600"
                        }`}>
                          {todo.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Speech transcript */}
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] font-mono text-gray-400 font-bold uppercase flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-gray-400" /> {note.audioData ? "Speech transcript:" : "Written content notes:"}
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-[#E5E5EA] text-xs text-gray-650 leading-relaxed whitespace-pre-wrap font-semibold">
                {note.transcript}
              </div>
            </div>

            {/* Footer tags and delete options inside expanded body */}
            <div className="flex items-center justify-between gap-4 pt-3.5 border-t border-[#E5E5EA]">
              <div className="flex items-center gap-1.5 flex-wrap">
                {note.tags.map((tag) => (
                  <span key={tag} className="text-[9.5px] font-bold text-gray-500 bg-slate-100 border border-[#E5E5EA] px-2 py-0.5 rounded-md">
                    #{tag}
                  </span>
                ))}
              </div>

              <button
                onClick={() => onDeleteNote(note.id)}
                className="text-[10.5px] font-bold text-red-650 hover:text-white hover:bg-red-650 bg-white border border-[#D1D1D6] hover:border-red-650 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-3xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Note
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface NotesHistoryProps {
  notes: RecordingNote[];
  onDeleteNote: (id: string) => void;
  onToggleActionItem: (noteId: string, itemText: string, checked: boolean) => void;
  onAddManualNote?: (newNote: RecordingNote) => void; 
  language?: string;
  tier?: UserTier;
  customApiKey?: string;
}

export default function NotesHistory({ 
  notes, 
  onDeleteNote, 
  onToggleActionItem, 
  onAddManualNote,
  language = "en",
  tier = "free",
  customApiKey = ""
}: NotesHistoryProps) {
  const t = getTranslation(language);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  // Custom interactive mock filter tabs: "All", "Notes", "Ideas"
  const [selectedFolder, setSelectedFolder] = useState<"all" | "notes" | "ideas">("all");

  // Manual note creation form inside Notes history
  const [showNewNoteForm, setShowNewNoteForm] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteBody, setNewNoteBody] = useState("");
  const [newNoteType, setNewNoteType] = useState<"Idea" | "Note">("Note");
  const [newNoteTags, setNewNoteTags] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Track expand/collapse of nested roadmap roadmaps for complex items
  const [complexTaskExpand, setComplexTaskExpand] = useState<Record<string, boolean>>({});

  // Playback States
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioPlayersRef = useRef<{ [key: string]: HTMLAudioElement }>({});

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Humanize duration
  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  // Playback handler
  const handlePlayAudio = (note: RecordingNote) => {
    if (!note.audioData) return;
    if (playingId === note.id) {
      audioPlayersRef.current[note.id]?.pause();
      setPlayingId(null);
      return;
    }
    if (playingId && audioPlayersRef.current[playingId]) {
      audioPlayersRef.current[playingId].pause();
    }
    if (!audioPlayersRef.current[note.id]) {
      const audio = new Audio(note.audioData);
      audio.onended = () => {
        setPlayingId(null);
      };
      audioPlayersRef.current[note.id] = audio;
    }
    audioPlayersRef.current[note.id].play()
      .then(() => setPlayingId(note.id))
      .catch((err) => console.error("Playback failed:", err));
  };

  // Safe task parser
  const getCompletedSubTodosCount = (note: RecordingNote) => {
    const todos = note.subTodos || [];
    if (!todos.length) return { total: 0, completed: 0 };
    const completed = todos.filter((t) => t.completed).length;
    return { total: todos.length, completed };
  };

  // Filter out reminders tab records from the main Notes & Ideas feed
  const ideasNotes = notes.filter((note) => (note.category || "ideas") === "ideas");

  // Submit manual note
  const handleCreateManualNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteBody.trim()) return;

    setIsProcessing(true);
    setErrorText(null);

    const parsedTags = newNoteTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (parsedTags.length === 0) {
      parsedTags.push("Note", "Manual");
    }

    // Prepare draft fallback in case of api failure / offline mode
    const manualNoteDraft: RecordingNote = {
      id: `manual_note_${Date.now()}`,
      title: newNoteTitle.trim(),
      duration: 0,
      createdAt: new Date().toISOString(),
      transcript: newNoteBody.trim(),
      ideaSummary: `Brief: ${newNoteBody.trim().substring(0, 100)}...`,
      actionItems: "",
      category: "ideas",
      ideaName: newNoteType,
      scheduledDate: undefined,
      subTodos: [],
      tags: parsedTags,
      modelUsed: "NoteWave Notebook"
    };

    try {
      const response = await fetch("/api/analyze-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: newNoteBody.trim(),
          tier: tier,
          customApiKey: customApiKey || undefined,
          filename: `Manual: ${newNoteTitle.trim().substring(0, 20)}`,
          language: language,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Fallback to draft note gracefully instead of hard failing
        console.warn("Gemini enhancement failed, using local fallback draft:", result.message || "Unknown error");
        if (onAddManualNote) {
          onAddManualNote(manualNoteDraft);
        }
        triggerSuccess(language === "es"
          ? "¡Nota guardada localmente! (Análisis de Gemini no disponible en este momento)"
          : "Note saved locally as offline draft (Gemini analysis unavailable right now).");
      } else {
        const data = result.data;
        const enhancedNote: RecordingNote = {
          id: `manual_note_${Date.now()}`,
          title: newNoteTitle.trim(), // Keep user's custom title
          duration: 0,
          createdAt: new Date().toISOString(),
          transcript: newNoteBody.trim(),
          ideaSummary: data.summaryText || `Brief: ${newNoteBody.trim().substring(0, 100)}...`,
          actionItems: data.actionItems || "",
          category: data.category || "ideas",
          ideaName: data.ideaName || newNoteType,
          scheduledDate: data.scheduledDate || undefined,
          projectStartDate: data.projectStartDate || undefined,
          isComplex: !!data.isComplex,
          subTodos: Array.isArray(data.subTodos) ? data.subTodos : [],
          tags: Array.from(new Set([
            ...parsedTags,
            ...(data.tags 
              ? (typeof data.tags === "string" ? data.tags.split(",").map((s: string) => s.trim()) : data.tags) 
              : ["manual"])
          ])).filter(Boolean),
          modelUsed: result.model || (tier === "premium" ? "gemini-3.5-flash" : "gemini-3.1-flash-lite"),
        };

        if (onAddManualNote) {
          onAddManualNote(enhancedNote);
        }
        triggerSuccess(language === "es"
          ? "¡Nota procesada por IA y guardada con éxito!"
          : "AI-enhanced Note successfully captured with dynamic checklists & insights!");
      }

      // Reset Form on full success/graceful fallback
      setNewNoteTitle("");
      setNewNoteBody("");
      setNewNoteType("Note");
      setNewNoteTags("");
      setShowNewNoteForm(false);

    } catch (e) {
      console.error("Analysis API network error, falling back:", e);
      // Fallback to draft note gracefully
      if (onAddManualNote) {
        onAddManualNote(manualNoteDraft);
      }
      triggerSuccess(language === "es"
        ? "¡Nota guardada localmente! (Modo fuera de línea)"
        : "Note captured successfully in offline draft mode!");
      
      setNewNoteTitle("");
      setNewNoteBody("");
      setNewNoteType("Note");
      setNewNoteTags("");
      setShowNewNoteForm(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerSuccess = (msg: string) => {
    setFormSuccess(msg);
    setTimeout(() => setFormSuccess(""), 4000);
  };

  // Folder Filters of the mockup: All, Notes, Ideas
  const filteredNotes = ideasNotes.filter((note) => {
    // 1. Search term
    const matchesSearch = 
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.transcript.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.ideaSummary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (note.ideaName && note.ideaName.toLowerCase().includes(searchTerm.toLowerCase()));
      
    // 2. Custom selected tags
    const matchesTag = selectedTag ? note.tags.includes(selectedTag) : true;

    // 3. Folder Filter:
    const isActuallyNote = 
      note.ideaName?.toLowerCase() === "note" || 
      (!note.isComplex && (!note.subTodos || note.subTodos.length === 0) && (!note.ideaName || note.ideaName.toLowerCase() !== "idea"));

    const isActuallyIdea = !isActuallyNote;

    if (selectedFolder === "notes") {
      return matchesSearch && matchesTag && isActuallyNote;
    }
    if (selectedFolder === "ideas") {
      return matchesSearch && matchesTag && isActuallyIdea;
    }
    
    return matchesSearch && matchesTag; // "all"
  });

  const allUniqueTags = Array.from(
    new Set(ideasNotes.flatMap((note) => note.tags || []))
  ).filter(Boolean);

  // Count tag frequencies across notes
  const tagCounts: Record<string, number> = {};
  ideasNotes.forEach((note) => {
    (note.tags || []).forEach((tag) => {
      if (tag) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    });
  });

  // Sort by frequency and slice to top 8 most popular tags
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 8);

  // Smart Safeguard: Ensure the actively selected tag is never hidden from the filters bar
  const displayedTagsInFilter = Array.from(
    new Set(selectedTag ? [selectedTag, ...topTags] : topTags)
  );

  const toggleComplexRoadmap = (e: MouseEvent, noteId: string) => {
    e.stopPropagation();
    setComplexTaskExpand(prev => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  };

  return (
    <div 
      id="notes-ideas-workspace" 
      className="flex-1 flex flex-col gap-6 p-6 rounded-2xl bg-white border border-[#E5E5EA] text-[#1C1C1E] font-sans shadow-sm"
    >
      {/* Header element matched like mockup screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#1C1C1E] font-sans flex items-center gap-2">
            Notes & Ideas
          </h1>
          <p className="text-xs text-gray-500 font-semibold mt-1">
            Capture thoughts and brilliant ideas
          </p>
        </div>

        {/* Action Button: "+ New Note" modeled in screenshot */}
        <button
          onClick={() => setShowNewNoteForm(!showNewNoteForm)}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs flex items-center gap-1.5 uppercase tracking-wider ${
            showNewNoteForm 
              ? "bg-slate-800 text-white" 
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          New Note
        </button>
      </div>

      {formSuccess && (
        <div className="p-3.5 rounded-xl text-xs font-semibold leading-normal bg-green-50 border border-green-150 text-green-700 animate-pulse">
          ✔️ {formSuccess}
        </div>
      )}

      {/* NEW NOTE DIALOG DRAWER FORM */}
      <AnimatePresence>
        {showNewNoteForm && (
          <motion.form 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleCreateManualNote}
            className="bg-slate-50/55 border border-[#E5E5EA] rounded-2xl p-4.5 shadow-3xs flex flex-col gap-3.5"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase font-black text-blue-600">
              <Sparkles className="w-3.5 h-3.5" /> Configure Custom Written Idea Note
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-450 text-gray-500">Note Document Title</label>
                <input
                  type="text"
                  required
                  disabled={isProcessing}
                  placeholder="Ex. Marketing Strategy Re-route"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="bg-white border border-[#E5E5EA] text-xs font-semibold rounded-xl px-3 py-2.5 text-[#1C1C1E] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-gray-400"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500">Note Type Category</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setNewNoteType("Note")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                      newNoteType === "Note"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-white text-gray-500 border-[#E5E5EA] hover:bg-slate-50"
                    } disabled:opacity-50`}
                  >
                    📝 Note
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setNewNoteType("Idea")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                      newNoteType === "Idea"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-white text-gray-500 border-[#E5E5EA] hover:bg-slate-50"
                    } disabled:opacity-50`}
                  >
                    💡 Idea
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-450 text-gray-500">Write Note Thoughts / Text Outlines</label>
              <textarea
                required
                disabled={isProcessing}
                placeholder="Type down raw brainstorm takeaways, ideas, or transcripts manually..."
                rows={4}
                value={newNoteBody}
                onChange={(e) => setNewNoteBody(e.target.value)}
                className="bg-white border border-[#E5E5EA] text-xs font-semibold rounded-xl p-3 text-[#1C1C1E] leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-gray-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-450 text-gray-500">Custom Tags (comma separated)</label>
                <input
                  type="text"
                  disabled={isProcessing}
                  placeholder="App, Roadmap, Draft"
                  value={newNoteTags}
                  onChange={(e) => setNewNoteTags(e.target.value)}
                  className="bg-white border border-[#E5E5EA] text-xs font-semibold rounded-xl px-3 py-2.5 text-[#1C1C1E] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-gray-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowNewNoteForm(false)}
                  className="text-xs font-extrabold text-gray-500 hover:text-gray-800 px-3 py-1.5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-heavy text-xs px-4 py-2 rounded-xl transition-all font-sans font-bold shadow-3xs flex items-center justify-center gap-1.5 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {language === "es" ? "Analizando con Gemini..." : "Analyzing with Gemini..."}
                    </>
                  ) : (
                    "Save Manual Note"
                  )}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Row containing SEARCH notes... and All / Notes / Ideas filters as depicted */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 p-2.5 rounded-xl border border-[#E5E5EA]">
        
        {/* Search bar on the left */}
        <div id="search-bar" className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white text-xs text-[#1C1C1E] placeholder-gray-400 pl-9 pr-4 py-2 rounded-lg border border-[#E5E5EA] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold font-sans"
          />
        </div>

        {/* Segment switches on the right mirroring mockup: All, Notes, Ideas */}
        <div className="flex items-center gap-1.5 shrink-0 bg-[#F2F2F7] p-1 rounded-xl border border-[#E5E5EA] select-none">
          <button
            onClick={() => setSelectedFolder("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              selectedFolder === "all"
                ? "bg-white text-gray-800 shadow-3xs"
                : "text-gray-500 hover:text-[#1C1C1E]"
            }`}
          >
            All
          </button>

          <button
            onClick={() => setSelectedFolder("notes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedFolder === "notes"
                ? "bg-white text-gray-800 shadow-3xs"
                : "text-gray-500 hover:text-[#1C1C1E]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Notes
          </button>

          <button
            onClick={() => setSelectedFolder("ideas")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedFolder === "ideas"
                ? "bg-white text-gray-800 shadow-3xs"
                : "text-gray-500 hover:text-[#1C1C1E]"
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            Ideas
          </button>
        </div>
      </div>

      {/* Tags list */}
      {displayedTagsInFilter.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono text-gray-400 font-bold uppercase mr-1">{t.tagFilterPrefix}</span>
          <button
            onClick={() => setSelectedTag(null)}
            className={`text-[9.5px] font-sans font-black px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              selectedTag === null
                ? "bg-slate-200 text-gray-850 border-[#D1D1D6]"
                : "bg-slate-100 text-gray-500 border-transparent hover:bg-slate-200/50 hover:text-[#1C1C1E]"
            }`}
          >
            {t.allTags}
          </button>
          {displayedTagsInFilter.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`text-[9.5px] font-sans font-black px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 cursor-pointer ${
                selectedTag === tag
                  ? "bg-slate-200 text-gray-850 border-[#D1D1D6]"
                  : "bg-slate-100 text-gray-500 border-transparent hover:bg-slate-200/50 hover:text-[#1C1C1E]"
              }`}
            >
              <Tag className="w-2.5 h-2.5 text-gray-400" />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Notes & Ideas list layout - styled in iOS style */}
      <div className="flex-1 flex flex-col gap-4 pb-6">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#E5E5EA] rounded-2xl bg-slate-50/25 p-6 shadow-3xs">
            <Clock className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm font-extrabold text-[#1C1C1E]">
              {language === "es" ? "Sin notas o ideas registradas" : "No thoughts found"}
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm px-4 leading-relaxed font-semibold">
              {language === "es" 
                ? "Presiona el botón de captura de voz o agrega anotaciones escritas usando el botón superior."
                : "Record high-fidelity voice notes or type custom standalone writeups down inside Notes & Ideas!"}
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <NoteCardInternal
              key={note.id}
              note={note}
              isExpanded={expandedId === note.id}
              onToggleExpand={toggleExpand}
              playingId={playingId}
              onPlayAudio={handlePlayAudio}
              onDeleteNote={onDeleteNote}
              onToggleActionItem={onToggleActionItem}
              complexTaskExpand={complexTaskExpand}
              onToggleComplexRoadmap={toggleComplexRoadmap}
              getCompletedSubTodosCount={getCompletedSubTodosCount}
              formatDuration={formatDuration}
              t={t}
              language={language}
            />
          ))
        )}
      </div>

    </div>
  );
}
