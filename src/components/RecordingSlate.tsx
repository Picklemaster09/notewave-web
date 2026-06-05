import { useState, useRef, useEffect } from "react";
import { Mic, Square, Sparkles, AlertTriangle, AlertCircle, Cpu, Loader2 } from "lucide-react";
import WaveformVisualizer from "./WaveformVisualizer";
import { RecordingNote, UserTier } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { getTranslation } from "../locale";
import { apiUrl } from "../config";
import { getAuthHeaders } from "../supabase";

interface RecordingSlateProps {
  // Adds the note immediately; resolves true if accepted (passed plan limits).
  onRecordingComplete: (note: RecordingNote) => Promise<boolean> | boolean;
  // Fills in / updates a note once the AI response arrives.
  onUpdateNote: (id: string, patch: Partial<RecordingNote>) => void;
  tier: UserTier;
  customApiKey: string;
  isTriggeredByActionBtn: boolean;
  onClearTrigger: () => void;
  language?: string;
}

export default function RecordingSlate({
  onRecordingComplete,
  onUpdateNote,
  tier,
  customApiKey,
  isTriggeredByActionBtn,
  onClearTrigger,
  language = "en",
}: RecordingSlateProps) {
  const t = getTranslation(language);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  
  // Audio state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Monitor trigger from bezel action button shortcut
  useEffect(() => {
    if (isTriggeredByActionBtn) {
      if (!isRecording) {
        startRecording();
      } else {
        stopRecording();
      }
      onClearTrigger(); // Reset action button parent trigger state
    }
  }, [isTriggeredByActionBtn]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    setErrorText(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      // Mono + noise suppression: cleaner speech and roughly half the data.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      setAudioStream(stream);

      // Opus in WebM is the best voice codec: tiny files with excellent speech
      // quality, and accepted as-is by both Gemini and OpenAI transcription, so
      // nothing is transcoded. Fall back through Ogg/Opus then container defaults.
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/webm",
        "audio/ogg",
      ];
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "";

      // ~32 kbps mono Opus is the sweet spot for voice — light yet clear.
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, audioBitsPerSecond: 32000 } : {}
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        processRecordingData();
      };

      recorder.start();
      setIsRecording(true);

      // Initialize timer tick
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Microphone access failed:", err);
      setErrorText("Could not access microphone. Please allow key permissions in your browser or iframe.");
    }
  };

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    mediaRecorderRef.current.stop();
    setIsRecording(false);

    // Stop all audio stream tracks
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      setAudioStream(null);
    }
  };

  // Add the note instantly with what we know, then fill in the AI fields in the
  // background so the recorder is immediately free for the next memo.
  const processRecordingData = async () => {
    setErrorText(null);
    setIsProcessing(true);

    // Use the recorder's real mime so the codec is labelled correctly end-to-end.
    const recordedMime = mediaRecorderRef.current?.mimeType || "audio/webm";
    const audioBlob = new Blob(audioChunksRef.current, { type: recordedMime });
    const duration = recordingSeconds || 1; // Safely set min duration 1s

    if (audioBlob.size < 100) {
      setErrorText("Recording was too short. Please speak clearly to summarize notes.");
      setIsProcessing(false);
      return;
    }

    // Read the blob to base64 (used both for the upload and instant playback).
    let base64Data: string;
    try {
      base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(audioBlob);
      });
    } catch (e) {
      console.error("Audio recording parsing failed:", e);
      setErrorText("Error decoding recorded voice tracks.");
      setIsProcessing(false);
      return;
    }

    // 1) Optimistic add — appears in history right away as "processing".
    const noteId = "note_" + Date.now();
    const fallbackModel = tier === "premium" ? "gemini-3.5-flash" : "gemini-3.1-flash-lite";
    const pendingNote: RecordingNote = {
      id: noteId,
      title: "",
      duration,
      createdAt: new Date().toISOString(),
      transcript: "",
      ideaSummary: "",
      actionItems: "",
      category: "ideas",
      subTodos: [],
      tags: ["voice"],
      audioData: base64Data, // instant local playback while the AI works
      audioBytes: audioBlob.size,
      modelUsed: fallbackModel,
      status: "processing",
    };

    const accepted = await onRecordingComplete(pendingNote);
    // Recorder is free again the moment the note is on screen.
    setIsProcessing(false);
    if (!accepted) return; // plan limit hit; parent surfaces the message

    // 2) Transcribe in the background and patch the note when it returns.
    try {
      const response = await fetch(apiUrl("/api/transcribe"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          audio: base64Data,
          tier: tier,
          customApiKey: customApiKey || undefined,
          language: language,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const modelDown = result.error === "MODEL_UNAVAILABLE";
        if (result.error === "RATE_LIMIT_EXCEEDED") {
          setErrorText(result.message);
        } else if (result.error === "STORAGE_LIMIT_EXCEEDED") {
          setErrorText(
            tier === "premium"
              ? result.message || "Audio storage is full. Delete some voice memos to free up space."
              : "Audio storage full on the free plan. Delete some memos or upgrade to Pro for more space."
          );
        } else if (modelDown) {
          // Both AI providers are unreachable — this doesn't count against the
          // user's daily quota, so reassure them and ask them to retry.
          setErrorText(result.message || "AI models aren't reachable right now. Please wait a few seconds and try again.");
        } else if (result.error === "INVALID_CREDENTIALS") {
          setErrorText("Invalid API key configured. Please double check your personal credentials in Settings.");
        } else {
          setErrorText(result.message || "Unable to transcribe notes. Please try again.");
        }
        onUpdateNote(noteId, {
          status: "failed",
          title: modelDown ? "Model not reachable — try again" : "Transcription failed",
        });
        return;
      }

      const data = result.data;
      // Tasks (reminders) are pure text — no raw transcript, no saved audio.
      // Ideas/notes keep the full transcript and the voice recording.
      const isReminder = data.category === "reminders";
      onUpdateNote(noteId, {
        title: data.headlineTitle || "Voice Recording note",
        transcript: isReminder ? "" : (data.transcript || "No words transcribed."),
        ideaSummary: data.summaryText || "No conceptual tags.",
        actionItems: data.actionItems || "",
        category: data.category || "ideas",
        ideaName: data.ideaName || "",
        scheduledDate: data.scheduledDate || "",
        projectStartDate: data.projectStartDate || "",
        isComplex: !!data.isComplex,
        subTodos: Array.isArray(data.subTodos) ? data.subTodos : [],
        tags: (data.tags ? (typeof data.tags === "string" ? data.tags.split(",").map((s: string) => s.trim()) : data.tags) : ["audio"]).concat("voice"),
        modelUsed: result.model || fallbackModel,
        // Audio (R2 key or inline base64) is kept only for ideas/notes; tasks
        // discard it so nothing about the recording is stored.
        audioKey: isReminder ? undefined : (result.audioKey || undefined),
        audioData: isReminder ? undefined : (result.audioKey ? undefined : base64Data),
        audioBytes: isReminder ? 0 : (result.audioBytes || audioBlob.size),
        status: "ready",
      });
    } catch (e) {
      console.error("Transcription API network error:", e);
      setErrorText("Server Connection timeout. Ensure development server is configured.");
      onUpdateNote(noteId, { status: "failed", title: "Transcription failed" });
    }
  };

  // Humanize timer duration format
  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div id="recording-slate-container" className="p-6 rounded-2xl bg-white card-theme border border-[#E5E5EA] shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#1C1C1E] text-primary-theme flex items-center gap-1.5 font-sans">
          <Mic className="w-4 h-4 text-blue-600" /> {t.tabDictate}
        </h3>
        <span className={`text-[10px] font-mono tracking-wider font-semibold px-2 py-0.5 rounded-full ${
          tier === "premium" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-blue-100 text-blue-800 border border-blue-200"
        }`}>
          {tier === "premium" ? "👑 GEMINI FLASH" : "🎯 LITE VERSION"}
        </span>
      </div>

      {/* Embedded Siri-like Animated Vis */}
      <WaveformVisualizer isRecording={isRecording} stream={audioStream} />

      {/* Actions and Status indicators */}
      <div className="flex flex-col items-center justify-center py-4">
        <AnimatePresence mode="wait">
          {isRecording ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                <span className="text-2xl font-mono font-bold tracking-widest text-[#1C1C1E] text-primary-theme">
                  {formatTimer(recordingSeconds)}
                </span>
              </div>
              <p className="text-xs text-[#8E8E93] text-secondary-theme font-sans font-semibold">{t.recordingActive}</p>
            </motion.div>
          ) : isProcessing ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <div className="font-sans">
                <p className="text-sm font-bold text-[#1C1C1E] text-primary-theme">{t.recordingProcessing}</p>
                <p className="text-xs text-[#8E8E93] text-secondary-theme mt-1">{t.recordingDone}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center font-sans"
            >
              <p className="text-xs text-[#8E8E93] text-secondary-theme px-6 leading-relaxed font-semibold">
                {t.recordingMicTipIdle}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Buttons */}
      <div className="flex justify-center gap-4 font-sans">
        {isRecording ? (
          <button
            id="stop-record-btn"
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-all shadow-lg active:scale-95 cursor-pointer shadow-red-200"
          >
            <Square className="w-4 h-4 fill-white text-white" /> {language === "es" ? "Detener Grabación" : language === "fr" ? "Arrêter l'enregistrement" : language === "de" ? "Aufnahme beenden" : language === "cs" ? "Zastavit nahrávání" : language === "sk" ? "Zastaviť nahrávanie" : language === "ja" ? "録音を終了する" : "Stop Recording Note"}
          </button>
        ) : (
          <button
            id="start-record-btn"
            disabled={isProcessing}
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer shadow-blue-100"
          >
            <Mic className="w-4 h-4 text-white" /> {language === "es" ? "Comenzar Grabación" : language === "fr" ? "Démarrer l'enregistrement" : language === "de" ? "Aufnahme starten" : language === "cs" ? "Spustit nahrávání" : language === "sk" ? "Spustiť nahrávanie" : language === "ja" ? "録音を開始する" : "Start Capture Dictation"}
          </button>
        )}
      </div>

      {/* Error displays */}
      {errorText && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 leading-relaxed font-semibold font-sans">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
          <span>{errorText}</span>
        </div>
      )}
    </div>
  );
}
