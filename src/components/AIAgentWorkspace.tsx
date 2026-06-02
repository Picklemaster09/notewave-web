import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, Send, Bot, User, RefreshCw, Trash2, Calendar, 
  Search, ShieldAlert, Cpu, CheckCircle2, MessageSquare, ListTodo, Info
} from "lucide-react";
import { RecordingNote, UserTier } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { apiUrl } from "../config";
import { getAuthHeaders } from "../supabase";

interface AIAgentWorkspaceProps {
  notes: RecordingNote[];
  language?: string;
  tier?: UserTier;
  customApiKey?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
}

export default function AIAgentWorkspace({
  notes,
  language = "en",
  tier = "free",
  customApiKey = ""
}: AIAgentWorkspaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("notewave_agent_chat");
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });
  
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ limit: number; remaining: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const isEs = language === "es";

  // Label Dictionary
  const t = {
    title: isEs ? "Mesa de Trabajo del Agente de IA" : "AI Agent Workspace Board",
    subtitle: isEs 
      ? "Consulta y busca sobre tu base de tareas completa e ideas de diseño usando el sistema RAG inteligente." 
      : "Query and retrieve details from your entire task base and design ideas using full RAG matching.",
    placeholder: isEs ? "Pregúntale al agente sobre tus tareas o ideas..." : "Ask the agent anything about your workspace notes & tasks...",
    rateLimitWarning: isEs 
      ? "Cada consulta consume 1 solicitud diaria. Modo Libre: 3 al día. Premium: 50 al día." 
      : "Each query consumes 1 prompt request. Free Mode: 3/day. Premium Mode: 50/day.",
    noMessages: isEs 
      ? "¡Sola con tu imaginación! Haz una pregunta o selecciona una sugerencia a continuación para iniciar la búsqueda RAG." 
      : "Start chat! Ask a question or click a suggestion below to search through your workspace.",
    customApiKeyWarning: isEs
      ? "Está utilizando su propia clave de API personal en los ajustes."
      : "You are using your personal API key configured in Settings.",
    notesSummaryChip: isEs ? "Resumen de las tareas de la última semana" : "Summarize last week's tasks",
    ideasSearchChip: isEs ? "Buscar mis ideas sobre software o apps" : "Find my software & app ideas",
    urgentFilterChip: isEs ? "Listar tareas urgentes o pendientes" : "List all critical pending to-dos",
    clearingChat: isEs ? "Borrando chat..." : "Clearing chat history...",
  };

  useEffect(() => {
    localStorage.setItem("notewave_agent_chat", JSON.stringify(messages));
    // Scroll only the chat container to its bottom — never scrollIntoView,
    // which would also scroll the page window and nudge the whole screen down
    // when switching to this tab.
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Fetch usage limit info on mount and on message additions
  const fetchUsageDetails = async () => {
    try {
      const response = await fetch(apiUrl(`/api/usage?tier=${tier}`), {
        headers: { ...(await getAuthHeaders()) },
      });
      if (response.ok) {
        const data = await response.json();
        setRateLimitInfo({ limit: data.limit, remaining: data.remaining });
      }
    } catch (e) {
      console.error("Error updating limit info:", e);
    }
  };

  useEffect(() => {
    fetchUsageDetails();
  }, [tier, messages]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isProcessing) return;

    setErrorMessage(null);
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsProcessing(true);

    try {
      // Map message structures for API body
      const apiPayload = {
        messages: [...messages, userMsg].map(m => ({
          role: m.role,
          content: m.content
        })),
        notes: notes.map(n => ({
          title: n.title,
          transcript: n.transcript,
          ideaSummary: n.ideaSummary,
          category: n.category,
          scheduledDate: n.scheduledDate,
          projectStartDate: n.projectStartDate,
          tags: n.tags,
          subTodos: n.subTodos?.map(t => ({ text: t.text, completed: t.completed })) || []
        })),
        tier,
        customApiKey,
        language
      };

      const response = await fetch(apiUrl("/api/ai-agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify(apiPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed execution");
      }

      setMessages(prev => [
        ...prev,
        {
          id: `msg_model_${Date.now()}`,
          role: "model",
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      
      // Update usage remaining
      fetchUsageDetails();

    } catch (err: any) {
      console.error("Chat error:", err);
      setErrorMessage(
        err.message || (isEs ? "Error al contactar al Agente de IA. Inténtalo de nuevo." : "Failed to retrieve answer from AI Agent. Reset/Verify tier keys.")
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    localStorage.removeItem("notewave_agent_chat");
  };

  // Simple markdown compiler for model messages
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    
    let currentList: { items: { text: string; checked?: boolean }[] } | null = null;
    
    const flushList = (key: number) => {
      if (!currentList) return null;
      const list = currentList;
      currentList = null;
      
      return (
        <ul key={`list-${key}`} className="list-disc pl-5 my-2.5 space-y-1.5 text-gray-700">
          {list.items.map((item, i) => {
            if (item.checked !== undefined) {
              return (
                <li key={i} className="list-none flex items-start gap-2 text-xs font-semibold">
                  <input 
                    type="checkbox" 
                    checked={item.checked} 
                    readOnly 
                    className="w-3.5 h-3.5 mt-0.5 rounded border border-gray-300 text-blue-600 focus:ring-blue-500 cursor-default shrink-0 accent-blue-600" 
                  />
                  <span className="text-gray-750 flex-1">{parseInline(item.text)}</span>
                </li>
              );
            }
            return (
              <li key={i} className="text-xs font-semibold leading-relaxed text-gray-700">
                {parseInline(item.text)}
              </li>
            );
          })}
        </ul>
      );
    };
    
    const parseInline = (inlineText: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      let remaining = inlineText;
      let index = 0;
      
      while (remaining.length > 0) {
        const boldIdx = remaining.indexOf("**");
        const italicIdx = remaining.indexOf("*");
        
        if (boldIdx === -1 && italicIdx === -1) {
          parts.push(<span key={index++}>{remaining}</span>);
          break;
        }
        
        if (boldIdx !== -1 && (italicIdx === -1 || boldIdx <= italicIdx)) {
          if (boldIdx > 0) {
            parts.push(<span key={index++}>{remaining.substring(0, boldIdx)}</span>);
          }
          const nextBoldIdx = remaining.indexOf("**", boldIdx + 2);
          if (nextBoldIdx !== -1) {
            const content = remaining.substring(boldIdx + 2, nextBoldIdx);
            parts.push(<strong key={index++} className="font-extrabold text-[#1C1C1E]">{content}</strong>);
            remaining = remaining.substring(nextBoldIdx + 2);
          } else {
            parts.push(<span key={index++}>**</span>);
            remaining = remaining.substring(boldIdx + 2);
          }
        } else {
          if (italicIdx > 0) {
            parts.push(<span key={index++}>{remaining.substring(0, italicIdx)}</span>);
          }
          const nextItalicIdx = remaining.indexOf("*", italicIdx + 1);
          if (nextItalicIdx !== -1) {
            const content = remaining.substring(italicIdx + 1, nextItalicIdx);
            parts.push(<em key={index++} className="italic text-gray-650">{content}</em>);
            remaining = remaining.substring(nextItalicIdx + 1);
          } else {
            parts.push(<span key={index++}>*</span>);
            remaining = remaining.substring(italicIdx + 1);
          }
        }
      }
      return parts;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (line.startsWith("### ")) {
        const listEl = flushList(i);
        if (listEl) elements.push(listEl);
        elements.push(
          <h4 key={`h3-${i}`} className="text-xs font-extrabold text-[#1C1C1E] mt-4 mb-2 tracking-tight block">
            {parseInline(line.substring(4))}
          </h4>
        );
      } else if (line.startsWith("## ")) {
        const listEl = flushList(i);
        if (listEl) elements.push(listEl);
        elements.push(
          <h3 key={`h2-${i}`} className="text-sm font-extrabold text-[#1C1C1E] mt-5 mb-2.5 tracking-tight block border-b border-gray-100 pb-1">
            {parseInline(line.substring(3))}
          </h3>
        );
      } else if (line.startsWith("# ")) {
        const listEl = flushList(i);
        if (listEl) elements.push(listEl);
        elements.push(
          <h2 key={`h1-${i}`} className="text-base font-black text-[#1C1C1E] mt-6 mb-3 tracking-tight block">
            {parseInline(line.substring(2))}
          </h2>
        );
      } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        if (!currentList) {
          currentList = { items: [] };
        }
        const rawItem = trimmed.substring(2).trim();
        if (rawItem.startsWith("[ ] ")) {
          currentList.items.push({ text: rawItem.substring(4), checked: false });
        } else if (rawItem.startsWith("[x] ") || rawItem.startsWith("[X] ")) {
          currentList.items.push({ text: rawItem.substring(4), checked: true });
        } else {
          currentList.items.push({ text: rawItem });
        }
      } else if (trimmed === "---") {
        const listEl = flushList(i);
        if (listEl) elements.push(listEl);
        elements.push(<hr key={`hr-${i}`} className="my-4 border-[#F2F2F7]" />);
      } else {
        if (trimmed === "") {
          const listEl = flushList(i);
          if (listEl) elements.push(listEl);
        } else {
          if (currentList) {
            const listEl = flushList(i);
            if (listEl) elements.push(listEl);
          }
          elements.push(
            <p key={`p-${i}`} className="text-xs leading-relaxed text-gray-700 font-semibold mb-2">
              {parseInline(line)}
            </p>
          );
        }
      }
    }

    const listEl = flushList(lines.length);
    if (listEl) elements.push(listEl);

    return <div className="space-y-1">{elements}</div>;
  };

  return (
    <div id="ai-agent-workspace-container" className="flex-1 flex flex-col gap-5 p-4 md:p-6 bg-white card-theme border border-[#E5E5EA] rounded-3xl shadow-xl font-sans text-primary-theme">
      
      {/* Header Widget detail */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F2F2F7] pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-150 flex items-center justify-center text-blue-600 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 id="ai-agent-title" className="text-base font-black tracking-tight text-[#1C1C1E]">{t.title}</h2>
            <p className="text-[10.5px] text-gray-500 font-semibold leading-relaxed mt-0.5">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto flex-wrap">
          {rateLimitInfo && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-[#E5E5EA] flex items-center gap-1.5 text-[10.5px] font-semibold text-gray-700 font-mono shrink-0 whitespace-nowrap">
              <Cpu className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>
                {tier === "premium" 
                  ? (isEs ? "👑 Modelo Pro" : "👑 Pro Model") 
                  : (isEs ? "🟢 Modelo Libre" : "🟢 Free Model")}
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600 font-bold">
                {rateLimitInfo.remaining} {isEs ? "Restantes" : "Left"}
              </span>
            </div>
          )}

          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="h-[34px] w-[34px] rounded-xl flex items-center justify-center border border-red-200 bg-red-50/50 text-red-650 hover:bg-red-600 hover:text-white hover:border-red-650 transition-all cursor-pointer shrink-0"
              title={t.clearingChat}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {customApiKey && (
        <div className="p-2 bg-[#F2F2F7] rounded-lg text-[10px] text-gray-600 font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
          <span>🔑 {t.customApiKeyWarning}</span>
        </div>
      )}

      {/* Chat Messages Body Panel */}
      <div
        ref={chatContainerRef}
        id="ai-agent-chat-history"
        className="flex-1 min-h-[320px] max-h-[480px] overflow-y-auto bg-slate-50/30 border border-[#E5E5EA] rounded-2xl p-4 flex flex-col gap-4 scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400 max-w-sm mx-auto select-none mt-12 mb-12">
            <Bot className="w-12 h-12 text-slate-300 mb-3 animate-bounce" />
            <h4 className="text-xs font-black text-gray-750 tracking-tight">{isEs ? "¡Pregúntale al Agente Workspace!" : "Ask Your Workspace Agent!"}</h4>
            <p className="text-[10px] text-gray-500 font-semibold leading-relaxed mt-2">{t.noMessages}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {messages.map((m) => (
              <div 
                key={m.id}
                className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* Avatar Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-3xs ${
                  m.role === "user" 
                    ? "bg-blue-600 border-blue-700 text-white" 
                    : "bg-indigo-50 border-indigo-250 text-indigo-700"
                }`}>
                  {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Balloon */}
                <div className={`flex flex-col gap-1 rounded-2xl p-3 px-3.5 text-xs leading-relaxed font-semibold ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-xs whitespace-pre-wrap"
                    : "bg-white text-gray-800 border border-[#D1D1D6] rounded-tl-xs shadow-3xs"
                }`}>
                  <div className="w-full">
                    {m.role === "user" ? m.content : renderMarkdown(m.content)}
                  </div>
                  <span className={`text-[8.5px] font-mono mt-1 select-none self-end ${m.role === "user" ? "text-blue-200" : "text-gray-400"}`}>
                    {m.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestion Prompt Chips */}
      {!inputValue && (
        <div className="flex flex-col gap-2">
          <span className="text-[9.5px] font-mono uppercase font-black tracking-wider text-gray-400 px-1">
            {isEs ? "Sugerencias de búsqueda rápida (RAG):" : "Quick retrieve suggestions (RAG):"}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleSendMessage(t.notesSummaryChip)}
              disabled={isProcessing}
              className="text-[10.5px] font-bold px-3 py-1.5 bg-white hover:bg-[#F2F2F7] border border-[#E5E5EA] rounded-full text-gray-700 transition-all cursor-pointer truncate max-w-full"
            >
              📋 {t.notesSummaryChip}
            </button>
            <button
              onClick={() => handleSendMessage(t.ideasSearchChip)}
              disabled={isProcessing}
              className="text-[10.5px] font-bold px-3 py-1.5 bg-white hover:bg-[#F2F2F7] border border-[#E5E5EA] rounded-full text-gray-700 transition-all cursor-pointer truncate max-w-full"
            >
              💡 {t.ideasSearchChip}
            </button>
            <button
              onClick={() => handleSendMessage(t.urgentFilterChip)}
              disabled={isProcessing}
              className="text-[10.5px] font-bold px-3 py-1.5 bg-white hover:bg-[#F2F2F7] border border-[#E5E5EA] rounded-full text-gray-700 transition-all cursor-pointer truncate max-w-full"
            >
              🔥 {t.urgentFilterChip}
            </button>
          </div>
        </div>
      )}

      {/* Errors display with high clear contrast */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 leading-relaxed font-bold animate-fadeIn">
          <ShieldAlert className="w-4 h-4 text-red-650 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>{isEs ? "Error de solicitud de IA" : "AI Agent Error"}</strong>: {errorMessage}
          </div>
        </div>
      )}

      {/* Form Input Control */}
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputValue);
        }}
        className="flex items-center gap-2"
      >
        <input
          id="ai-agent-chat-prompt-input"
          type="text"
          value={inputValue}
          disabled={isProcessing}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t.placeholder}
          className="flex-1 bg-slate-50 input-theme font-semibold border border-[#D1D1D6] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:bg-white focus:border-blue-500 text-gray-800 transition-all"
        />
        
        <button
          id="ai-agent-send-prompt-btn"
          type="submit"
          disabled={!inputValue.trim() || isProcessing}
          className={`p-3 rounded-xl flex items-center justify-center shadow-md transition-all ${
            inputValue.trim() && !isProcessing
              ? "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
              : "bg-slate-100 border border-[#E5E5EA] text-gray-400 cursor-not-allowed select-none"
          }`}
        >
          {isProcessing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>

      {/* Helper Footer Subtext */}
      <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold px-1 select-none">
        <span>🤖 {t.rateLimitWarning}</span>
        <span>Secure NoteWave Proxy</span>
      </div>

    </div>
  );
}
