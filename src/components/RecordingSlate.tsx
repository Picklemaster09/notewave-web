import { useState, useRef, useEffect } from "react";
import { Mic, Square, Sparkles, AlertTriangle, AlertCircle, Cpu, Loader2 } from "lucide-react";
import WaveformVisualizer from "./WaveformVisualizer";
import { RecordingNote, UserTier } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { getTranslation } from "../locale";

interface RecordingSlateProps {
  onRecordingComplete: (note: RecordingNote) => void;
  tier: UserTier;
  customApiKey: string;
  isTriggeredByActionBtn: boolean;
  onClearTrigger: () => void;
  language?: string;
}

export default function RecordingSlate({
  onRecordingComplete,
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      // Support common file formats natively (WebM / Ogg / MP4 depending on browser compatibility)
      let options = { mimeType: "audio/webm" };
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/ogg" };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "" }; // default fallback
      }

      const recorder = new MediaRecorder(stream, options);
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

  // Convert audio blob to base64 and fire Gemini cloud transcribers
  const processRecordingData = async () => {
    setIsProcessing(true);
    setErrorText(null);

    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const duration = recordingSeconds || 1; // Safely set min duration 1s

    if (audioBlob.size < 100) {
      setErrorText("Recording was too short. Please speak clearly to summarize notes.");
      setIsProcessing(false);
      return;
    }

    try {
      // Convert Blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = reader.result as string;

        try {
          const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
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
            if (result.error === "RATE_LIMIT_EXCEEDED") {
              setErrorText(result.message);
            } else if (result.error === "INVALID_CREDENTIALS") {
              setErrorText("Invalid API key configured. Please double check your personal credentials in Settings.");
            } else {
              setErrorText(result.message || "Unable to transcribe notes. Please try again.");
            }
            setIsProcessing(false);
            return;
          }

          // Build a successful Note record entry
          const data = result.data;
          const newNote: RecordingNote = {
            id: "note_" + Date.now(),
            title: data.headlineTitle || "Voice Recording note",
            duration: duration,
            createdAt: new Date().toISOString(),
            transcript: data.transcript || "No words transcribed.",
            ideaSummary: data.summaryText || "No conceptual tags.",
            actionItems: data.actionItems || "",
            category: data.category || "ideas",
            ideaName: data.ideaName || "",
            scheduledDate: data.scheduledDate || "",
            projectStartDate: data.projectStartDate || "",
            isComplex: !!data.isComplex,
            subTodos: Array.isArray(data.subTodos) ? data.subTodos : [],
            tags: (data.tags ? (typeof data.tags === "string" ? data.tags.split(",").map((s: string) => s.trim()) : data.tags) : ["audio"]).concat("voice"),
            modelUsed: result.model || (tier === "premium" ? "gemini-3.5-flash" : "gemini-3.1-flash-lite"),
            audioData: base64Data,
          };

          onRecordingComplete(newNote);

        } catch (e) {
          console.error("Transcription API network error:", e);
          setErrorText("Server Connection timeout. Ensure development server is configured.");
        } finally {
          setIsProcessing(false);
        }
      };
    } catch (e) {
      console.error("Audio recording parsing failed:", e);
      setErrorText("Error decoding recorded voice tracks.");
      setIsProcessing(false);
    }
  };

  // Humanize timer duration format
  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div id="recording-slate-container" className="p-6 rounded-2xl bg-white border border-[#E5E5EA] shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#1C1C1E] flex items-center gap-1.5 font-sans">
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
                <span className="text-2xl font-mono font-bold tracking-widest text-[#1C1C1E]">
                  {formatTimer(recordingSeconds)}
                </span>
              </div>
              <p className="text-xs text-[#8E8E93] font-sans font-semibold">{t.recordingActive}</p>
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
                <p className="text-sm font-bold text-[#1C1C1E]">{t.recordingProcessing}</p>
                <p className="text-xs text-[#8E8E93] mt-1">{t.recordingDone}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center font-sans"
            >
              <p className="text-xs text-[#8E8E93] px-6 leading-relaxed font-semibold">
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
