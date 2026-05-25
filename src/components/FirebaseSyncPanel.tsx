import { auth, googleProvider, isFirebaseEnabled, signInWithPopup, signOut } from "../firebase";
import { useEffect, useState } from "react";
import { Cloud, Database, LogOut, Check, ShieldAlert, Cpu } from "lucide-react";

interface FirebaseSyncPanelProps {
  onUserChange: (user: any) => void;
  syncRecordingsToFirestore: (user: any) => Promise<void>;
  localCount: number;
}

export default function FirebaseSyncPanel({ onUserChange, syncRecordingsToFirestore, localCount }: FirebaseSyncPanelProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [authError, setAuthError] = useState<string | null>(null);

  // Track Firebase authenticated state
  useEffect(() => {
    if (!isFirebaseEnabled || !auth) return;

    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      setCurrentUser(user);
      onUserChange(user);
      
      // Auto-trigger backup sync when user logs in
      if (user) {
        setIsSyncing(true);
        setAuthError(null);
        syncRecordingsToFirestore(user)
          .then(() => setSyncStatus("success"))
          .catch(() => setSyncStatus("error"))
          .finally(() => setIsSyncing(false));
      }
    });

    return () => unsubscribe();
  }, [onUserChange, syncRecordingsToFirestore]);

  const handleSignIn = async () => {
    setAuthError(null);
    if (!isFirebaseEnabled || !googleProvider) {
      setAuthError("Firebase Cloud Services are offline. Enjoy NoteWave in Offline Guest Mode, or configure production keys!");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error("Sign-in failed:", e);
      if (e?.code === "auth/popup-closed-by-user") {
        setAuthError(
          "The login popup was closed before completion. If you are previewing inside the sandbox, browser popups are restricted; click the 'Open in new tab' button at the top header of the screen or check your browser's popup blocker to login successfully."
        );
      } else if (e?.code === "auth/popup-blocked") {
        setAuthError(
          "The login popup was blocked by your browser settings. Please allow popups for this site or open NoteWave in a dedicated tab."
        );
      } else {
        setAuthError(e?.message || "Google login failed. Please check your internet connection.");
      }
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setCurrentUser(null);
      onUserChange(null);
      setSyncStatus("idle");
    } catch (e) {
      console.error("Sign-out failed:", e);
    }
  };

  const handleManualSync = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    setSyncStatus("idle");
    try {
      await syncRecordingsToFirestore(currentUser);
      setSyncStatus("success");
    } catch (e) {
      console.error("Manual sync failed:", e);
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div id="firebase-sync-panel" className="p-4 rounded-2xl bg-white border border-[#E5E5EA] shadow-sm">
      {authError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs leading-relaxed flex flex-col gap-1.5 shadow-xs">
          <div className="flex items-center gap-1.5 font-bold text-red-900">
            <ShieldAlert className="w-4 h-4 text-red-600" /> Sign-in Unsuccessful
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
              {isFirebaseEnabled ? (
                <span className="text-[9px] font-mono font-bold uppercase bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full border border-green-200">
                  SYNC ACTIVE
                </span>
              ) : (
                <span className="text-[9px] font-mono font-bold uppercase bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                  <ShieldAlert className="w-2.5 h-2.5" /> LOCAL ONLY
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#8E8E93] mt-0.5 leading-relaxed">
              {currentUser 
                ? `Synchronized. ${localCount} recordings backup loaded.`
                : "Recordings are stored securely in local browser storage. Sign in to cloud backup."}
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
                className="flex-1 sm:flex-none text-xs font-semibold px-3.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-800 transition-all border border-[#D1D1D6] disabled:opacity-50"
              >
                {isSyncing ? "Syncing..." : syncStatus === "success" ? "Synced ✓" : "Sync Backup"}
              </button>
              <button
                id="sign-out-btn"
                onClick={handleSignOut}
                className="text-xs font-semibold p-2 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-650 text-gray-500 border border-[#D1D1D6] hover:border-red-200 transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              id="sign-in-btn"
              onClick={handleSignIn}
              className="w-full sm:w-auto text-xs font-bold px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              Sign In & Allow Cloud Sync
            </button>
          )}
        </div>
      </div>

      {/* Warning if firebase is disabled */}
      {!isFirebaseEnabled && (
        <div className="mt-3 p-3 bg-[#F9F9F9] border border-[#E5E5EA] rounded-xl flex items-center justify-between text-[11px] text-[#8E8E93] leading-normal">
          <p>
            💡 Firebase terms of service setup is pending. NoteWave is fully operational with <strong>Offline DB fallback</strong> and direct model generation!
          </p>
          <span className="text-[9px] bg-[#E9E9EB] px-2 py-1 rounded text-[#1C1C1E] font-mono font-bold">GUEST_MODE</span>
        </div>
      )}
    </div>
  );
}
