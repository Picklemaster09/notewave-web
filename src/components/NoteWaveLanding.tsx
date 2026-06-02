import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Mail, Lock, User, Smartphone, Play, Pause, 
  Check, Layers, Cpu, Database, ChevronRight, AlertCircle, 
  ArrowRight, ShieldCheck, FileText, Bell, ListTodo, Key, 
  Settings as SettingsIcon, Compass, Share2, Clock, Loader2
} from "lucide-react";
import { RecordingNote } from "../types";
import { apiUrl } from "../config";

interface NoteWaveLandingProps {
  onLanguageChange?: (lang: string) => void;
  currentLanguage?: string;
  onLogin?: (opts?: { signup?: boolean; connection?: string }) => void;
}

export default function NoteWaveLanding({ onLanguageChange, currentLanguage = "en", onLogin }: NoteWaveLandingProps) {
  // Auth Form State
  const [authTab, setAuthTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  
  // States for handling UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [isAuth0Loading, setIsAuth0Loading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Real voice recording on landing page (Guest Sandbox)
  const [customDemoNote, setCustomDemoNote] = useState<any>(null);
  const [isDemoRecording, setIsDemoRecording] = useState(false);
  const [demoRecordingSeconds, setDemoRecordingSeconds] = useState(0);
  const [isDemoProcessing, setIsDemoProcessing] = useState(false);
  const [demoAudioStream, setDemoAudioStream] = useState<MediaStream | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  const demoMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const demoAudioChunksRef = useRef<Blob[]>([]);
  const demoTimerRef = useRef<any>(null);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (demoTimerRef.current) {
        clearInterval(demoTimerRef.current);
      }
    };
  }, []);

  const startDemoRecording = async () => {
    setDemoError(null);
    demoAudioChunksRef.current = [];
    setDemoRecordingSeconds(0);
    
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }

    if (isPlayingDemoMedia) {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      setIsPlayingDemoMedia(false);
      setDemoPlayTime(0);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setDemoAudioStream(stream);

      let options = { mimeType: "audio/webm" };
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/ogg" };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "" };
      }

      const recorder = new MediaRecorder(stream, options);
      demoMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          demoAudioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        processDemoRecordingData();
      };

      recorder.start();
      setIsDemoRecording(true);

      demoTimerRef.current = window.setInterval(() => {
        setDemoRecordingSeconds((prev) => {
          if (prev >= 9) {
            stopDemoRecording(recorder, stream);
            return 10;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error("Demo Microphone access failed:", err);
      setDemoError("Microphone access was denied. Check browser permissions or open in a new tab.");
    }
  };

  const stopDemoRecording = (
    customRecorder?: MediaRecorder | null, 
    customStream?: MediaStream | null
  ) => {
    const activeRecorder = customRecorder || demoMediaRecorderRef.current;
    const activeStream = customStream || demoAudioStream;

    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }

    if (activeRecorder && activeRecorder.state !== "inactive") {
      activeRecorder.stop();
    }
    
    setIsDemoRecording(false);

    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      setDemoAudioStream(null);
    }
  };

  const processDemoRecordingData = async () => {
    setIsDemoProcessing(true);
    setDemoError(null);

    const audioBlob = new Blob(demoAudioChunksRef.current, { type: "audio/webm" });
    const duration = demoRecordingSeconds || 1;

    if (audioBlob.size < 100) {
      setDemoError("Recording was too short. Speak clearly to transcribe and index.");
      setIsDemoProcessing(false);
      return;
    }

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = reader.result as string;

        try {
          const response = await fetch(apiUrl("/api/transcribe"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              audio: base64Data,
              tier: "free",
              language: "Auto-Detect"
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            if (result.error === "RATE_LIMIT_EXCEEDED") {
              setDemoError("Free sandbox limit reached. Register a sync account below to enjoy infinite audio processing!");
            } else {
              setDemoError(result.message || "Failed to transcribe audio.");
            }
            setIsDemoProcessing(false);
            return;
          }

          const data = result.data;

          setDemoTasks(Array.isArray(data.subTodos) && data.subTodos.length > 0 ? data.subTodos : [
            { id: "dt_custom_1", text: "Confirm meeting targets outline", completed: false }
          ]);
          setDemoActiveTab("checklist");
          
          setCustomDemoNote({
            headlineTitle: data.headlineTitle || "Your Personal Speech note",
            transcript: data.transcript || "No words parsed.",
            summaryText: data.summaryText || "No context summarized.",
            category: data.category || "ideas",
            ideaName: data.ideaName || "",
            duration: duration,
            scheduledDate: data.scheduledDate || "",
            projectStartDate: data.projectStartDate || "",
          });

        } catch (e) {
          console.warn("Demo API connection fallback to high-fidelity Offline Local Sandbox:", e);
          
          setDemoTasks([
            { id: "dt_fail_1", text: "Create high-fidelity landing page mockup", completed: false },
            { id: "dt_fail_2", text: "Configure server-side Gemini 1.5 Flash transcription pipelines", completed: true },
            { id: "dt_fail_3", text: "Bypass sandbox limits by linking personal Gemini Key in Settings", completed: false },
            { id: "dt_fail_4", text: "Schedule main production launch milestones on the integrated agenda", completed: false }
          ]);
          setDemoActiveTab("checklist");
          setCustomDemoNote({
            headlineTitle: "Offline Sandbox Demo: Voice Roadmap Active",
            transcript: "You just recorded a live 10-second sandbox audio! Beautiful. Our audio waveform captures the microsecond intervals of your voice pitch, ready to compile tasks into custom bento grid schedules.",
            summaryText: "NoteWave was unable to connect to the cloud transcription servers directly. We have fallen back to our high-fidelity Sandbox Engine so you can interact with mock timelines. Link your creator account or set your personal Gemini API key in Settings!",
            category: "ideas",
            ideaName: "OFFLINE SANDBOX MODE",
            duration: duration,
            scheduledDate: "Today",
            projectStartDate: "Immediate kickoff",
          });
          setDemoError("NoteWave Cloud connection was reset or rate-limited. Enjoyed offline sandbox simulator! Configure your personal key in settings to unlock infinite speech processing.");
        } finally {
          setIsDemoProcessing(false);
        }
      };
    } catch (e) {
      console.error("Demo audio processing failed:", e);
      setDemoError("Could not decode voice tracks.");
      setIsDemoProcessing(false);
    }
  };

  // Interactive Demo Note state (Live simulation of a parsed NoteWave)
  const [demoActiveTab, setDemoActiveTab] = useState<"checklist" | "agenda" | "transcript">("checklist");
  const [isPlayingDemoMedia, setIsPlayingDemoMedia] = useState(false);
  const [demoPlayTime, setDemoPlayTime] = useState(0); // Playback elapsed in seconds
  const demoIntervalRef = useRef<any>(null);

  // Derive progress percentage
  const demoDuration = customDemoNote ? customDemoNote.duration : 10;
  const demoProgress = (demoPlayTime / demoDuration) * 100;

  // Clean the playback interval on unmount
  useEffect(() => {
    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
      }
    };
  }, []);

  // Interactive Checklist Tasks within the Demo Card (Polished 10-second default template)
  const [demoTasks, setDemoTasks] = useState([
    { id: "dt1", text: "Schedule teaser video kickoff (Monday 9:00 AM)", completed: false },
    { id: "dt2", text: "Draft clean Product Hunt visual banner", completed: false },
    { id: "dt3", text: "Enable early bird supporter email reminders", completed: true },
    { id: "dt4", text: "Draft maker's introductory story copy", completed: true }
  ]);

  const toggleDemoTask = (id: string) => {
    setDemoTasks(prev => prev.map(task => 
        task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  // Simulate precise real-time audio playback for the demo card (100ms clock interval tickers)
  const handleTogglePlayDemo = () => {
    if (isPlayingDemoMedia) {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      setIsPlayingDemoMedia(false);
    } else {
      setIsPlayingDemoMedia(true);
      const startSecs = demoPlayTime >= demoDuration ? 0 : demoPlayTime;
      setDemoPlayTime(startSecs);

      let currentVal = startSecs;
      demoIntervalRef.current = setInterval(() => {
        currentVal += 0.1;
        if (currentVal >= demoDuration) {
          clearInterval(demoIntervalRef.current);
          demoIntervalRef.current = null;
          setIsPlayingDemoMedia(false);
          setDemoPlayTime(0);
        } else {
          setDemoPlayTime(currentVal);
        }
      }, 100);
    }
  };

  // Email/password and social sign-in are handled on Auth0's hosted Universal
  // Login page (PKCE, no secret in the browser). These just kick off the redirect.
  const handleAuth0SocialSignIn = (connectionName?: string) => {
    onLogin?.({ connection: connectionName });
  };

  return (
    <div id="notewave-landing-page" className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E] flex flex-col justify-between selection:bg-blue-600/15 selection:text-blue-800">
      
      {/* Decorative ambient blobs */}
      <div className="absolute top-10 left-1/4 w-72 h-72 bg-blue-300 opacity-20 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-indigo-300 opacity-20 blur-3xl rounded-full pointer-events-none" />

      {/* Header Bar */}
      <header className="max-w-[1400px] mx-auto w-full px-6 lg:px-10 py-4 flex items-center justify-between z-10 relative mt-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-200">
            ~
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-[#1C1C1E] leading-none flex items-center gap-1.5">
              NoteWave
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold tracking-normal px-2 py-0.5 rounded-full">
                Cloud
              </span>
            </h1>
            <p className="text-[10.5px] text-gray-400 mt-1 font-semibold">Turn your voice into action — instantly.</p>
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="max-w-[1400px] mx-auto w-full px-6 lg:px-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start py-10 lg:py-16 z-10 relative">
        
        {/* LEFT COLUMN: App Pitch, Live Demo, Mobile Companions */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Pitch intro */}
          <div className="flex flex-col gap-3 max-w-xl">
            <span className="w-fit text-[10px] uppercase font-mono tracking-widest bg-blue-600/10 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200 font-extrabold shadow-3xs flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Try it live — no signup needed
            </span>
            <h2 className="text-4xl lg:text-5xl font-black text-[#1C1C1E] tracking-tight leading-[1.05] mt-1 font-sans">
              Just talk.<br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">We'll turn it into a plan.</span>
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed font-semibold mt-0.5">
              Ramble for ten seconds about a project, an errand, or a 2&nbsp;a.m. idea — NoteWave's AI hands you a clean transcript, a sharp summary, and a checklist you can actually act on. No typing. No setup.
            </p>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <span className="text-[10px] font-bold text-gray-600 bg-white border border-[#E5E5EA] px-2.5 py-1 rounded-full shadow-3xs">🎙️ 10-second voice notes</span>
              <span className="text-[10px] font-bold text-gray-600 bg-white border border-[#E5E5EA] px-2.5 py-1 rounded-full shadow-3xs">✨ Auto summaries &amp; tags</span>
              <span className="text-[10px] font-bold text-gray-600 bg-white border border-[#E5E5EA] px-2.5 py-1 rounded-full shadow-3xs">✅ Ready-to-check action lists</span>
            </div>
          </div>          {/* High-Fidelity Simulated Live Demo Note */}
          <div className="bg-white rounded-2xl border border-[#E5E5EA] shadow-xl overflow-hidden flex flex-col">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-blue-600" />
            
            <div className="p-4 flex flex-col gap-3">
              {/* Header block */}
              <div className="flex items-center justify-between gap-3 border-b border-[#F2F2F7] pb-3 font-sans">
                <div>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 w-fit rounded bg-indigo-50 border border-indigo-150 text-[9px] font-bold text-indigo-705 font-mono uppercase">
                    {customDemoNote ? (
                      customDemoNote.ideaName ? `🚀 ${customDemoNote.ideaName}` : (customDemoNote.category === "ideas" ? "💡 BRAIN MODULE" : "⏰ TASK BINDER")
                    ) : (
                      "🚀 LAUNCHWAVE HUB"
                    )}
                  </div>
                  <h3 className="text-xs font-black text-[#1C1C1E] mt-1.5 font-sans leading-tight">
                    {customDemoNote ? customDemoNote.headlineTitle : "Product Hunt Teaser Launch Plan (Simulated)"}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono font-bold text-gray-400 block shrink-0">
                    {customDemoNote ? `${customDemoNote.duration}s Voice` : "10s Dictation"}
                  </span>
                  <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-extrabold tracking-tight mt-0.5 block">
                    Gemini Flash Power
                  </span>
                </div>
              </div>

              {/* Live Waveform Mock & Audio Simulator */}
              <div className="bg-gray-50 border border-[#E5E5EA] rounded-xl p-3.5 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handleTogglePlayDemo}
                  className={`p-2.5 rounded-xl transition-all font-sans cursor-pointer flex-shrink-0 ${
                    isPlayingDemoMedia 
                      ? "bg-red-50 text-red-650 border border-red-200" 
                      : "bg-blue-600 text-white border border-blue-700 hover:bg-blue-500 shadow-sm"
                  }`}
                >
                  {isPlayingDemoMedia ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white text-white" />}
                </button>

                {/* Animated wave simulation */}
                <div className="flex-1 flex items-center gap-1 h-8 px-1">
                  {[4, 8, 12, 16, 20, 14, 8, 12, 18, 22, 16, 12, 8, 4, 10, 16, 12, 6, 14, 20, 16, 8, 12, 6, 10, 16, 12, 4, 8, 12].map((height, idx) => {
                    const progressLimit = (idx / 30) * 100;
                    const isActive = isPlayingDemoMedia && demoProgress >= progressLimit;
                    return (
                      <div
                        key={idx}
                        style={{ height: `${height * (isPlayingDemoMedia ? Math.sin(demoPlayTime * 5 + idx) * 0.5 + 0.8 : 0.8 / 1.5) + 4}px` }}
                        className={`w-full max-w-[4px] min-h-[3px] rounded-full transition-all duration-300 ${
                          isActive 
                            ? "bg-blue-600 shadow-xs shadow-blue-400" 
                            : isPlayingDemoMedia 
                            ? "bg-blue-300" 
                            : "bg-gray-300"
                        }`}
                      />
                    );
                  })}
                </div>

                <div className="text-[10px] font-mono font-bold text-gray-400 flex-shrink-0">
                  {isPlayingDemoMedia 
                    ? `0:${Math.floor(demoPlayTime) < 10 ? "0" + Math.floor(demoPlayTime) : Math.floor(demoPlayTime)}` 
                    : "0:00"} / 0:{customDemoNote ? customDemoNote.duration : "10"}
                </div>
              </div>

              {/* Fully Interactive Sandbox Voice Recorder Panel */}
              <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-3.5 flex flex-col gap-2 font-sans">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                    <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-widest font-sans">🎙️ Voice Onboarding Sandbox</span>
                  </div>
                  <span className="text-[9px] bg-blue-100 text-blue-700 font-mono px-2 py-0.5 rounded-full font-bold">10s Max Test</span>
                </div>

                <div className="flex flex-col gap-2 mt-1">
                  {isDemoRecording ? (
                    <div className="flex items-center justify-between gap-3 text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl font-bold animate-pulse font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-red-650 rounded-full animate-ping shrink-0" />
                        <span>Speaking live demo: {demoRecordingSeconds}s / 10s</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => stopDemoRecording()}
                        className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg border border-red-700 shadow-xs transition-all cursor-pointer"
                      >
                        Stop & Analyze
                      </button>
                    </div>
                  ) : isDemoProcessing ? (
                    <div className="flex items-center justify-center gap-2.5 text-xs text-blue-800 bg-blue-50 border border-blue-200 p-2.5 rounded-xl font-bold font-sans">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <span>Gemini Flash transcribing & styling checklist...</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startDemoRecording}
                      className="w-full text-xs font-black py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all flex items-center justify-center gap-2 border border-indigo-700 active:scale-97 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-200 animate-pulse" />
                      <span>{customDemoNote ? "🎙️ Dictate Another 10s Sandbox Demo" : "🎙️ Test Your Action Voice (10s Micro Demo)"}</span>
                    </button>
                  )}

                  {demoError && (
                    <div className="text-[10px] text-red-700 font-bold bg-red-50/70 border border-red-150 p-2 rounded-lg flex items-start gap-1.5 leading-normal">
                      <AlertCircle className="w-3.5 h-3.5 text-red-650 shrink-0 mt-0.5" />
                      <span>{demoError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab Selector inside simulated note */}
              <div className="flex border-b border-[#F2F2F7]">
                <button
                  type="button"
                  onClick={() => setDemoActiveTab("checklist")}
                  className={`flex-1 py-1.5 text-[10px] font-extrabold tracking-tight border-b-2 transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    demoActiveTab === "checklist"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <ListTodo className="w-3 h-3" /> Action Checklist ({demoTasks.filter(t => t.completed).length}/{demoTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDemoActiveTab("agenda")}
                  className={`flex-1 py-1.5 text-[10px] font-extrabold tracking-tight border-b-2 transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    demoActiveTab === "agenda"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <Bell className="w-3 h-3" /> Agenda Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setDemoActiveTab("transcript")}
                  className={`flex-1 py-1.5 text-[10px] font-extrabold tracking-tight border-b-2 transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    demoActiveTab === "transcript"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <FileText className="w-3 h-3" /> Speech Transcript
                </button>
              </div>

              {/* Tab Area Output with interactive checklist clicking */}
              <div className="min-h-[140px] max-h-[140px] overflow-y-auto p-1 text-xs">
                {demoActiveTab === "checklist" && (
                  <div className="flex flex-col gap-1.5">
                    {demoTasks.map((task, index) => (
                      <div
                        key={task.id || `task_${index}`}
                        onClick={() => toggleDemoTask(task.id)}
                        className="flex items-start gap-2.5 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-all select-none group font-sans"
                      >
                        {task.completed ? (
                          <div className="mt-0.5 p-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                            <Check className="w-3 h-3 text-green-600" />
                          </div>
                        ) : (
                          <div className="mt-0.5 w-4 h-4 rounded border border-gray-300 bg-white group-hover:border-blue-500 transition-all" />
                        )}
                        <span className={`text-[11px] leading-normal font-sans font-semibold ${
                          task.completed ? "text-gray-400 line-through font-normal" : "text-gray-700 font-bold"
                        }`}>
                          {task.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {demoActiveTab === "agenda" && (
                  <div className="flex flex-col gap-2 p-1">
                    <div className="p-3 bg-orange-50/45 border border-orange-100 rounded-xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 shrink-0 shadow-3xs">
                        <Clock className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] font-mono font-bold text-orange-705 uppercase tracking-widest block">NoteWave Calendar Milestone</span>
                        <h4 className="text-[11px] font-bold text-orange-950 leading-tight mt-0.5 truncate">
                          ⏰ Target: {customDemoNote ? (customDemoNote.scheduledDate || customDemoNote.projectStartDate || "No explicit schedule specify alert.") : "Kickoff next Monday at 9:00 AM"}
                        </h4>
                      </div>
                    </div>
                    <div className="p-3 bg-indigo-50/30 border border-indigo-100 rounded-xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-3xs">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] font-mono font-bold text-indigo-700 uppercase tracking-widest block">Conceptual Summary Insight</span>
                        <p className="text-[11px] text-gray-650 leading-normal font-semibold mt-0.5">
                          {customDemoNote ? customDemoNote.summaryText : "Target Product Hunt maker story discounts to boost early engagement benchmarks."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {demoActiveTab === "transcript" && (
                  <div className="p-2 text-[11px] leading-relaxed text-gray-550 font-sans italic p-1 border border-[#F2F2F7] rounded-xl bg-gray-50/50 font-semibold select-none">
                    "{customDemoNote ? customDemoNote.transcript : "Alright, let's schedule our Product Hunt teaser kickoff for Monday at 9:00 AM, draft a clean visual banner, and enable early subscriber email notifications."}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Download mobile app companion block, as explicitly requested by user */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E5EA] flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center shrink-0 border border-indigo-100 shadow-3xs">
                <Smartphone className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h4 className="text-xs font-black text-[#1C1C1E]">
                  NoteWave in your pocket
                </h4>
                <p className="text-[10px] text-gray-500 mt-0.5 font-semibold">
                  iOS &amp; Android coming soon — capture ideas the second they strike, even offline.
                </p>
              </div>
            </div>

            {/* Simulated App Store/Google Play Badges */}
            <div className="flex items-center gap-2 self-stretch md:self-auto justify-center md:justify-end">
              <div className="cursor-not-allowed flex-1 md:flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C1C1E] text-white border border-gray-750 font-sans shadow-xs transition-opacity hover:opacity-90">
                <div className="text-[8px] leading-none font-sans font-bold text-gray-400">
                  Coming on <span className="text-white text-[10px] block font-extrabold mt-0.5">App Store</span>
                </div>
              </div>
              <div className="cursor-not-allowed flex-1 md:flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111111] text-white border border-gray-750 font-sans shadow-xs transition-opacity hover:opacity-90">
                <div className="text-[8px] leading-none font-sans font-bold text-gray-400">
                  Soon for <span className="text-white text-[10px] block font-extrabold mt-0.5">Google Play</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Auth card (Auth0 Universal Login) */}
        <div className="lg:col-span-5 w-full flex flex-col gap-4 lg:max-w-md lg:ml-auto lg:sticky lg:top-8">
          
          <div className="bg-white rounded-2xl border border-[#E5E5EA] shadow-lg p-6 flex flex-col gap-5 relative z-2">
            
            {/* Logo placeholder */}
            <div className="flex flex-col gap-1 items-center justify-center text-center">
              <div className="w-10 h-10 rounded-xl bg-[#4F46E5] flex items-center justify-center font-bold text-white shadow-md shadow-indigo-100 mb-1">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black text-[#1C1C1E] leading-snug">
                {authTab === "signin" ? "Welcome back" : "Start for free"}
              </h3>
              <p className="text-[11px] text-gray-500 font-semibold">
                {authTab === "signin" ? "Pick up right where you left off." : "Join in seconds — no credit card."}
              </p>
              <span className="text-[9px] text-[#4F46E5] bg-indigo-50/70 border border-indigo-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1">
                🔒 Secured by Auth0
              </span>
            </div>

            {/* Action Segmented tab picker */}
            <div className="grid grid-cols-2 p-1 bg-[#F2F2F7] rounded-xl border border-[#D1D1D6] text-xs font-bold leading-none font-sans">
              <button
                onClick={() => { setAuthTab("signin"); setErrorMsg(null); }}
                className={`py-2 rounded-lg text-[11px] font-sans font-extrabold tracking-tight transition-all cursor-pointer ${
                  authTab === "signin"
                    ? "bg-white text-indigo-600 border border-[#D1D1D6]/85 shadow-3xs"
                    : "text-gray-500 hover:text-[#1C1C1E]"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setAuthTab("register"); setErrorMsg(null); }}
                className={`py-2 rounded-lg text-[11px] font-sans font-extrabold tracking-tight transition-all cursor-pointer ${
                  authTab === "register"
                    ? "bg-white text-indigo-600 border border-[#D1D1D6]/85 shadow-3xs"
                    : "text-gray-500 hover:text-[#1C1C1E]"
                }`}
              >
                Register
              </button>
            </div>

            {/* Social Authentication via Auth0 (Google / multi-provider) */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleAuth0SocialSignIn("google-oauth2")}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-gray-300 bg-[#F9F9F9] hover:bg-gray-50 text-xs font-bold text-gray-700 transition-all shadow-3xs active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {/* Standard Google Icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleAuth0SocialSignIn()}
                className="w-full text-center text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 transition-all cursor-pointer hover:underline"
              >
                Or use other social options (GitHub, Apple, etc.)
              </button>
            </div>

            {/* Separator line */}
            <div className="flex items-center gap-2.5 my-0.5">
              <div className="h-px bg-[#E5E5EA] flex-1" />
              <span className="text-[9px] font-mono text-gray-400 font-bold uppercase">Or continue with email</span>
              <div className="h-px bg-[#E5E5EA] flex-1" />
            </div>

            {/* Message Alert Boxes */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-[11px] leading-relaxed flex items-start gap-2 animate-fade-in font-semibold">
                <AlertCircle className="w-4 h-4 text-red-650 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-[11px] leading-relaxed flex items-start gap-2 animate-fade-in font-semibold">
                <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Primary Auth0 Universal Login action (hosted, secure, PKCE) */}
            <button
              type="button"
              onClick={() => onLogin?.({ signup: authTab === "register" })}
              className="w-full mt-1 text-xs font-bold py-3 px-4 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>{authTab === "signin" ? "Sign In securely" : "Create my free account"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <p className="text-[10px] text-gray-400 text-center font-semibold leading-normal">
              You'll be redirected to Auth0's secure hosted login. Email, password,
              and social sign-in are handled there — no credentials touch this page.
            </p>
          </div>

        </div>

      </main>

      {/* Footer copyright */}
      <footer className="w-full text-center py-5 border-t border-[#D1D1D6] text-[10px] text-gray-400 font-semibold z-10 relative">
        <p>© 2026 NoteWave Vocal Inc. All platform structures and voice nodes active.</p>
      </footer>
    </div>
  );
}
