import { useState, useRef, DragEvent, FormEvent } from "react";
import { UploadCloud, FileText, Sparkles, AlertCircle, Loader2, Clipboard } from "lucide-react";
import { RecordingNote, UserTier } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface TextUploadSlateProps {
  onUploadComplete: (note: RecordingNote) => void;
  tier: UserTier;
  customApiKey: string;
  language?: string;
}

export default function TextUploadSlate({
  onUploadComplete,
  tier,
  customApiKey,
  language = "en",
}: TextUploadSlateProps) {
  const [pasteText, setPasteText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse text using backend /api/analyze-text
  const processTextData = async (textToProcess: string, sourceName: string) => {
    if (!textToProcess.trim()) {
      setErrorText("Please paste some transcript text or drop a file first.");
      return;
    }

    setIsProcessing(true);
    setErrorText(null);

    // Calculate dynamic fake duration based on average speaking pace (140 words/minute)
    const wordCount = textToProcess.trim().split(/\s+/).length;
    const estimatedDuration = Math.max(5, Math.ceil((wordCount / 140) * 60));

    try {
      const response = await fetch("/api/analyze-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textToProcess,
          tier: tier,
          customApiKey: customApiKey || undefined,
          filename: sourceName,
          language: language,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error === "RATE_LIMIT_EXCEEDED") {
          setErrorText(result.message);
        } else if (result.error === "INVALID_CREDENTIALS") {
          setErrorText("Invalid API key configured. Please double check your personal credentials in Settings.");
        } else {
          setErrorText(result.message || "Unable to analyze document text. Please try again.");
        }
        setIsProcessing(false);
        return;
      }

      const data = result.data;
      const newNote: RecordingNote = {
        id: "note_" + Date.now(),
        title: data.headlineTitle || `Indexed: ${sourceName}`,
        duration: estimatedDuration,
        createdAt: new Date().toISOString(),
        transcript: data.transcript || textToProcess,
        ideaSummary: data.summaryText || "No conceptual tags.",
        actionItems: data.actionItems || "",
        category: data.category || "ideas",
        ideaName: data.ideaName || "",
        scheduledDate: data.scheduledDate || "",
        projectStartDate: data.projectStartDate || "",
        isComplex: !!data.isComplex,
        subTodos: Array.isArray(data.subTodos) ? data.subTodos : [],
        tags: (data.tags 
          ? (typeof data.tags === "string" ? data.tags.split(",").map((s: string) => s.trim()) : data.tags) 
          : ["document"]).concat("uploaded"),
        modelUsed: result.model || (tier === "premium" ? "gemini-3.5-flash" : "gemini-3.1-flash-lite"),
      };

      onUploadComplete(newNote);
      setPasteText("");
      setFilename(null);

    } catch (e) {
      console.error("Analysis API network error:", e);
      setErrorText("Server connection timeout. Ensure standard development server is active.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Draggable Drop Handlers
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      handleFileSelected(target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setErrorText(null);
    // Support basic text, markdown, csv, lyrics, html
    const allowedExtensions = ["txt", "md", "csv", "lrc", "html", "json"];
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";

    if (!allowedExtensions.includes(fileExt) && file.type !== "text/plain") {
      setErrorText("Only text or markdown files (.txt, .md, .csv) are supported for transcription analysis.");
      return;
    }

    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && event.target.result) {
        setPasteText(event.target.result as string);
      }
    };
    reader.onerror = () => {
      setErrorText("Could not read uploaded file content.");
    };
    reader.readAsText(file);
  };

  const onZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    processTextData(pasteText, filename || "Pasted Text Transcript");
  };

  return (
    <div id="text-upload-container" className="p-6 rounded-2xl bg-white border border-[#E5E5EA] shadow-sm flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#1C1C1E] flex items-center gap-1.5 font-sans">
          <FileText className="w-4 h-4 text-blue-600" /> Process Texts & Transcripts
        </h3>
        <span className={`text-[10px] font-mono tracking-wider font-semibold px-2 py-0.5 rounded-full ${
          tier === "premium" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-blue-100 text-blue-800 border border-blue-200"
        }`}>
          {tier === "premium" ? "👑 GEMINI FLASH" : "🎯 LITE VERSION"}
        </span>
      </div>

      <p className="text-xs text-gray-550 leading-relaxed font-sans font-semibold">
        Import meeting transcripts, Zoom logs, notes, or files. We will process and index them to build structured summaries, custom action items, and reliable RAG database search structures.
      </p>

      {/* Interactive Drag & Drop Area */}
      <div 
        id="drag-drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onZoneClick}
        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
          isDragActive 
            ? "border-blue-500 bg-blue-50/50" 
            : filename 
              ? "border-green-400 bg-green-50/20" 
              : "border-gray-200 hover:border-blue-400 hover:bg-gray-50/55"
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".txt,.md,.csv,.lrc,.html,.json"
          className="hidden" 
        />
        <div className="flex flex-col items-center justify-center gap-1.5">
          <UploadCloud className={`w-8 h-8 ${filename ? "text-green-600" : "text-blue-500"}`} />
          {filename ? (
            <div className="font-sans text-xs">
              <span className="font-bold text-green-700">Loaded:</span>{" "}
              <span className="font-mono text-gray-650 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{filename}</span>
            </div>
          ) : (
            <div className="font-sans text-xs flex flex-col gap-0.5">
              <span className="font-semibold text-gray-700">Drag & drop a text file here, or click to browse</span>
              <span className="text-[10px] text-gray-400">Supports .txt, .md, .csv up to 2MB</span>
            </div>
          )}
        </div>
      </div>

      {/* Plaintext Paste area */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-sans">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Clipboard className="w-3.5 h-3.5 text-blue-500" /> Raw Text Transcript:
          </label>
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            disabled={isProcessing}
            placeholder="Paste your transcript logs, Slack items, daily ideas drafts, or plans here..."
            className="w-full bg-[#F9F9F9] font-sans text-xs text-gray-800 placeholder-gray-400 p-3 rounded-xl border border-[#D1D1D6] focus:bg-white focus:outline-none focus:border-blue-500 transition-all font-semibold resize-none"
          />
        </div>

        {errorText && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 leading-relaxed font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
            <span>{errorText}</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            id="submit-transcript-btn"
            disabled={isProcessing || !pasteText.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:shadow-none cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processing & indexing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Process data
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
