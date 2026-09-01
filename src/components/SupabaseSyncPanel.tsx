import { useEffect, useState } from "react";
import { Cloud, Database, LogOut, ShieldAlert } from "lucide-react";
import { isSupabaseEnabled } from "../supabase";

interface SupabaseSyncPanelProps {
  currentUser: any;
  onUserChange: (user: any) => void;
  syncRecordingsToSupabase: (user: any) => Promise<void>;
  localCount: number;
  isCloudOnline: boolean;
}

export default function SupabaseSyncPanel({ currentUser, onUserChange, syncRecordingsToSupabase, localCount, isCloudOnline }: SupabaseSyncPanelProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [authError, setAuthError] = useState<string | null>(null);

  // Auto-trigger backup sync when user logs in or localCount increases
  useEffect(() => {
    if (currentUser) {
      setIsSyncing(true);
      setAuthError(null);
      syncRecordingsToSupabase(currentUser)
        .then(() => setSyncStatus("success"))
        .catch((e) => {
          console.error("Auto cloud sync failed:", e);
          setSyncStatus("error");
        })
        .finally(() => setIsSyncing(false));
    }
  }, [currentUser]);

  const handleSignOut = () => {
    onUserChange(null);
    setSyncStatus("idle");
  };

  const handleManualSync = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    setSyncStatus("idle");
    try {
      await syncRecordingsToSupabase(currentUser);
      setSyncStatus("success");
    } catch (e) {
      console.error("Manual sync failed:", e);
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div id="supabase-sync-panel" className="p-4 rounded-2xl bg-white card-theme border border-[#E5E5EA] shadow-sm">
      {authError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs leading-relaxed flex flex-col gap-1.5 shadow-xs">
          <div className="flex items-center gap-1.5 font-bold text-red-900">
            <ShieldAlert className="w-4 h-4 text-red-600" /> Synchronization Warning
          </div>
          <p className="font-semibold text-gray-700 text-[11px] leading-normal">{authError}</p>
          <button 
            onClick={() => setAuthError(null)}
            className="text-[10px] text-red-700 hover:text-red-900 font-bold w-fit mt-1 underline cursor-pointer"
          >
            Dismiss Notice
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Connection status section */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${currentUser ? "bg-green-50 text-green-700 border border-green-200" : "bg-[#F2F2F7] text-gray-500 border border-gray-200"}`}>
            {currentUser ? <Cloud className="w-5 h-5" /> : <Database className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-[#1C1C1E]">
                {currentUser ? currentUser.displayName || "Cloud User" : "Offline Guest Session"}
              </span>
              {isCloudOnline ? (
                <span className="text-[9px] font-mono font-bold uppercase bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full border border-green-200">
                  SUPABASE CLOUD ACTIVE
                </span>
              ) : (
                <span className="text-[9px] font-mono font-bold uppercase bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                  <ShieldAlert className="w-2.5 h-2.5" /> STANDALONE LOCAL
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#8E8E93] mt-0.5 leading-relaxed">
              {currentUser 
                ? `Secured with end-to-end database replication.`
                : "NoteWave uses local browser database storage by default. Log in to sync to secure Supabase."}
            </p>
          </div>
        </div>

        {/* Buttons / Operations */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          {currentUser ? (
            <>
              <button
                id="manual-sync-btn"
                disabled={isSyncing}
                onClick={handleManualSync}
                className="flex-1 sm:flex-none text-xs font-semibold px-3.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-800 transition-all border border-[#D1D1D6] disabled:opacity-50 cursor-pointer"
              >
                {isSyncing ? "Syncing..." : syncStatus === "success" ? "Synced ✓" : "Sync Backup"}
              </button>
              <button
                id="sign-out-btn"
                onClick={handleSignOut}
                className="text-xs font-semibold p-2 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-650 text-gray-500 border border-[#D1D1D6] hover:border-red-200 transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="text-[11px] text-[#8E8E93] italic">
              Go to Landing Page to authenticate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
