import { Sparkles, HelpCircle, Lightbulb, RefreshCw, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface IdeaGeneratorProps {
  isTriggeredByActionBtn: boolean;
  onClearTrigger: () => void;
  language?: string;
}

interface BrainstormSeed {
  category: string;
  prompt: string;
}

const BRAINSTORM_PROMPTS_LOCALES: Record<string, BrainstormSeed[]> = {
  en: [
    { category: "Product Launch Strategy", prompt: "Explain the features of your new physical product launch and define who the initial target demographic is." },
    { category: "Weekly Retrospective Plan", prompt: "Perform a retrospective on this week's highlights. What are the key lessons learned? Map out three actionable items." },
    { category: "Content Planning Schedule", prompt: "What is your next major written post or content launch outline? Note down hook phrases, main body points, and resources." },
    { category: "Tech Stack Blueprinting", prompt: "Design the absolute ideal software stack for an instant-search offline-first voice platform. List core protocols." },
    { category: "Marketing Campaign Sprint", prompt: "Brainstorm 3 viral micro-campaign directions which cost $0 to run and can be executed under 48 hours." },
  ],
  es: [
    { category: "Estrategia de Lanzamiento", prompt: "Explica las características del lanzamiento de tu nuevo producto físico y define cuál es el público objetivo inicial." },
    { category: "Plan de Retrospectiva Semanal", prompt: "Realiza una retrospectiva sobre lo más destacado de esta semana. ¿Cuáles son las lecciones clave aprendidas? Traza tres elementos de acción." },
    { category: "Cronograma de Contenidos", prompt: "¿Cuál es el esquema de tu próximo artículo importante o lanzamiento de contenido? Anota frases de enganche, puntos clave y recursos." },
    { category: "Diseño de Arquitectura TI", prompt: "Diseña la pila de software ideal para una plataforma de voz de búsqueda instantánea y sin conexión. Lista los protocolos principales." },
    { category: "Campaña Express de Marketing", prompt: "Genera 3 ideas de microcampañas virales que cuesten $0 y puedan ejecutarse en menos de 48 horas." },
  ],
  fr: [
    { category: "Stratégie de lancement", prompt: "Expliquez les fonctionnalités du lancement de votre nouveau produit physique et définissez le public cible initial." },
    { category: "Rétrospective hebdomadaire", prompt: "Faites une rétrospective sur les points forts de cette semaine. Quelles sont les leçons apprises? Planifiez trois actions concrètes." },
    { category: "Planification de contenu", prompt: "Quel est l'aperçu de votre prochain article ou lancement de contenu? Notez des phrases d'accroche, les points principaux et ressources." },
    { category: "Architecture de pile technique", prompt: "Concevez la pile logicielle idéale pour une plateforme vocale de recherche instantanée en mode déconnecté. Énumérez les protocoles principaux." },
    { category: "Sprint de campagne marketing", prompt: "Brainstormez 3 idées de micro-campagnes virales d'un coût de 0 $ exécutables en moins de 48 heures." },
  ],
  de: [
    { category: "Produkteinführungsstrategie", prompt: "Erklären Sie die Funktionen Ihrer neuen physischen Produkteinführung und definieren Sie die Zielgruppe." },
    { category: "Wöchentliche Retrospektive", prompt: "Führen Sie eine Retrospektive der Highlights dieser Woche durch. Was sind die wichtigsten Erkenntnisse? Planen Sie drei konkrete Aufgaben." },
    { category: "Inhaltsplanung", prompt: "Was ist der Entwurf für Ihren nächsten großen Beitrag oder Ihre nächste Content-Einführung? Schreiben Sie Hook-Sätze und Hauptpunkte auf." },
    { category: "Technologie-Stack-Entwurf", prompt: "Entwerfen Sie den idealen Software-Stack für eine Offline-First-Sprachplattform mit Sofortsuche. Listen Sie die Kernprotokolle auf." },
    { category: "Marketing-Express-Kampagne", prompt: "Sammeln Sie 3 virale Mikro-Kampagnen-Ideen, die 0 $ kosten und in weniger als 48 Stunden umgesetzt werden können." },
  ],
  cs: [
    { category: "Uvedení produktu na trh", prompt: "Vysvětlete vlastnosti uvedení vašeho nového fyzického produktu na trh a definujte počáteční cílovou skupinu." },
    { category: "Týdenní retrospektivní plán", prompt: "Proveďte retrospektivu nejdůležitějších okamžiků tohoto týdne. Jaká jsou klíčová ponaučení? Naplánujte tři konkrétní úkoly." },
    { category: "Plánování obsahu", prompt: "Jaký je osnovní plán vašeho příštího velkého článku nebo obsahu? Zapište si chytlavé fráze, hlavní body a odkazy." },
    { category: "Technologická architektura", prompt: "Navrhněte ideální softwarovou strukturu pro okamžité hlasové vyhledávání bez nutnosti připojení k internetu." },
    { category: "Marketingová rychlá kampaň", prompt: "Vymyslete 3 nápady na virální mikro-kampaně, které nestojí žádné peníze a lze je realizovat do 48 hodin." },
  ],
  sk: [
    { category: "Uvedenie produktu na trh", prompt: "Vysvetlite vlastnosti uvedenia vášho nového fyzického produktu na trh a definujte počiatočnú cieľovú skupinu." },
    { category: "Týždenný retrospektívny plán", prompt: "Urobte retrospektívu najdôležitejších okamihov tohto týždňa. Aké sú kľúčové ponaučenia? Naplánujte tri konkrétne úlohy." },
    { category: "Plánovanie obsahu", prompt: "Aký je osnovný plán vášho budúceho veľkého článku alebo obsahu? Zapíšte si chytľavé frázy, hlavné body a odkazy." },
    { category: "Technologická architektúra", prompt: "Navrhnite ideálnu softvérovú štruktúru pre okamžité hlasové vyhľadávanie bez nutnosti pripojenia k internetu." },
    { category: "Marketingová rýchla kampaň", prompt: "Vymyslite 3 nápady na virálne mikro-kampane, ktoré nestoja žiadne peniaze a dajú sa realizovať do 48 hodín." },
  ],
  ja: [
    { category: "製品ローンチ戦略", prompt: "新製品ローンチの機能と初期ターゲット層を説明してください。" },
    { category: "週次振り返りプラン", prompt: "今週のハイライトについて振り返りを行いましょう。学んだ主な教訓は何ですか？3つのアクションアイテムをマッピングしてください。" },
    { category: "コンテンツ配信計画", prompt: "次のメイン記事やリリースの概要は何ですか？フックフレーズ、メイン内容、役立つリソースなどをメモしてください。" },
    { category: "技術選定設計図", prompt: "常時検索対応・オフライン優先の音声プラットフォームに最適なソフトウェア構成を設計してください。コアプロトコルを一覧化します。" },
    { category: "バイラルマーケティング", prompt: "予算0円・48時間以内に実行できるバイラルマイクロキャンペーンの方向性を3つブレインストームしてください。" },
  ],
};

const titleDict: Record<string, string> = {
  en: "Brainstorming Seeds",
  es: "Semillas Creativas",
  fr: "Idées de Brainstorming",
  de: "Brainstorming-Impulse",
  cs: "Kreativní nápady",
  sk: "Kreatívne nápady",
  ja: "ひらめき着火のヒント"
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

const icons = [
  <Lightbulb className="w-4 h-4 text-blue-600 animate-pulse" />,
  <HelpCircle className="w-4 h-4 text-green-600 animate-pulse" />,
  <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />,
  <Lightbulb className="w-4 h-4 text-sky-500 animate-pulse" />,
  <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
];

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
  const activeIcon = icons[currentIndex % icons.length];

  const titleText = titleDict[language] || titleDict.en;
  const cycleText = cycleDict[language] || cycleDict.en;

  return (
    <div id="idea-generator-widget" className="p-4 rounded-xl bg-white border border-[#E5E5EA] flex flex-col gap-3 shadow-2xs">
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
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1 rounded bg-blue-50 border border-blue-200">
              {activeIcon}
            </div>
            <span className="text-xs font-bold text-[#1C1C1E]">{activePrompt.category}</span>
          </div>
          <p className="text-xs text-gray-700 leading-relaxed italic bg-[#F9F9F9] p-3 rounded-lg border border-[#E5E5EA] font-medium">
            "{activePrompt.prompt}"
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
