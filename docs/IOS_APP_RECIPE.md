# NoteWave iOS App - Build Recipe

## Overview

This document provides step-by-step instructions for building the **NoteWave iOS** native mobile application using **React Native with Expo**. The app shares the same codebase as Android, with iOS-specific configurations.

## Auth0 Configuration

You already have the **NoteWave iOS** app configured in Auth0 (Native type).

### Client Details (from your Auth0 dashboard)

| Property | Value |
|----------|-------|
| **App Name** | NoteWave iOS |
| **Type** | Native |
| **Client ID** | `<IOS_CLIENT_ID>` |
| **Domain** | `<YOUR_AUTH0_DOMAIN>` |

### Required Auth0 Dashboard Settings

1. **Allowed Callback URLs**: `com.notewave.app://com.notewave.app/callback`
2. **Allowed Logout URLs**: `com.notewave.app://com.notewave.app/callback`
3. **Allowed Web Origins**: (leave empty for native app)
4. **Token Endpoint Auth Method**: `none` (PKCE flow)

### iOS Bundle Identifier

```
Bundle Identifier: com.notewave.app
```

---

## Step-by-Step Build Guide

### Step 1: Initialize Expo Project (Shared with Android)

```bash
npx create-expo-app notewave-ios --template
cd notewave-ios
```

> **Note:** If you already created the Android app, use the same project and just add iOS configuration.

### Step 2: Install Dependencies (Same as Android)

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

# UI
npm install lucide-react-native
npx expo install expo-font

# Networking
npm install axios

# iOS Specific
npx expo install expo-secure-store expo-local-authentication

# Offline Local Database (REQUIRED)
npx expo install expo-sqlite

# Network Monitoring (REQUIRED for offline detection)
npm install @react-native-community/netinfo

# Background Sync (OPTIONAL)
npx expo install expo-task-manager expo-background-fetch

# Haptics (iOS specific)
npx expo install expo-haptics
```

### Step 2b: Initialize Local SQLite Database

Create `src/database/initialize.ts` (same as Android, shared code):

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

### Step 2c: Sync Manager Service (Shared with Android)

The sync manager is identical to Android. See [`docs/ANDROID_APP_RECIPE.md`](docs/ANDROID_APP_RECIPE.md) Step 7c for the complete `syncManager.ts` implementation. The same file works on both platforms.

### Step 3: Configure App.json for iOS

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
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.notewave.app",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "NoteWave needs access to your microphone to record voice notes.",
        "NSCameraUsageDescription": "NoteWave may use camera for document scanning.",
        "CFBundleURLTypes": [
          {
            "CFBundleURLSchemes": ["com.notewave.app"]
          }
        ],
        "UIViewControllerBasedStatusBarAppearance": false
      },
      "associatedDomains": [
        "applinks:yourdomain.com"
      ]
    },
    "android": {
      "package": "com.notewave.app"
    }
  }
}
```

### Step 4: Update Auth0 Configuration for iOS

Create `src/config.ts`:

```typescript
// API Configuration
export const API_BASE_URL = "https://api.yourdomain.com";

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// Auth0 Configuration - iOS
export const AUTH0_CONFIG = {
  domain: "<YOUR_AUTH0_DOMAIN>",
  clientId: "<IOS_CLIENT_ID>",  // iOS Client ID
  redirectUri: "com.notewave.app://com.notewave.app/callback",
  scope: "openid profile email",
  // audience: "https://notewave-api", // Optional
};
```

> **Important:** If building a cross-platform app, detect platform and use the correct Client ID:

```typescript
import { Platform } from 'react-native';

const ANDROID_CLIENT_ID = "<ANDROID_CLIENT_ID>";
const IOS_CLIENT_ID = "<IOS_CLIENT_ID>";

export const AUTH0_CONFIG = {
  domain: "<YOUR_AUTH0_DOMAIN>",
  clientId: Platform.OS === 'ios' ? IOS_CLIENT_ID : ANDROID_CLIENT_ID,
  redirectUri: "com.notewave.app://com.notewave.app/callback",
  scope: "openid profile email",
};
```

### Step 5: iOS-Specific Audio Configuration

iOS requires specific audio session configuration. Update `src/services/audioRecorder.ts`:

