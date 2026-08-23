# NoteWave Android App - Build Recipe

## Overview

This document provides step-by-step instructions for building the **NoteWave Android** native mobile application using **React Native with Expo**. The app mirrors the web dashboard functionality with a clean, light mobile-first design.

## Why React Native + Expo?

| Factor | Reason |
|--------|--------|
| **Code Sharing** | Same React component logic as web ([`src/components/`](src/components/)) |
| **Native Audio** | `expo-av` provides microphone access and audio recording |
| **Auth0 SDK** | First-class `auth0-react-native` support with PKCE |
| **Fast Iteration** | Hot reloading, over-the-air updates via EAS |
| **Single Codebase** | Same code compiles to both Android and iOS |

## Auth0 Configuration

You already have the **NoteWave Android** app configured in Auth0 (Native type).

### Client Details (from your Auth0 dashboard)

| Property | Value |
|----------|-------|
| **App Name** | NoteWave Android |
| **Type** | Native |
| **Client ID** | `<ANDROID_CLIENT_ID>` |
| **Domain** | `<YOUR_AUTH0_DOMAIN>` |

### Required Auth0 Dashboard Settings

1. **Allowed Callback URLs**: `com.notewave.app://com.notewave.app/callback`
2. **Allowed Logout URLs**: `com.notewave.app://com.notewave.app/callback`
3. **Allowed Web Origins**: (leave empty for native app)
4. **Token Endpoint Auth Method**: `none` (PKCE flow, no client secret)

### Android Package Name and Scheme

```
Package Name: com.notewave.app
Application ID Scheme: com.notewave.app
```

---

## Step-by-Step Build Guide

### Step 1: Initialize Expo Project

```bash
npx create-expo-app notewave-android --template
cd notewave-android
```

### Step 2: Install Dependencies

```bash
# Core
npx expo install react-native-screens react-native-safe-area-context

# Navigation
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
npx expo install react-native-gesture-handler react-native-reanimated

# Auth0
npm install auth0-react-native-context

# Audio Recording
npx expo install expo-av expo-file-system expo-media-library

# Storage
npm install @react-native-async-storage/async-storage

# Offline Local Database (REQUIRED)
npx expo install expo-sqlite

# Network Monitoring (REQUIRED for offline detection)
npm install @react-native-community/netinfo

# Background Sync (OPTIONAL)
npx expo install expo-task-manager expo-background-fetch

# UI
npm install lucide-react-native react-native-reanimated
npx expo install expo-font

# Networking
npm install axios

# Icons + Splash
npx expo install expo-font expo-splash-screen expo-status-bar
```

### Step 3: Configure App.json

```json
{
  "expo": {
    "name": "NoteWave",
    "slug": "notewave",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#F2F2F7"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#F2F2F7"
      },
      "package": "com.notewave.app",
      "intentFilters": [
        {
          "host": "com.notewave.app.callback",
          "scheme": "com.notewave.app"
        }
      ]
    },
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      }
    }
  }
}
```

### Step 4: Create Configuration File

Create `src/config.ts`:

```typescript
// API Configuration
export const API_BASE_URL = "https://api.yourdomain.com";

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// Auth0 Configuration
export const AUTH0_CONFIG = {
  domain: "<YOUR_AUTH0_DOMAIN>",
  clientId: "<ANDROID_CLIENT_ID>",
  redirectUri: "com.notewave.app://com.notewave.app/callback",
  // Optional: set if you have an Auth0 API resource
  // audience: "https://notewave-api",
  scope: "openid profile email",
};
```

### Step 5: Set Up Auth0 Authentication

Create `src/auth/AuthProvider.tsx`:

```typescript
import React from 'react';
import { Auth0Provider } from 'auth0-react-native-context';
import { AUTH0_CONFIG } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomAsyncStorage } from './CustomAsyncStorage';

// Custom storage wrapper for Auth0
class CustomStorage implements Storage {
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  }
  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
}

export function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider
      domain={AUTH0_CONFIG.domain}
      clientId={AUTH0_CONFIG.clientId}
      redirectUri={AUTH0_CONFIG.redirectUri}
      scope={AUTH0_CONFIG.scope}
      authorizationParams={{
        audience: AUTH0_CONFIG.audience,
      }}
      cacheStorage={new CustomStorage()}
    >
      {children}
    </Auth0Provider>
  );
}
```

