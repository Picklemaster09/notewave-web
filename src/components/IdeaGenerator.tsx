import { Sparkles, RefreshCw, Mic, Bot } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface IdeaGeneratorProps {
  isTriggeredByActionBtn: boolean;
  onClearTrigger: () => void;
  language?: string;
}

interface BrainstormSeed {
  // "voice" = something you dictate to create a note/reminder/idea.
  // "agent" = something you ask the AI Agent about your existing notes.
  kind: "voice" | "agent";
  category: string;
  prompt: string;
}

const BRAINSTORM_PROMPTS_LOCALES: Record<string, BrainstormSeed[]> = {
  en: [
    { kind: "voice", category: "Set a Reminder", prompt: "Remind me I have a dentist appointment tomorrow at 3 PM." },
    { kind: "voice", category: "Capture an Idea", prompt: "I've got an idea for an app that turns voice notes into to-do lists." },
    { kind: "voice", category: "Quick To-Do", prompt: "Note to self: pick up groceries and call the bank after lunch." },
    { kind: "agent", category: "Find Urgent Tasks", prompt: "What are the most urgent tasks I noted down this week?" },
    { kind: "agent", category: "Recall an Old Idea", prompt: "What was that app idea I recorded a few months ago?" },
    { kind: "agent", category: "Summarize Notes", prompt: "Summarize everything I've noted about marketing so far." },
  ],
  es: [
    { kind: "voice", category: "Crear un recordatorio", prompt: "Recuérdame que tengo cita con el dentista mañana a las 3 de la tarde." },
    { kind: "voice", category: "Capturar una idea", prompt: "Tengo una idea para una app que convierte notas de voz en listas de tareas." },
    { kind: "voice", category: "Tarea rápida", prompt: "Nota para mí: comprar víveres y llamar al banco después de comer." },
    { kind: "agent", category: "Tareas urgentes", prompt: "¿Cuáles son las tareas más urgentes que anoté esta semana?" },
    { kind: "agent", category: "Recordar una idea antigua", prompt: "¿Cuál era esa idea de app que grabé hace unos meses?" },
    { kind: "agent", category: "Resumir notas", prompt: "Resume todo lo que he anotado sobre marketing hasta ahora." },
  ],
  fr: [
    { kind: "voice", category: "Créer un rappel", prompt: "Rappelle-moi que j'ai un rendez-vous chez le dentiste demain à 15 h." },
    { kind: "voice", category: "Capturer une idée", prompt: "J'ai une idée d'application qui transforme les notes vocales en listes de tâches." },
    { kind: "voice", category: "Tâche rapide", prompt: "Note pour moi : acheter des courses et appeler la banque après le déjeuner." },
    { kind: "agent", category: "Tâches urgentes", prompt: "Quelles sont les tâches les plus urgentes que j'ai notées cette semaine ?" },
    { kind: "agent", category: "Retrouver une vieille idée", prompt: "C'était quoi cette idée d'application que j'ai enregistrée il y a quelques mois ?" },
    { kind: "agent", category: "Résumer les notes", prompt: "Résume tout ce que j'ai noté sur le marketing jusqu'à présent." },
  ],
  de: [
    { kind: "voice", category: "Erinnerung erstellen", prompt: "Erinnere mich daran, dass ich morgen um 15 Uhr einen Zahnarzttermin habe." },
    { kind: "voice", category: "Idee festhalten", prompt: "Ich habe eine Idee für eine App, die Sprachnotizen in To-do-Listen verwandelt." },
    { kind: "voice", category: "Schnelle Aufgabe", prompt: "Notiz an mich: nach dem Mittagessen einkaufen und die Bank anrufen." },
    { kind: "agent", category: "Dringende Aufgaben", prompt: "Was sind die dringendsten Aufgaben, die ich diese Woche notiert habe?" },
    { kind: "agent", category: "Alte Idee abrufen", prompt: "Was war diese App-Idee, die ich vor ein paar Monaten aufgenommen habe?" },
    { kind: "agent", category: "Notizen zusammenfassen", prompt: "Fasse alles zusammen, was ich bisher über Marketing notiert habe." },
  ],
  cs: [
    { kind: "voice", category: "Vytvořit připomínku", prompt: "Připomeň mi, že mám zítra ve tři odpoledne schůzku u zubaře." },
    { kind: "voice", category: "Zachytit nápad", prompt: "Mám nápad na appku, která mění hlasové poznámky na seznamy úkolů." },
    { kind: "voice", category: "Rychlý úkol", prompt: "Poznámka pro mě: po obědě nakoupit a zavolat do banky." },
    { kind: "agent", category: "Naléhavé úkoly", prompt: "Jaké jsou nejnaléhavější úkoly, které jsem si tento týden zapsal?" },
    { kind: "agent", category: "Vybavit si starý nápad", prompt: "Jaký byl ten nápad na aplikaci, který jsem nahrál před pár měsíci?" },
    { kind: "agent", category: "Shrnout poznámky", prompt: "Shrň všechno, co jsem si zatím poznamenal o marketingu." },
  ],
  sk: [
    { kind: "voice", category: "Vytvoriť pripomienku", prompt: "Pripomeň mi, že mám zajtra o tretej popoludní termín u zubára." },
    { kind: "voice", category: "Zachytiť nápad", prompt: "Mám nápad na appku, ktorá mení hlasové poznámky na zoznamy úloh." },
    { kind: "voice", category: "Rýchla úloha", prompt: "Poznámka pre mňa: po obede nakúpiť a zavolať do banky." },
    { kind: "agent", category: "Naliehavé úlohy", prompt: "Aké sú najnaliehavejšie úlohy, ktoré som si tento týždeň zapísal?" },
    { kind: "agent", category: "Spomenúť si na starý nápad", prompt: "Aký bol ten nápad na aplikáciu, ktorý som nahral pred pár mesiacmi?" },
    { kind: "agent", category: "Zhrnúť poznámky", prompt: "Zhrň všetko, čo som si doteraz poznačil o marketingu." },
  ],
  ja: [
    { kind: "voice", category: "リマインダーを作成", prompt: "明日の午後3時に歯医者の予約があることをリマインドして。" },
    { kind: "voice", category: "アイデアを記録", prompt: "音声メモをToDoリストに変えるアプリのアイデアがあるんだ。" },
    { kind: "voice", category: "クイックタスク", prompt: "自分用メモ：昼食後に買い物をして銀行に電話する。" },
    { kind: "agent", category: "緊急タスク", prompt: "今週メモした中で一番急ぎのタスクは何？" },
    { kind: "agent", category: "昔のアイデアを思い出す", prompt: "数か月前に録音したあのアプリのアイデアは何だっけ？" },
    { kind: "agent", category: "メモを要約", prompt: "これまでマーケティングについてメモした内容をまとめて。" },
  ],
};