```typescript
import { Audio, Recording } from 'expo-av';
import FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

class AudioRecorder {
  private recording: Recording | null = null;
  private onProgress: ((duration: number) => void) | null = null;
  private interval: any = null;
  private startTime: number = 0;

  async start(onProgress?: (duration: number) => void) {
    this.onProgress = onProgress;
    
    // Request permissions
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      throw new Error('Microphone permission denied');
    }

    // Configure audio mode for iOS
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      recordingOptions: {
        // iOS will use these settings for AVAudioRecorder
        sampleRate: 44100,
        channels: 1,
        bitsPerSecond: 32000,
        // iOS-specific: use AAC format
        format: Audio.RecordingOptionsFormat.AAC,
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

    // Determine MIME type based on file extension
    const mimeType = uri.endsWith('.m4a') ? 'audio/mp4' : 
                     uri.endsWith('.wav') ? 'audio/wav' : 'audio/aac';

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

### Step 6: Add Biometric Authentication (iOS Face ID / Touch ID)

Create `src/services/biometrics.ts`:

```typescript
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    // Check if device supports biometrics
    const { compatible, enrolled } = await LocalAuthentication.hasHardwareAsync();
    if (!compatible || !enrolled) {
      return false;
    }

    // Check available biometric types
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to open NoteWave',
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
      deviceCredential: {
        fallbackLabel: 'Use device passcode',
      },
    });

    return result.success;
  } catch (error) {
    console.error('Biometric authentication failed:', error);
    return false;
  }
}