### Step 6: Create API Service Layer

Create `src/services/api.ts`:

```typescript
import axios from 'axios';
import { apiUrl } from '../config';
import { useAuth0 } from 'auth0-react-native-context';

const api = axios.create({
  baseURL: apiUrl(''),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach Auth0 token
export const apiService = {
  async getAccessToken() {
    const { getAccessTokenSilently } = useAuth0();
    // Note: In non-React context, use the Auth0 client directly
    return null; // Will be handled per-request
  },

  async transcribe(audioBase64: string, tier: string, language: string) {
    const token = await getAccessToken(); // Your token getter
    return axios.post(apiUrl('/api/transcribe'), {
      audio: audioBase64,
      tier,
      language,
      generateTodos: true,
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async getNotes() {
    const token = await getAccessToken();
    return axios.get(apiUrl('/api/notes'), {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async syncNotes(notes: any[]) {
    const token = await getAccessToken();
    return axios.post(apiUrl('/api/notes/sync'), { notes }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async deleteNote(noteId: string) {
    const token = await getAccessToken();
    return axios.delete(apiUrl(`/api/notes/${noteId}`), {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async getAudio(audioKey: string) {
    const token = await getAccessToken();
    return axios.get(apiUrl(`/api/audio?key=${audioKey}`), {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
    });
  },

  async getUsage() {
    const token = await getAccessToken();
    return axios.get(apiUrl('/api/usage'), {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async analyzeText(text: string, language: string) {
    const token = await getAccessToken();
    return axios.post(apiUrl('/api/analyze-text'), {
      text,
      language,
      generateTodos: true,
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async aiAgentChat(messages: any[], notes: any[]) {
    const token = await getAccessToken();
    return axios.post(apiUrl('/api/ai-agent'), {
      messages,
      notes,
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },
};
```

### Step 7: Implement Audio Recording

Create `src/services/audioRecorder.ts`:

```typescript
import { Audio, Recording } from 'expo-av';
import FileSystem from 'expo-file-system';

class AudioRecorder {
  private recording: Recording | null = null;
  private onProgress: ((duration: number) => void) | null = null;
  private interval: any = null;
  private startTime: number = 0;

  async start(onProgress?: (duration: number) => void) {
    this.onProgress = onProgress;
    
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      recordingOptions: {
        // Android: AAC encoding
        sampleRate: 44100,
        channels: 1,
        bitsPerSecond: 32000,
      },
      recordingIOS: {
        // iOS: Opus-like quality
        sampleRate: 44100,
        bitsPerSecond: 32000,
        maxDurationSeconds: 300,
      },
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    
    this.recording = recording;
    this.startTime = Date.now();
    
    this.interval = setInterval(() => {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      this.onProgress?.(duration);
    }, 1000);
  }

  async stop(): Promise<{ uri: string; base64: string; duration: number }> {
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    
    if (this.interval) {
      clearInterval(this.interval);
    }

    await this.recording?.stopAndUnloadAsync();
    const uri = this.recording?.getURI();
    
    if (!uri) {
      throw new Error('Recording URI is null');
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const file = await FileSystem.getInfoAsync(uri);
    const mimeType = uri.endsWith('.m4a') ? 'audio/mp4' : 
                     uri.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';

    return {
      uri,
      base64: `data:${mimeType};base64,${base64}`,
      duration,
    };
  }

  async cleanup() {
    if (this.recording) {
      await this.recording.stopAndUnloadAsync();
      this.recording = null;
    }
  }
}

export const audioRecorder = new AudioRecorder();
```

### Step 7b: Initialize Local SQLite Database

Create `src/database/initialize.ts`:

