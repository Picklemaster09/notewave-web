import { useState, useRef, FormEvent } from "react";
import { RecordingNote, SubTodo } from "../types";
import { 
  Plus, Calendar, Clock, Trash2, Play, Pause, ListTodo, 
  Sparkles, ChevronDown, ChevronUp, Bell, Check, Tag, AlertCircle, Search, X
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
  // Global search and status filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed">("all");
  
  // Custom Interactive selection filters (low, medium, high / work personal)
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Popup Modal state for adding a new task
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  // New task form fields
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [taskCategory, setTaskCategory] = useState<"Work" | "Personal" | "Health" | "Learning" | "Ideas">("Work");
  const [scheduledDate, setScheduledDate] = useState("");

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

  // Translations helper
  const getLabel = (key: string) => {
    const isEs = language === "es";
    switch (key) {
      case "tasks": return isEs ? "Tareas" : "Tasks";
      case "manage": return isEs ? "Administra tus tareas y sigue el progreso" : "Manage your to-dos and track progress";
      case "all": return isEs ? "Todas" : "All";
      case "active": return isEs ? "Activas" : "Active";
      case "completed": return isEs ? "Completadas" : "Completed";
      case "searchPlaceholder": return isEs ? "Buscar tareas..." : "Search tasks...";
      case "addTask": return isEs ? "Agregar Tarea" : "Add Task";
      case "createTask": return isEs ? "Crear Nueva Tarea" : "Create New Task";
      case "taskTitle": return isEs ? "Título de la Tarea" : "Task Title";
      case "typeCategory": return isEs ? "Categoría" : "Category";
      case "priority": return isEs ? "Prioridad" : "Priority";
      case "schedDate": return isEs ? "Fecha de Agenda" : "Scheduled Date";
      case "saveTask": return isEs ? "Guardar Tarea" : "Save Task";
      case "cancel": return isEs ? "Cancelar" : "Cancel";
      default: return key;
    }
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

  // Create manual task from modal pop up
  const handleAddTaskSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const newTodoId = `sub_${Date.now()}`;
    const parsedSubTodos: SubTodo[] = [
      {
        id: newTodoId,
        text: taskTitle.trim(),
        completed: false
      }
    ];

    const tags = [taskPriority, taskCategory, "Manual"];

    // Use selected scheduled date or defaults to today
    const finalDate = scheduledDate || new Date().toLocaleDateString();

    const newNote: RecordingNote = {
      id: `manual_task_${Date.now()}`,
      title: taskTitle.trim(),
      duration: 0,
      createdAt: new Date().toISOString(),
      transcript: `Manually added task. Priority: ${taskPriority}, Category: ${taskCategory}.`,
      ideaSummary: `Checkbox task list item: ${taskTitle}`,
      actionItems: `- [ ] ${taskTitle}`,
      category: "reminders",
      ideaName: taskCategory,
      scheduledDate: finalDate,
      subTodos: parsedSubTodos,
      tags: tags,
      modelUsed: "NoteWave Workspace"
    };

    onAddManualNote(newNote);
    
    // Clear & close modal state
    setTaskTitle("");
    setScheduledDate("");
    setTaskPriority("Medium");
    setTaskCategory("Work");
    setShowAddTaskModal(false);
    
    triggerFlashSuccess(`Task "${newNote.title}" added successfully!`);
  };

  const triggerFlashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  // Filter existing Reminder logs
  const remindersList = notes.filter((note) => note.category === "reminders");

  // Filter based on Search term, status, priority selected, and category selected
  const filteredReminders = remindersList.filter((note) => {
    // 1. Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const matchText = (note.title + " " + (note.transcript || "") + " " + (note.ideaSummary || "")).toLowerCase();
      if (!matchText.includes(searchLower)) return false;
    }

    // 2. Status toggle filter (All, Active, Completed)
    const todos = note.subTodos || [];
    if (filterStatus === "active") {
      if (todos.length === 0) return true;
      if (!todos.some((t) => !t.completed)) return false;
    } else if (filterStatus === "completed") {
      if (todos.length === 0) return false;
      if (!todos.every((t) => t.completed)) return false;
    }

    // 3. Priority query state
    if (selectedPriorityFilter !== "all") {
      const matchesPriority = note.tags?.some(tag => tag.toLowerCase() === selectedPriorityFilter.toLowerCase());
      if (!matchesPriority) return false;
    }

    // 4. Category query state
    if (selectedCategoryFilter !== "all") {
      const matchesCategoryTag = note.tags?.some(tag => tag.toLowerCase() === selectedCategoryFilter.toLowerCase());
      const matchesIdeaName = note.ideaName?.toLowerCase() === selectedCategoryFilter.toLowerCase();
      if (!matchesCategoryTag && !matchesIdeaName) return false;
    }

    return true;
  });

  return (
    <div 
      id="tasks-workspace-view" 
      className="flex-1 flex flex-col gap-6 p-6 rounded-2xl bg-white card-theme border border-[#E5E5EA] text-[#1C1C1E] text-primary-theme font-sans shadow-sm"
    >
      {/* Header aligned like mockup screenshot with New Task action button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#1C1C1E] text-primary-theme font-sans flex items-center gap-2">
            {getLabel("tasks")}
          </h1>
          <p className="text-xs text-gray-500 font-semibold mt-1">
            {getLabel("manage")}
          </p>
        </div>

        {/* Plus action button triggers dialog pop-up */}
        <button
          onClick={() => setShowAddTaskModal(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer shadow-3xs flex items-center gap-1.5 uppercase tracking-wider"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          {getLabel("addTask")}
        </button>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl text-xs font-semibold leading-normal bg-green-50 border border-green-150 text-green-700 animate-pulse">
          ✔️ {successMsg}
        </div>
      )}

      {/* Row containing SEARCH tasks... and Status switches next to it (mirrors Notes & Ideas) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 p-2.5 rounded-xl border border-[#E5E5EA]">
        
        {/* Search bar on the left */}
        <div id="tasks-search-bar" className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={getLabel("searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white text-xs text-[#1C1C1E] placeholder-gray-400 pl-9 pr-4 py-2.5 rounded-lg border border-[#E5E5EA] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold font-sans"
          />
        </div>

        {/* Segment switches on the right next to search */}
        <div className="flex items-center gap-1 bg-[#F2F2F7] p-1 rounded-xl border border-[#E5E5EA] select-none shrink-0">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterStatus === "all"
                ? "bg-white text-gray-800 shadow-3xs"
                : "text-gray-500 hover:text-[#1C1C1E]"
            }`}
          >
            {getLabel("all")}
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterStatus === "active"
                ? "bg-white text-gray-800 shadow-3xs"
                : "text-gray-500 hover:text-[#1C1C1E]"
            }`}
          >
            {getLabel("active")}
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterStatus === "completed"
                ? "bg-white text-gray-800 shadow-3xs"
                : "text-gray-500 hover:text-[#1C1C1E]"
            }`}
          >
            {getLabel("completed")}
          </button>
        </div>
      </div>

      {/* Custom filters: All, Low, Medium, High Priority, and Work / Personal Category select rows (no tag clouds) */}
      <div className="flex flex-col gap-2 bg-slate-50/50 p-3.5 rounded-xl border border-[#E5E5EA] text-xs gap-y-3 font-sans shadow-3xs">
        
        {/* Priority Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">
            {getLabel("priority")}:
          </span>
          {["all", "Low", "Medium", "High", "Urgent"].map((prio) => (
            <button
              key={prio}
              onClick={() => setSelectedPriorityFilter(prio)}
              className={`text-[9.5px] font-sans font-black px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                selectedPriorityFilter === prio
                  ? "bg-slate-200 text-gray-850 border-[#D1D1D6]"
                  : "bg-slate-100 text-gray-500 border-transparent hover:bg-slate-200/50 hover:text-[#1C1C1E]"
              }`}
            >
              {prio === "all" ? "All" : prio}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">
            {getLabel("typeCategory")}:
          </span>
          {["all", "Work", "Personal", "Health", "Learning", "Ideas"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`text-[9.5px] font-sans font-black px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                selectedCategoryFilter === cat
                  ? "bg-slate-200 text-gray-850 border-[#D1D1D6]"
                  : "bg-slate-100 text-gray-500 border-transparent hover:bg-slate-200/50 hover:text-[#1C1C1E]"
              }`}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Checklist rendering - expandable and responsive */}
      <div className="flex-1 flex flex-col gap-4">
        {filteredReminders.length === 0 ? (
          /* Empty state matching mockup */
          <div className="flex flex-col items-center justify-center py-20 text-center select-none bg-slate-50/25 border border-dashed border-[#E5E5EA] rounded-2xl p-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-blue-600 border border-[#E5E5EA]">
              <Check className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm font-extrabold text-gray-800 font-sans">
              {language === "es" ? "Sin tareas encontradas" : "No tasks match criteria"}
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm font-semibold">
              {language === "es" 
                ? "No hay tareas que coincidan con tus filtros. Crea una nueva tarea usando el botón superior."
                : "No matching tasks currently display. Click \"Add Task\" at the top to initialize standalone agenda items!"}
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
                    : "bg-white card-theme hover:bg-slate-50/20 border-[#E5E5EA] shadow-3xs"
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
                            {completedCount}/{totalCount} {language === "es" ? "Completadas" : "Completed"}
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
                          {note.tags?.map((tag) => (
                            <span key={tag} className="text-[9.5px] font-bold text-gray-500 bg-slate-100 border border-[#E5E5EA] px-2 py-0.5 rounded-md">
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <button
                          onClick={() => onDeleteNote(note.id)}
                          className="text-[10.5px] font-bold text-red-600 hover:text-white hover:bg-red-600 bg-red-50/10 border border-red-200/40 hover:border-red-600 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-3xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {language === "es" ? "Eliminar Tarea" : "Delete Task"}
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

      {/* DIALOG POP-UP MODAL WINDOW FOR NEW TASKS ADDITION */}
      <AnimatePresence>
        {showAddTaskModal && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white card-theme text-[#1C1C1E] text-primary-theme w-full max-w-md rounded-2xl border border-[#E5E5EA] shadow-2xl p-6 relative font-sans"
            >
              {/* Close Button X */}
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header Title */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Sparkles className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight">{getLabel("createTask")}</h2>
                  <p className="text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">Configure Standalone Reminders</p>
                </div>
              </div>

              {/* Form elements */}
              <form onSubmit={handleAddTaskSubmit} className="flex flex-col gap-4">
                
                {/* Task Title Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-500">{getLabel("taskTitle")}</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex. Wash the car or prepare proposal draft"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full bg-white text-xs text-[#1C1C1E] placeholder-gray-400 px-3.5 py-2.5 rounded-xl border border-[#E5E5EA] focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  />
                </div>

                {/* Date Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-500">{getLabel("schedDate")}</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-white text-xs text-[#1C1C1E] px-3.5 py-2.5 rounded-xl border border-[#E5E5EA] focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold cursor-pointer"
                  />
                </div>

                {/* Priority Selector Grid */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-500">{getLabel("priority")}</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["Low", "Medium", "High", "Urgent"] as const).map((prio) => (
                      <button
                        type="button"
                        key={prio}
                        onClick={() => setTaskPriority(prio)}
                        className={`py-2 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                          taskPriority === prio
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-white text-gray-500 border-[#E5E5EA] hover:bg-slate-50"
                        }`}
                      >
                        {prio}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category Selector Grid */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-500">{getLabel("typeCategory")}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(["Work", "Personal", "Health", "Learning", "Ideas"] as const).map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setTaskCategory(cat)}
                        className={`py-2 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                          taskCategory === cat
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-white text-gray-500 border-[#E5E5EA] hover:bg-slate-50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action CTA Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E5EA] mt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddTaskModal(false)}
                    className="text-xs font-extrabold text-gray-500 hover:text-gray-800 px-3 py-2 cursor-pointer transition-all"
                  >
                    {getLabel("cancel")}
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-3xs flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2]" />
                    {getLabel("saveTask")}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
