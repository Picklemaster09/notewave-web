import { initializeApp, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase is optional legacy sync. Config comes from build-time env vars
// (VITE_FIREBASE_*). When unset, the placeholder values below keep the app in
// "Secure Offline" localStorage mode — and, crucially, let the bundle build in
// CI where no secret config file exists. Primary auth is Auth0, not Firebase.
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) ?? "placeholder-api-key",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) ?? "placeholder-project",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) ?? "",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) ?? "",
  firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_DATABASE_ID as string) ?? "(default)",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) ?? "",
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) ?? "",
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string) ?? "",
};

let db: any = null;
let auth: any = null;
let googleProvider: any = null;
let isFirebaseEnabled = false;

// Check if Firebase configuration is still a placeholder
const isPlaceholder = 
  !firebaseConfig || 
  firebaseConfig.apiKey === "placeholder-api-key" || 
  firebaseConfig.projectId === "placeholder-project" ||
  firebaseConfig.projectId === "";

if (!isPlaceholder) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
    isFirebaseEnabled = true;
    console.log("Firebase Auth & Firestore initialized successfully inside NoteWave.");
  } catch (err) {
    console.warn("Firebase failed to initialize with provided config. Defaulting to local local mode:", err);
  }
} else {
  console.info("NoteWave is currently running in Secure Offline local-first Mode. Runs on browser localStorage.");
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { db, auth, googleProvider, isFirebaseEnabled, signInWithPopup, signOut };