```typescript
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'notewave.db';

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = SQLite.openDatabaseSync(DB_NAME);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      transcript TEXT DEFAULT '',
      ideaSummary TEXT DEFAULT '',
      actionItems TEXT DEFAULT '',
      category TEXT DEFAULT 'ideas',
      ideaName TEXT,
      scheduledDate TEXT,
      projectStartDate TEXT,
      isComplex INTEGER DEFAULT 0,
      subTodos TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      modelUsed TEXT,
      duration INTEGER DEFAULT 0,
      audioKey TEXT,
      audioBytes INTEGER DEFAULT 0,
      audioLocalPath TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      syncStatus TEXT DEFAULT 'synced',
      serverVersion INTEGER DEFAULT 0,
      localVersion INTEGER DEFAULT 1,
      cloudSyncEnabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      noteId TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      retryCount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      noteId TEXT,
      text TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      syncStatus TEXT DEFAULT 'synced',
      serverVersion INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_notes_sync_status ON notes(syncStatus);
    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(userId);
    CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status);
  `);

  // Insert default settings
  db.execSync(`INSERT OR IGNORE INTO user_settings (key, value) VALUES
    ('cloudSyncEnabled', 'true'),
    ('autoSyncEnabled', 'true'),
    ('syncWifiOnly', 'false'),
    ('deleteLocalAfterSync', 'false'),
    ('offlineMode', 'false')
  `);

  return db;
}
```

### Step 7c: Create Sync Manager Service

Create `src/services/syncManager.ts`:

```typescript
import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { apiUrl } from '../config';
import { getAccessToken } from '../auth/authToken';

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'local_only' | 'offline';

export class SyncManager {
  private db: SQLite.SQLiteDatabase | null = null;
  private netInfoSubscription: any = null;
  private isOnline = false;
  private syncInProgress = false;

  async initialize(db: SQLite.SQLiteDatabase) {
    this.db = db;
    this.startNetworkMonitor();
  }

  private startNetworkMonitor() {
    this.netInfoSubscription = NetInfo.addEventListener(async (state) => {
      const wasOnline = this.isOnline;
      this.isOnline = !!(state.isConnected && state.isInternetReachable);

      // Trigger sync when coming back online
      if (!wasOnline && this.isOnline) {
        console.log('[SyncManager] Network restored, triggering sync...');
        await this.fullSync();
      }
    });
  }

  async fullSync(): Promise<{ success: boolean; notesSynced: number; conflicts: number }> {
    if (!this.db || !this.isOnline || this.syncInProgress) return { success: false, notesSynced: 0, conflicts: 0 };

    // Check if cloud sync is enabled
    const syncEnabled = await this.getSetting('cloudSyncEnabled', 'true');
    if (syncEnabled !== 'true') {
      console.log('[SyncManager] Cloud sync disabled by user');
      return { success: true, notesSynced: 0, conflicts: 0 };
    }

    this.syncInProgress = true;
    const result = { success: true, notesSynced: 0, conflicts: 0 };

    try {
      // Push pending changes
      const pushResult = await this.pushSync();
      result.notesSynced += pushResult.synced;
      result.conflicts += pushResult.conflicts;

      // Pull remote changes
      const pullResult = await this.pullSync();
      result.notesSynced += pullResult.synced;
      result.conflicts += pullResult.conflicts;
    } catch (error) {
      console.error('[SyncManager] Sync failed:', error);
      result.success = false;
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  private async pushSync(): Promise<{ synced: number; conflicts: number }> {
    if (!this.db) return { synced: 0, conflicts: 0 };

    // Get pending notes
    const pendingNotes = this.db.getAllAsync(
      'SELECT * FROM notes WHERE syncStatus = ? AND cloudSyncEnabled = ?',
      ['pending', 1]
    );

    if (!pendingNotes || pendingNotes.length === 0) {
      return { synced: 0, conflicts: 0 };
    }

    const token = await getAccessToken();
    const synced = { synced: 0, conflicts: 0 };

    for (const note of pendingNotes) {
      try {
        const response = await fetch(apiUrl('/api/notes/sync'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notes: [note] }),
        });

        if (response.ok) {
          this.db.runAsync(
            'UPDATE notes SET syncStatus = ?, serverVersion = serverVersion + 1 WHERE id = ?',
            ['synced', note.id]
          );
          synced.synced++;
        } else {
          const data = await response.json();
          if (data.error === 'CONFLICT') {
            // Server version is newer - pull server version
            this.db.runAsync(
              'UPDATE notes SET syncStatus = ?, localVersion = ? WHERE id = ?',
              ['conflict', note.serverVersion, note.id]
            );
            synced.conflicts++;
          } else {
            this.db.runAsync(
              'UPDATE notes SET syncStatus = ? WHERE id = ?',
              ['pending', note.id]
            );
          }
        }
      } catch (error) {
        console.error(`[SyncManager] Failed to sync note ${note.id}:`, error);
      }
    }

    return synced;
  }