// Secure storage for sensitive data on iOS (Keychain)
export async function storeSecurely(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function retrieveSecurely(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function deleteSecurely(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
```

### Step 7: iOS-Specific UI Adjustments

iOS has different design patterns. Create `src/components/IOSHeader.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface IOSHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: { label: string; onPress: () => void };
}

export default function IOSHeader({ title, onBack, rightAction }: IOSHeaderProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.leftButton} onPress={onBack}>
        <Text style={styles.buttonText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      {rightAction ? (
        <TouchableOpacity style={styles.rightButton} onPress={rightAction.onPress}>
          <Text style={[styles.buttonText, styles.rightText]}>{rightAction.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  leftButton: {
    padding: 8,
  },
  rightButton: {
    padding: 8,
  },
  buttonText: {
    fontSize: 17,
    color: '#3b82f6',
  },
  rightText: {
    fontWeight: '600',
  },
});
```

### Step 8: Build iOS App

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS (IPA for TestFlight)
eas build --platform ios --profile production

# Or build for development
eas build --platform ios --profile preview
```

Update `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m1"
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m1"
       },
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### Step 9: Apple Developer Account Setup

1. **Enroll in Apple Developer Program** ($99/year)
2. **Create App ID** with identifier `com.notewave.app`
3. **Configure Capabilities**:
   - Microphone access (required for recording)
   - Associated Domains (optional, for Universal Links)
4. **Create Signing Certificate** (Distribution for App Store)
5. **Create Provisioning Profile**

```bash
# Login to Apple account
eas credentials

# Follow prompts to configure iOS distribution certificate
```

---

## Project Structure (iOS)

```
notewave-ios/ (or shared notewave/)
├── app.json
├── eas.json
├── App.tsx
├── assets/
│   ├── icon.png              # 1024x1024 app icon
│   ├── splash.png            # 1242x2208 splash screen
│   └── adaptive-icon.png     # Android adaptive icon
├── src/
│   ├── config.ts                    # API + Auth0 config (iOS Client ID)
│   ├── theme/
│   │   └── colors.ts               # iOS design tokens
│   ├── auth/
│   │   ├── AuthProvider.tsx        # Auth0 wrapper
│   │   └── authToken.ts            # Token bridge for API calls
│   ├── database/
│   │   └── initialize.ts           # SQLite schema + initialization
│   ├── services/
│   │   ├── api.ts                  # API client layer
│   │   ├── audioRecorder.ts        # iOS audio recording
│   │   ├── biometrics.ts           # Face ID / Touch ID
│   │   ├── syncManager.ts          # Offline sync orchestration (shared)
│   │   └── networkAwareApi.ts      # Network-aware API wrapper (shared)
│   ├── navigation/
│   │   └── AppNavigator.tsx        # Tab + Stack navigation
│   ├── screens/
│   │   ├── RecordingScreen.tsx     # Voice recording UI
│   │   ├── NotesHistoryScreen.tsx  # Notes list
│   │   ├── TasksScreen.tsx         # Tasks & todos
│   │   ├── AIAgentScreen.tsx       # AI chat
│   │   ├── NoteDetailScreen.tsx    # Note detail
│   │   ├── SettingsScreen.tsx      # Settings
│   │   └── ConflictsScreen.tsx     # Sync conflict resolution
│   ├── components/
│   │   ├── IOSHeader.tsx           # iOS-style header
│   │   ├── WaveformVisualizer.tsx  # Audio waveform
│   │   ├── NoteCard.tsx            # Note card component
│   │   ├── MarkdownViewer.tsx      # Markdown renderer
│   │   ├── SyncStatusBadge.tsx     # Sync status indicator
│   │   └── OfflineBanner.tsx       # Offline mode banner
│   └── types.ts                    # TypeScript types
└── package.json
```

---

## Key iOS Implementation Details

### Audio Recording on iOS (Offline-First)

| Setting | Value | Reason |
|---------|-------|--------|
| Format | AAC (`.m4a`) | Native iOS format, good quality |
| Sample Rate | 44100 Hz | Standard audio quality |
| Channels | 1 (mono) | Voice notes don't need stereo |
| Bit Rate | 32 kbps | Optimal for speech |
| Max Duration | 300 seconds | 5-minute limit per recording |
| Local Storage | DocumentDirectory via `expo-file-system` | App-sandboxed storage |

**Offline Audio Flow:**
1. Recording saved to `DocumentDirectory` as `.m4a`
2. Note created in local SQLite with `audioLocalPath` and `syncStatus: 'pending'`
3. If online → uploaded to R2 via `/api/transcribe`
4. If offline → saved as "Voice Memo (offline)"
5. On sync → `audioKey` populated, local file optionally cleaned up

### iOS Permissions Required

Add to `Info.plist` via `app.json`:

```json
{
  "infoPlist": {
    "NSMicrophoneUsageDescription": "NoteWave needs access to your microphone to record voice notes for AI transcription.",
    "NSFaceIDUsageDescription": "NoteWave uses Face ID to secure your personal notes and settings.",
    "UIBackgroundModes": ["audio"]
  }
}
```

### Authentication Flow (iOS)

1. App launches → Check SecureStore (Keychain) for existing tokens
2. If no session → Present Auth0 Universal Login web view
3. PKCE flow handles OAuth2 exchange
4. Store tokens in iOS Keychain via `expo-secure-store`
5. Optional: Require Face ID on app launch
6. Auto-refresh tokens before expiry
7. **Offline**: If tokens cached in Keychain, allow access to local SQLite data

### Offline-First Architecture on iOS

Same as Android - see [`docs/OFFLINE_MODE_GUIDE.md`](docs/OFFLINE_MODE_GUIDE.md) for complete architecture.

#### iOS-Specific Storage Locations

| Data Type | Storage Location | Access |
|-----------|-----------------|--------|
| SQLite Database | `Library/Databases/notewave.db` | App-only |
| Audio Files | `Documents/` directory | App-only, iCloud backup eligible |
| Auth Tokens | iOS Keychain via `expo-secure-store` | App-only, survives app deletion |
| Cache | `Caches/` directory | App-only, no iCloud backup |

#### iOS-Specific Considerations

| Feature | iOS Implementation |
|---------|-------------------|
| Secure Storage | Keychain via `expo-secure-store` |
| Biometrics | Face ID / Touch ID via `expo-local-authentication` |
| Background Audio | `UIBackgroundModes: ["audio"]` in Info.plist |
| Push Notifications | APNs via `expo-notifications` |
| Home Screen Widget | Swift WidgetKit extension (native module) |
| On-Device AI | Swift Core ML / MLX (native module) |
| Haptic Feedback | `expo-haptics` for tactile responses |
| Safe Areas | `react-native-safe-area-context` for notch handling |
| Local Database | `expo-sqlite` in `Library/Databases/` |
| Background Sync | `expo-task-manager` + `expo-background-fetch` |
| iCloud Sync | Optional: enable iCloud Documents for cross-device local sync |

### Native Swift Modules

Some features require native Swift code that cannot be implemented in React Native:

#### iOS Home Screen Widget (WidgetKit)

```swift
// NoteWidget/NoteWidget.swift
import WidgetKit
import SwiftUI

struct NoteWidgetEntryView: View {
    var entry: NoteWidgetProvider.Entry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("NoteWave")
                .font(.headline)
                .foregroundColor(.blue)
            
            ForEach(entry.notes) { note in
                VStack(alignment: .leading, spacing: 2) {
                    Text(note.title)
                        .font(.subheadline)
                        .lineLimit(1)
                    Text(note.summary)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            }
            Spacer()
        }
        .padding()
    }
}

struct NoteWidget: Widget {
    let family: WidgetFamily = .systemSmall
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NoteWidget", provider: NoteWidgetProvider()) { entry in
            NoteWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("NoteWave")
        .description("Show your recent notes.")
    }
}
```

See [`docs/CROSS_PLATFORM_MOBILE_RECIPE.md`](docs/CROSS_PLATFORM_MOBILE_RECIPE.md) "Native Modules Architecture" for complete Swift/Kotlin implementations.

#### On-Device AI (iOS)

- **Framework**: Core ML (SFSpeechRecognizer) or MLX for local LLMs
- **Model Format**: `.mlmodelc` (Core ML) or `.safetensors` (MLX)
- **Minimum Device**: iPhone XS (A12 Bionic), 4 GB RAM
- **Recommended**: iPhone 15 (A17 Pro) for fast local inference
- **Use Case**: Offline transcription and text analysis when cloud is unavailable

---

## Testing on iOS

```bash
# Run on iOS simulator
npx expo start --ios

# Run on physical device (connect via USB, enable Developer Mode)
npx expo run:ios

# Build for TestFlight
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios

# Test offline mode
# 1. Enable Airplane mode on iPhone
# 2. Record voice note → verify saved to local SQLite
# 3. Create text note → verify saved locally
# 4. Check sync status shows "Offline"
# 5. Disable Airplane mode
# 6. Verify auto-sync triggers
# 7. Check notes appear on web dashboard
# 8. Make change on web → verify syncs to iOS app
```

### Physical Device Testing

1. Connect iPhone via USB
2. Enable "Developer Mode" in Settings → Privacy & Security
3. Trust the computer in Xcode
4. Run `npx expo run:ios` and select your device

---

## Deployment Checklist

- [ ] Configure Auth0 iOS app with correct bundle identifier
- [ ] Set up Apple Developer account and certificates
- [ ] Configure EAS for iOS builds
- [ ] Generate iOS app icons (various sizes) and splash screens
- [ ] Configure URL schemes for Auth0 callback in `app.json`
- [ ] Add required privacy descriptions to Info.plist
- [ ] Initialize SQLite database schema on app launch
- [ ] Test audio recording on physical iPhone
- [ ] Test Auth0 login flow with Universal Login
- [ ] Test Face ID integration
- [ ] Test offline mode (Airplane mode recording + sync)
- [ ] Test conflict resolution scenarios
- [ ] Verify API calls with real Auth0 tokens
- [ ] Build production IPA (`eas build --platform ios --profile production`)
- [ ] Submit to TestFlight for beta testing
- [ ] Submit to App Store Review

---

## App Store Submission

### Required Metadata

| Field | Value |
|-------|-------|
| **Name** | NoteWave |
| **Subtitle** | AI Voice Notes & Tasks |
| **Description** | Record voice notes, get AI-powered transcriptions, action items, and task management. Powered by Gemini AI. |
| **Keywords** | voice notes, AI, transcription, tasks, productivity, reminders |
| **Support URL** | https://app.yourdomain.com/support |
| **Privacy URL** | https://app.yourdomain.com/privacy |

### Privacy Nutrition Labels

- **Data Collected**: User content (voice recordings, notes)
- **Data Used to Track**: None
- **Audio & Visual**: Audio data (voice recordings stored securely)

### Age Rating

- **Suggested**: 4+ (no objectionable content)

---

## Cross-Platform Notes

If building a **single cross-platform project** (recommended):

1. Use `Platform.OS` to conditionally apply iOS/Android specific code
2. Share 90%+ of components and business logic
3. Only platform-specific code: Auth0 Client ID, audio format, biometrics
4. Single `eas build` command builds both platforms

```typescript
import { Platform } from 'react-native';

// Example: Platform-specific audio format
const audioFormat = Platform.OS === 'ios' 
  ? Audio.RecordingOptionsFormat.AAC 
  : Audio.RecordingOptionsFormat.DEFAULT;
```