const titleDict: Record<string, string> = {
  en: "Example Prompts",
  es: "Ejemplos de Uso",
  fr: "Exemples d'utilisation",
  de: "Beispiel-Prompts",
  cs: "Příklady použití",
  sk: "Príklady použitia",
  ja: "使い方の例"
};

const cycleDict: Record<string, string> = {
  en: "Cycle Prompt",
  es: "Siguiente Ocurrencia",
  fr: "Faire défiler",
  de: "Nächster Impuls",
  cs: "Další podnět",
  sk: "Ďalší podnet",
  ja: "お題切り替え"
};

// Badge text telling the user WHICH feature the example is meant for.
const kindLabelDict: Record<string, { voice: string; agent: string }> = {
  en: { voice: "Voice Note", agent: "AI Agent" },
  es: { voice: "Nota de voz", agent: "Agente IA" },
  fr: { voice: "Note vocale", agent: "Agent IA" },
  de: { voice: "Sprachnotiz", agent: "KI-Agent" },
  cs: { voice: "Hlasová poznámka", agent: "AI agent" },
  sk: { voice: "Hlasová poznámka", agent: "AI agent" },
  ja: { voice: "音声メモ", agent: "AIエージェント" },
};

export default function IdeaGenerator({ isTriggeredByActionBtn, onClearTrigger, language = "en" }: IdeaGeneratorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Monitor physical action button click mapping
  useEffect(() => {
    if (isTriggeredByActionBtn) {
      cyclePrompt();
      onClearTrigger();
    }
  }, [isTriggeredByActionBtn]);

  const cyclePrompt = () => {
    const list = BRAINSTORM_PROMPTS_LOCALES[language] || BRAINSTORM_PROMPTS_LOCALES.en;
    setCurrentIndex((prev) => (prev + 1) % list.length);
  };

  const promptsList = BRAINSTORM_PROMPTS_LOCALES[language] || BRAINSTORM_PROMPTS_LOCALES.en;
  const activePrompt = promptsList[currentIndex] || promptsList[0];
  const isVoice = activePrompt.kind === "voice";

  const titleText = titleDict[language] || titleDict.en;
  const cycleText = cycleDict[language] || cycleDict.en;
  const kindLabels = kindLabelDict[language] || kindLabelDict.en;
  const kindText = isVoice ? kindLabels.voice : kindLabels.agent;

  return (
    <div id="idea-generator-widget" className="p-4 rounded-xl bg-white card-theme border border-[#E5E5EA] flex flex-col gap-3 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F2F2F7] pb-2">
        <span className="text-[10px] font-mono tracking-wider font-bold text-gray-500 uppercase flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" /> {titleText}
        </span>
        <button
          onClick={cyclePrompt}
          className="text-[10px] font-mono text-gray-500 hover:text-[#1C1C1E] flex items-center gap-1 bg-[#F2F2F7] border border-[#D1D1D6] px-2 py-1 rounded transition-all active:scale-95 cursor-pointer font-bold"
        >
          <RefreshCw className="w-2.5 h-2.5" /> {cycleText}
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className="mt-1"
        >
          {/* Feature badge: tells the user where to use this example */}
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2 py-1 rounded-md border mb-2 ${
              isVoice
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-indigo-50 text-indigo-700 border-indigo-200"
            }`}
          >
            {isVoice ? <Mic className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
            {kindText}
          </span>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#1C1C1E] text-primary-theme">{activePrompt.category}</span>
          </div>
          <p className="text-xs text-gray-700 text-primary-theme leading-relaxed italic bg-[#F9F9F9] input-theme p-3 rounded-lg border border-[#E5E5EA] font-medium">
            "{activePrompt.prompt}"
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