  private async pullSync(): Promise<{ synced: number; conflicts: number }> {
    if (!this.db) return { synced: 0, conflicts: 0 };

    const token = await getAccessToken();
    const response = await fetch(apiUrl('/api/notes'), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return { synced: 0, conflicts: 0 };

    const data = await response.json();
    const remoteNotes = data.notes || [];
    let synced = 0;

    for (const remoteNote of remoteNotes) {
      const localNote = this.db.getFirstSync(
        'SELECT * FROM notes WHERE id = ?',
        [remoteNote.id]
      );

      if (!localNote) {
        // New note from server - insert
        this.insertNote(remoteNote);
        synced++;
      } else if (remoteNote.serverVersion > localNote.localVersion) {
        // Server is newer - update local
        this.updateNoteFromServer(remoteNote);
        synced++;
      }
      // If local is newer or same, no action needed
    }

    return { synced, conflicts: 0 };
  }

  async queueNoteChange(note: any, operation: 'INSERT' | 'UPDATE' | 'DELETE') {
    if (!this.db) return;

    const queueId = crypto.randomUUID();
    this.db.runAsync(
      `INSERT INTO sync_queue (id, noteId, operation, payload, createdAt, status)
       VALUES (?, ?, ?, ?, datetime('now'), 'pending')`,
      [queueId, note.id, operation, JSON.stringify(note)]
    );

    // Update note sync status
    if (operation !== 'DELETE') {
      this.db.runAsync(
        'UPDATE notes SET syncStatus = ?, localVersion = localVersion + 1, updatedAt = datetime(\'now\') WHERE id = ?',
        ['pending', note.id]
      );
    }
  }

  private insertNote(note: any) {
    if (!this.db) return;
    this.db.runAsync(
      `INSERT OR REPLACE INTO notes (id, userId, title, transcript, ideaSummary, actionItems,
       category, ideaName, scheduledDate, projectStartDate, isComplex, subTodos, tags,
       modelUsed, duration, audioKey, audioBytes, audioLocalPath, createdAt, updatedAt,
       syncStatus, serverVersion, localVersion, cloudSyncEnabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        note.id, note.userId, note.title, note.transcript, note.ideaSummary,
        note.actionItems, note.category, note.ideaName, note.scheduledDate,
        note.projectStartDate, note.isComplex ? 1 : 0, JSON.stringify(note.subTodos || []),
        JSON.stringify(note.tags || []), note.modelUsed, note.duration || 0,
        note.audioKey, note.audioBytes || 0, null, note.createdAt, note.createdAt,
        'synced', note.serverVersion || 1, note.serverVersion || 1, 1
      ]
    );
  }

  private updateNoteFromServer(note: any) {
    if (!this.db) return;
    this.db.runAsync(
      `UPDATE notes SET transcript = ?, ideaSummary = ?, actionItems = ?, category = ?,
       ideaName = ?, scheduledDate = ?, projectStartDate = ?, isComplex = ?, subTodos = ?,
       tags = ?, modelUsed = ?, duration = ?, audioKey = ?, audioBytes = ?, updatedAt = ?,
       syncStatus = 'synced', serverVersion = ?, localVersion = ? WHERE id = ?`,
      [
        note.transcript, note.ideaSummary, note.actionItems, note.category,
        note.ideaName, note.scheduledDate, note.projectStartDate,
        note.isComplex ? 1 : 0, JSON.stringify(note.subTodos || []),
        JSON.stringify(note.tags || []), note.modelUsed, note.duration || 0,
        note.audioKey, note.audioBytes || 0, note.createdAt,
        note.serverVersion || 1, note.serverVersion || 1, note.id
      ]
    );
  }

  async getSetting(key: string, defaultValue: string): Promise<string> {
    if (!this.db) return defaultValue;
    const result = this.db.getFirstSync('SELECT value FROM user_settings WHERE key = ?', [key]);
    return result?.value || defaultValue;
  }

  async isNetworkAvailable(): Promise<boolean> {
    if (this.isOnline) return true;
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable);
  }

  async getPendingCount(): Promise<number> {
    if (!this.db) return 0;
    const result = this.db.getFirstSync('SELECT COUNT(*) as count FROM notes WHERE syncStatus = ?', ['pending']);
    return result?.count || 0;
  }

  cleanup() {
    this.netInfoSubscription?.();
  }
}

export const syncManager = new SyncManager();
```

### Step 7d: Network-Aware API Service

Create `src/services/networkAwareApi.ts`:

```typescript
import { syncManager } from './syncManager';
import * as SQLite from 'expo-sqlite';
import { apiUrl } from '../config';
import { getAccessToken } from '../auth/authToken';

/**
 * Fetches notes from local DB first, then optionally refreshes from cloud.
 * Returns immediate local data even when offline.
 */
export async function fetchNotes(db: SQLite.SQLiteDatabase, userId: string) {
  // Always return local data first (instant response)
  const localNotes = db.getAllAsync(
    'SELECT * FROM notes WHERE userId = ? ORDER BY createdAt DESC',
    [userId]
  ) || [];

  // If online, trigger background sync
  const isOnline = await syncManager.isNetworkAvailable();
  if (isOnline) {
    syncManager.fullSync();
  }

  return localNotes.map(note => ({
    ...note,
    subTodos: JSON.parse(note.subTodos || '[]'),
    tags: JSON.parse(note.tags || '[]'),
  }));
}

/**
 * Saves a note locally and queues for sync.
 */
export async function saveNoteLocally(db: SQLite.SQLiteDatabase, note: any) {
  db.runAsync(
    `INSERT OR REPLACE INTO notes (id, userId, title, transcript, ideaSummary, actionItems,
     category, ideaName, scheduledDate, projectStartDate, isComplex, subTodos, tags,
     modelUsed, duration, audioKey, audioBytes, audioLocalPath, createdAt, updatedAt,
     syncStatus, serverVersion, localVersion, cloudSyncEnabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      note.id, note.userId, note.title, note.transcript, note.ideaSummary,
      note.actionItems, note.category, note.ideaName, note.scheduledDate,
      note.projectStartDate, note.isComplex ? 1 : 0, JSON.stringify(note.subTodos || []),
      JSON.stringify(note.tags || []), note.modelUsed, note.duration || 0,
      note.audioKey, note.audioBytes || 0, note.audioLocalPath || null,
      note.createdAt, note.createdAt, 'pending', 0, 1, 1
    ]
  );

  // Queue for sync
  syncManager.queueNoteChange(note, 'INSERT');
}

/**
 * Records a voice note - works offline, syncs when online.
 */
export async function recordVoiceNote(db: SQLite.SQLiteDatabase, userId: string, audioData: any) {
  const noteId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Save locally with pending status
  const note = {
    id: noteId,
    userId,
    title: 'Processing...',
    transcript: '',
    ideaSummary: '',
    actionItems: '',
    category: 'ideas',
    subTodos: [],
    tags: ['voice'],
    duration: audioData.duration || 0,
    audioLocalPath: audioData.uri,
    audioKey: null,
    audioBytes: audioData.size || 0,
    modelUsed: '',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    status: 'processing',
  };

  saveNoteLocally(db, note);

  // If online, send to AI for transcription
  const isOnline = await syncManager.isNetworkAvailable();
  if (isOnline) {
    try {
      const token = await getAccessToken();
      const response = await fetch(apiUrl('/api/transcribe'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audio: audioData.base64,
          tier: 'free',
          language: 'en',
          generateTodos: true,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Update note with AI results
        db.runAsync(
          `UPDATE notes SET title = ?, transcript = ?, ideaSummary = ?, actionItems = ?,
           category = ?, ideaName = ?, subTodos = ?, tags = ?, modelUsed = ?, audioKey = ?,
           audioBytes = ?, status = 'ready', syncStatus = 'pending' WHERE id = ?`,
          [
            result.data.headlineTitle, result.data.transcript, result.data.summaryText,
            result.data.actionItems, result.data.category, result.data.ideaName,
            JSON.stringify(result.data.subTodos || []), JSON.stringify(result.data.tags || []),
            result.model, result.audioKey, result.audioBytes || 0, noteId
          ]
        );
        syncManager.queueNoteChange({ ...note, ...result.data }, 'UPDATE');
      }
    } catch (error) {
      console.error('[VoiceNote] AI transcription failed:', error);
      db.runAsync(
        'UPDATE notes SET status = ?, title = ? WHERE id = ?',
        ['failed', 'Voice Note (offline)', noteId]
      );
    }
  } else {
    // Offline - mark as local voice memo
    db.runAsync(
      'UPDATE notes SET title = ?, status = ? WHERE id = ?',
      ['Voice Memo (offline)', 'ready', noteId]
    );
  }

  return noteId;
}
```

### Step 8: Set Up Navigation Structure

Create `src/navigation/AppNavigator.tsx`:

```typescript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Mic, History, ListTodo, Bot, Settings } from 'lucide-react-native';

// Screen imports
import RecordingScreen from '../screens/RecordingScreen';
import NotesHistoryScreen from '../screens/NotesHistoryScreen';
import TasksScreen from '../screens/TasksScreen';
import AIAgentScreen from '../screens/AIAgentScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NoteDetailScreen from '../screens/NoteDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#F2F2F7' },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Tab.Screen
        name="Record"
        component={RecordingScreen}
        options={{
          title: 'Dictate',
          tabBarIcon: ({ size, color }) => <Mic size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={NotesHistoryScreen}
        options={{
          title: 'History',
          tabBarIcon: ({ size, color }) => <History size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          title: 'Tasks',
          tabBarIcon: ({ size, color }) => <ListTodo size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Agent"
        component={AIAgentScreen}
        options={{
          title: 'AI Agent',
          tabBarIcon: ({ size, color }) => <Bot size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => <Settings size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NoteDetail"
        component={NoteDetailScreen}
        options={{ title: 'Note Details' }}
      />
    </Stack.Navigator>
  );
}
```

### Step 9: Create Main App Entry Point

Create `App.tsx`:

```typescript
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProviderWrapper } from './src/auth/AuthProvider';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProviderWrapper>
        <NavigationContainer>
          <AppNavigator />
          <StatusBar style="dark" backgroundColor="#F2F2F7" />
        </NavigationContainer>
      </AuthProviderWrapper>
    </SafeAreaProvider>
  );
}
```

### Step 10: Apply NoteWave Design Theme

Create `src/theme/colors.ts`:

```typescript
// Match web dashboard light theme from src/index.css
export const colors = {
  // Light theme defaults
  bgApp: '#F2F2F7',
  bgCard: '#ffffff',
  textPrimary: '#1C1C1E',
  textSecondary: '#5a5a60',
  borderColor: '#E5E5EA',
  bgInput: '#F2F2F7',
  
  // Accent colors (matching web data-accent variants)
  accents: {
    blue: { primary: '#3b82f6', hover: '#2563eb', light: '#eff6ff', muted: 'rgba(59, 130, 246, 0.15)' },
    orange: { primary: '#f97316', hover: '#ea580c', light: '#fff7ed', muted: 'rgba(249, 115, 22, 0.15)' },
    purple: { primary: '#8b5cf6', hover: '#7c3aed', light: '#f5f3ff', muted: 'rgba(139, 92, 246, 0.15)' },
    green: { primary: '#10b981', hover: '#059669', light: '#ecfdf5', muted: 'rgba(16, 185, 129, 0.15)' },
    red: { primary: '#ef4444', hover: '#dc2626', light: '#fef2f2', muted: 'rgba(239, 68, 68, 0.15)' },
  },
};

export const typography = {
  fontSans: 'Inter',
  fontMono: 'JetBrains Mono',
};
```

### Step 11: Build Android APK/AAB

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for Android (AAB for Google Play)
eas build --platform android --profile production

# Or build APK for direct testing
eas build --platform android --profile preview
```

Create `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

---

## Project Structure

```
notewave-android/
├── app.json
├── eas.json
├── App.tsx
├── assets/
│   ├── icon.png
│   ├── splash.png
│   └── adaptive-icon.png
├── src/
│   ├── config.ts                    # API + Auth0 config
│   ├── theme/
│   │   └── colors.ts               # Design tokens matching web
│   ├── auth/
│   │   ├── AuthProvider.tsx        # Auth0 wrapper
│   │   └── authToken.ts            # Token bridge for API calls
│   ├── database/
│   │   └── initialize.ts           # SQLite schema + initialization
│   ├── services/
│   │   ├── api.ts                  # API client layer
│   │   ├── audioRecorder.ts        # Microphone recording
│   │   ├── syncManager.ts          # Offline sync orchestration
│   │   └── networkAwareApi.ts      # Network-aware API wrapper
│   ├── navigation/
│   │   └── AppNavigator.tsx        # Tab + Stack navigation
│   ├── screens/
│   │   ├── RecordingScreen.tsx     # Voice recording UI
│   │   ├── NotesHistoryScreen.tsx  # Notes list with search
│   │   ├── TasksScreen.tsx         # Action items & todos
│   │   ├── AIAgentScreen.tsx       # Chat with AI agent
│   │   ├── NoteDetailScreen.tsx    # Single note view
│   │   ├── SettingsScreen.tsx      # User settings
│   │   └── ConflictsScreen.tsx     # Sync conflict resolution
│   ├── components/
│   │   ├── WaveformVisualizer.tsx  # Audio waveform display
│   │   ├── NoteCard.tsx            # Note list item
│   │   ├── MarkdownViewer.tsx      # Markdown renderer
│   │   ├── SyncStatusBadge.tsx     # Sync status indicator
│   │   └── OfflineBanner.tsx       # Offline mode banner
│   └── types.ts                    # TypeScript types (shared with web)
└── package.json
```

---

## Key Implementation Details

### Audio Recording Flow (Offline-First)

1. User taps record button → Request microphone permission
2. Start recording with `expo-av` (mono, 32kbps, AAC)
3. Show live waveform visualization with timer
4. On stop → Save to local filesystem (`expo-file-system`)
5. **If online**: Send to `/api/transcribe` → Store AI response in local SQLite
6. **If offline**: Save as "Voice Memo (offline)" in local SQLite with `syncStatus: 'pending'`
7. Audio file stored locally at `audioLocalPath` until cloud sync completes

### Authentication Flow

1. App launches → Check for existing Auth0 session
2. If no session → Show login screen with Auth0 Universal Login
3. PKCE flow handles token exchange automatically
4. Store tokens in encrypted AsyncStorage
5. Attach access token to every API request via interceptor
6. Auto-refresh tokens before expiry
7. **Offline**: If tokens are cached, allow access to local data without network

### Offline-First Architecture

The app uses **SQLite via expo-sqlite** as the primary data store:

1. **All reads** come from local SQLite database (instant response)
2. **All writes** are saved to local SQLite immediately
3. **Sync is asynchronous** - changes are queued and synced when online
4. **User can disable cloud sync** - data stays 100% local

#### Sync Status Indicators

| Status | Meaning | UI Indicator |
|--------|---------|-------------|
| `synced` | In sync with cloud | Green checkmark |
| `pending` | Waiting to sync | Yellow clock icon |
| `conflict` | Needs manual resolution | Orange warning icon |
| `local_only` | Cloud sync disabled for this note | Blue lock icon |
| `offline` | App is offline | Gray wifi-off icon |

#### Conflict Resolution

- **Local modified, server unchanged** → Local wins
- **Server modified, local unchanged** → Server wins
- **Both modified** → Server wins (last-write-wins with server priority)
- **User can review conflicts** in a dedicated "Conflicts" screen

#### Storage Management

| Type | Local Storage | Cloud Storage |
|------|--------------|---------------|
| Notes (metadata) | SQLite DB (~100 MB max) | Supabase PostgreSQL |
| Audio files | App directory (~500 MB) | Cloudflare R2 |
| User settings | SQLite + AsyncStorage | Supabase user_settings |
| Auth tokens | AsyncStorage (encrypted) | N/A |

#### Offline Settings

Users can configure offline behavior in Settings:
- **Cloud Sync**: Master toggle (on/off)
- **Auto Sync**: Automatically sync when online
- **Wi-Fi Only**: Only sync on Wi-Fi connection
- **Delete Local Audio After Sync**: Save storage space
- **Offline Mode**: Force offline (no sync attempts even when online)

### Platform-Specific Notes

| Feature | Android Implementation |
|---------|----------------------|
| Audio Codec | AAC (default) or Opus via MediaCodec |
| Background Recording | Use `expo-background-task` for long recordings |
| Push Notifications | Firebase Cloud Messaging (FCM) via `expo-notifications` |
| Deep Linking | Configure intent filters in `app.json` |
| Biometric Auth | `expo-local-authentication` for app lock |
| Local Database | `expo-sqlite` with app-private directory |
| Background Sync | `expo-task-manager` + `expo-background-fetch` |
| Home Screen Widget | Kotlin `AppWidgetProvider` (native module) |
| On-Device AI | Kotlin ONNX Runtime / MediaPipe (native module) |

### Native Kotlin Modules

Some features require native Kotlin code that cannot be implemented in React Native:

#### Android Home Screen Widget

```kotlin
// android/app/src/main/java/com/notewave/app/widget/NoteWidgetProvider.kt
package com.notewave.app.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import com.notewave.app.R

class NoteWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.note_widget)
            val notes = NoteWidgetData.getRecentNotes(context)
            if (notes.isNotEmpty()) {
                views.setTextViewText(R.id.widget_title, notes[0].title)
                views.setTextViewText(R.id.widget_summary, notes[0].summary)
            }
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}
```

See [`docs/CROSS_PLATFORM_MOBILE_RECIPE.md`](docs/CROSS_PLATFORM_MOBILE_RECIPE.md) "Native Modules Architecture" for complete Kotlin/Swift implementations.

#### On-Device AI (Android)

- **Framework**: ONNX Runtime or MediaPipe
- **Model Format**: `.onnx` or `.tflite`
- **Minimum Device**: Snapdragon 845, 6 GB RAM
- **Use Case**: Offline transcription and text analysis when cloud is unavailable

---

## Testing

```bash
# Run on Android emulator
npx expo start --android

# Build and run on physical device
eas build --platform android --profile preview
eas submit --platform android

# Test offline mode
# 1. Enable Airplane mode on device
# 2. Record voice note → verify saved locally
# 3. Create text note → verify saved locally
# 4. Check sync status shows "Offline"
# 5. Disable Airplane mode
# 6. Verify auto-sync triggers
# 7. Check notes appear on web dashboard
```

---

## Deployment Checklist

- [ ] Configure Auth0 Android app with correct package name
- [ ] Set up EAS project (`eas project:init`)
- [ ] Generate app icons and splash screens
- [ ] Configure Android intent filters for Auth0 callback
- [ ] Initialize SQLite database schema on app launch
- [ ] Test audio recording on physical device
- [ ] Test Auth0 login flow end-to-end
- [ ] Test offline mode (Airplane mode recording + sync)
- [ ] Test conflict resolution scenarios
- [ ] Verify API calls with real Auth0 tokens
- [ ] Build production AAB (`eas build --platform android --profile production`)
- [ ] Submit to Google Play Store


