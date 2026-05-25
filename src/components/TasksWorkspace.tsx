import { useState, useRef, FormEvent } from "react";
import { RecordingNote, SubTodo } from "../types";
import { 
  Plus, Calendar, Clock, Trash2, Play, Pause, ListTodo, 
  Sparkles, ChevronDown, ChevronUp, Bell, Check, Tag, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TasksWorkspaceProps {
  notes: RecordingNote[];
  onDeleteNote: (id: string) => void;
  onToggleActionItem: (noteId: string, itemText: string, checked: boolean) => void;
  onAddManualNote: (newNote: RecordingNote) => void;
  language?: string;
}

export default function TasksWorkspace({ 
  notes, 
  onDeleteNote, 
  onToggleActionItem, 
  onAddManualNote,
  language = "en" 
}: TasksWorkspaceProps) {
  // Tab filters: All, Active, Completed
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed">("all");
  
  // Interactive Priority & Category chips for CURRENT new task creation
  const [selectedPriority, setSelectedPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [selectedCategory, setSelectedCategory] = useState<"Work" | "Personal" | "Health" | "Learning" | "Ideas">("Work");

  // Input states
  const [taskTitle, setTaskTitle] = useState("");
  
  // Playback States
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioPlayersRef = useRef<{ [key: string]: HTMLAudioElement }>({});

  // UI Expanded cards
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Success flash message
  const [successMsg, setSuccessMsg] = useState("");

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

  // Create manual task from input bar
  const handleAddTaskSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    // Build subTodo item with checked off state support
    const newTodoId = `sub_${Date.now()}`;
    const parsedSubTodos: SubTodo[] = [
      {
        id: newTodoId,
        text: taskTitle.trim(),
        completed: false
      }
    ];

    const tags = [selectedPriority, selectedCategory, "Manual"];

    const newNote: RecordingNote = {
      id: `manual_task_${Date.now()}`,
      title: taskTitle.trim(),
      duration: 0,
      createdAt: new Date().toISOString(),
      transcript: `Manually added task to-do. Priority: ${selectedPriority}, Category: ${selectedCategory}.`,
      ideaSummary: `Checkbox task list item: ${taskTitle}`,
      actionItems: `- [ ] ${taskTitle}`,
      category: "reminders",
      ideaName: selectedCategory,
      scheduledDate: new Date().toLocaleDateString(),
      subTodos: parsedSubTodos,
      tags: tags,
      modelUsed: "NoteWave Workspace"
    };

    onAddManualNote(newNote);
    
    // Clear state
    setTaskTitle("");
    triggerFlashSuccess(`Task "${newNote.title}" added successfully!`);
  };

  const triggerFlashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  // Filter existing Reminder logs
  const remindersList = notes.filter((note) => note.category === "reminders");

  // Filter based on "All", "Active", "Completed"
  const filteredReminders = remindersList.filter((note) => {
    const todos = note.subTodos || [];
    
    if (filterStatus === "active") {
      // Show reminders that have at least one uncompleted task, or have no tasks but are active
      if (todos.length === 0) return true;
      return todos.some((t) => !t.completed);
    }
    
    if (filterStatus === "completed") {
      // Show reminders where all tasks are completed
      if (todos.length === 0) return false;
      return todos.every((t) => t.completed);
    }
    
    return true; // "all"
  });

  return (
    <div 
      id="tasks-workspace-view" 
      className="flex-1 flex flex-col gap-6 p-6 rounded-2xl bg-white border border-[#E5E5EA] text-[#1C1C1E] font-sans shadow-sm"
    >
      {/* Header aligned like mockup screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#1C1C1E] font-sans flex items-center gap-2">
            Tasks
          </h1>
          <p className="text-xs text-gray-500 font-semibold mt-1">
            Manage your to-dos and track progress
          </p>
        </div>

        {/* Top Right Pill Filters: All, Active, Completed */}
        <div className="flex items-center gap-1 bg-[#F2F2F7] p-1 rounded-xl border border-[#E5E5EA] shrink-0 select-none">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterStatus === "all"
                ? "bg-white text-gray-800 shadow-xs"
                : "text-gray-500 hover:text-[#1C1C1E]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterStatus === "active"
                ? "bg-white text-gray-800 shadow-xs"
                : "text-gray-500 hover:text-[#1C1C1E]"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterStatus === "completed"
                ? "bg-white text-gray-800 shadow-xs"
                : "text-gray-500 hover:text-[#1C1C1E]"
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl text-xs font-semibold leading-normal bg-green-50 border border-green-150 text-green-700 animate-pulse">
          ✔️ {successMsg}
        </div>
      )}

      {/* Input row based on Mockup: "What needs to be done?" + Clean modern Light button */}
      <form onSubmit={handleAddTaskSubmit} className="flex flex-col gap-3.5 bg-slate-50/50 p-4 rounded-2xl border border-[#E5E5EA] shadow-3xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            required
            placeholder="What needs to be done?"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            className="flex-1 bg-white text-sm text-[#1C1C1E] placeholder-gray-400 px-4 py-2.5 rounded-xl border border-[#E5E5EA] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
          />

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-heavy text-xs px-5 py-2.5 rounded-xl shadow-xs transition-active active:scale-97 cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wide font-sans shrink-0 font-bold"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Add Task
          </button>
        </div>

        {/* Tag Filters labels from screenshot */}
        <div className="flex flex-wrap items-center gap-y-2.5 gap-x-4 pt-2.5 text-xs text-gray-500 font-medium border-t border-[#E5E5EA]">
          {/* Priority options: Low, Medium, High, Urgent */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-heavy">Priority:</span>
            {(["Low", "Medium", "High", "Urgent"] as const).map((priority) => (
              <button
                type="button"
                key={priority}
                onClick={() => setSelectedPriority(priority)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-sans font-extrabold transition-all cursor-pointer ${
                  selectedPriority === priority
                    ? "bg-slate-200 text-gray-800 shadow-3xs"
                    : "bg-[#F2F2F7] text-gray-600 hover:bg-slate-200/50 border border-transparent"
                }`}
              >
                {priority}
              </button>
            ))}
          </div>

          <div className="hidden sm:block text-gray-300">|</div>

          {/* Category options: Work, Personal, Health, Learning, Ideas */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-heavy">Category:</span>
            {(["Work", "Personal", "Health", "Learning", "Ideas"] as const).map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-sans font-extrabold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-slate-200 text-gray-800 shadow-3xs"
                    : "bg-[#F2F2F7] text-gray-600 hover:bg-slate-200/50 border border-transparent"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Checklist rendering - but styled beautiful and expandable "bellow each other" */}
      <div className="flex-1 flex flex-col gap-4">
        {filteredReminders.length === 0 ? (
          /* Empty state matching the mockup */
          <div className="flex flex-col items-center justify-center py-20 text-center select-none bg-slate-50/25 border border-dashed border-[#E5E5EA] rounded-2xl p-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-blue-600 border border-[#E5E5EA]">
              <Check className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm font-extrabold text-gray-800 font-sans">No tasks yet. Add one above!</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm font-semibold">
              Create standalone agenda to-dos or dictate voice memos with a reminder tag. All tasks will automatically populate here.
            </p>
          </div>
        ) : (
          filteredReminders.map((note) => {
            const isExpanded = expandedId === note.id;
            const subTodos = note.subTodos || [];
            const completedCount = subTodos.filter((t) => t.completed).length;
            const totalCount = subTodos.length;

            return (
              <div
                key={note.id}
                id={`task-rem-card-${note.id}`}
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                  isExpanded
                    ? "bg-slate-50/40 border-[#D1D1D6] shadow-xs"
                    : "bg-white hover:bg-slate-50/20 border-[#E5E5EA] shadow-3xs"
                }`}
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : note.id)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap text-gray-400 font-mono text-[9px] font-bold uppercase tracking-wide">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      {note.scheduledDate && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-blue-600 font-extrabold bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-sans">
                            ⏰ {note.scheduledDate}
                          </span>
                        </>
                      )}
                      {totalCount > 0 && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-[#E5E5EA] text-gray-650 font-sans font-extrabold flex items-center gap-1 normal-case tracking-normal text-[8.5px]">
                            <ListTodo className="w-3 h-3 text-gray-400" />
                            {completedCount}/{totalCount} Completed
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-600 shrink-0" />
                      <h3 className="text-sm font-bold text-[#1C1C1E] truncate pr-2">
                        {note.title}
                      </h3>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {note.audioData && (
                      <button
                        onClick={() => handlePlayAudio(note)}
                        className={`p-2.5 rounded-xl transition-all border cursor-pointer ${
                          playingId === note.id
                            ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                            : "bg-white text-gray-600 border-[#D1D1D6] hover:bg-slate-50"
                        }`}
                        title="Play Dictation Voice Memo"
                      >
                        {playingId === note.id ? (
                          <Pause className="w-3.5 h-3.5 fill-red-600" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-gray-600" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : note.id)}
                      className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-gray-500 hover:text-gray-800 border border-[#D1D1D6] transition-all cursor-pointer"
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
                      {/* Checklist rendering */}
                      {subTodos.length > 0 && (
                        <div className="flex flex-col gap-2 bg-slate-50/50 border border-[#E5E5EA] p-4 rounded-xl">
                          <span className="text-[10px] font-mono uppercase font-extrabold tracking-wider text-gray-400">Action checklist items:</span>
                          {subTodos.map((todo) => (
                            <div
                              key={todo.id}
                              onClick={() => onToggleActionItem(note.id, todo.text, !todo.completed)}
                              className="flex items-start gap-3 cursor-pointer select-none py-1 group"
                            >
                              {todo.completed ? (
                                <div className="mt-0.5 p-0.5 rounded bg-green-50 text-green-600 border border-green-200">
                                  <Check className="w-3.5 h-3.5 text-green-650 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="mt-0.5 w-4.5 h-4.5 rounded border border-gray-350 bg-white group-hover:border-blue-600 transition-all" />
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

                      {/* Brief details transcript summary if there was voice dictation */}
                      {note.transcript && note.transcript !== "Manually created checklist task entry." && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-mono uppercase font-bold text-gray-400">Full Transcription Content:</span>
                          <div className="p-3.5 bg-slate-50 border border-[#E5E5EA] rounded-xl text-xs text-gray-650 leading-relaxed font-semibold">
                            {note.transcript}
                          </div>
                        </div>
                      )}

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
                          className="text-[10.5px] font-bold text-red-650 hover:text-white hover:bg-red-600 bg-white border border-[#D1D1D6] hover:border-red-600 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-3xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Task
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
