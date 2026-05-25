import { initializeApp, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

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

