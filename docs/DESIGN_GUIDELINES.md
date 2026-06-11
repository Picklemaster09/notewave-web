# NoteWave Mobile Design Guidelines

## Design Philosophy

NoteWave mobile apps follow the **same visual language** as the web dashboard - clean, light, minimal, with a focus on content and usability. The design is inspired by native iOS/Android patterns while maintaining brand consistency.

## Color System

### Primary Palette (Light Theme)

These colors match the web dashboard from [`src/index.css`](src/index.css):

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-app` | `#F2F2F7` | Main app background (iOS system gray-100) |
| `--bg-card` | `#ffffff` | Cards, sheets, modals |
| `--text-primary` | `#1C1C1E` | Headings, body text (iOS system label) |
| `--text-secondary` | `#5a5a60` | Subtitles, captions, placeholders |
| `--border-color` | `#E5E5EA` | Dividers, card borders |
| `--bg-input` | `#F2F2F7` | Input fields, text areas |

### Accent Colors

Users can customize accent color in settings. Default is **blue**.

| Accent | Primary | Hover/Pressed | Light Background | Muted (15%) |
|--------|---------|---------------|-----------------|-------------|
| **Blue** (default) | `#3b82f6` | `#2563eb` | `#eff6ff` | `rgba(59,130,246,0.15)` |
| **Orange** | `#f97316` | `#ea580c` | `#fff7ed` | `rgba(249,115,22,0.15)` |
| **Purple** | `#8b5cf6` | `#7c3aed` | `#f5f3ff` | `rgba(139,92,246,0.15)` |
| **Green** | `#10b981` | `#059669` | `#ecfdf5` | `rgba(16,185,129,0.15)` |
| **Red** | `#ef4444` | `#dc2626` | `#fef2f2` | `rgba(239,68,68,0.15)` |

### Dark Theme Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-app` | `#0f172a` | Slate 900 background |
| `--bg-card` | `#1e293b` | Slate 800 cards |
| `--bg-input` | `#334155` | Slate 700 inputs |
| `--text-primary` | `#f8fafc` | Slate 50 text |
| `--text-secondary` | `#94a3b8` | Slate 400 secondary |
| `--border-color` | `#334155` | Slate 700 borders |

---

## Typography

### Font Families

| Font | Usage | Weights |
|------|-------|---------|
| **Inter** | Primary UI font (sans-serif) | 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold) |
| **JetBrains Mono** | Code, timestamps, technical data | 400 (Regular), 550 (Medium) |

### Type Scale (Mobile)

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| **Page Title** | 28px | 700 | 36px | -0.5px |
| **Section Header** | 20px | 600 | 28px | -0.3px |
| **Card Title** | 17px | 600 | 22px | -0.2px |
| **Body Text** | 15px | 400 | 22px | 0px |
| **Caption** | 13px | 400 | 18px | 0px |
| **Button Label** | 15px | 600 | 20px | 0.5px |
| **Tab Label** | 12px | 500 | 16px | 0px |

---

## Spacing System

Based on 4px grid:

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Icon-padding, chip margins |
| `sm` | 8px | Internal spacing, gaps |
| `md` | 16px | Section padding, card margins |
| `lg` | 24px | Screen edges, major sections |
| `xl` | 32px | Hero sections, dividers |
| `2xl` | 48px | Full-width spacing |

---

## Component Specifications

### 1. Bottom Tab Bar

```
Height: 56px (iOS) / 56px (Android)
Background: #ffffff
Border Top: 0.5px solid #E5E5EA
Active Color: Accent color (default #3b82f6)
Inactive Color: #94a3b8
Icon Size: 24x24
Label Size: 12px Medium
```

**Tabs (5 total):**
1. 🎤 **Dictate** - Voice recording
2. 📋 **History** - Notes list
3. ✅ **Tasks** - Action items
4. 🤖 **AI Agent** - Chat interface
5. ⚙️ **Settings** - User settings

### 2. Note Card

```
Background: #ffffff
Border Radius: 12px
Padding: 16px
Shadow: 0 1px 3px rgba(0,0,0,0.08)
Margin: 8px 16px
```

**Card Content:**
- Title: 17px SemiBold, `#1C1C1E`
- Summary: 15px Regular, `#5a5a60`, max 2 lines
- Category Badge: 12px Medium, accent color on light bg
- Duration: 13px Regular, `#94a3b8`
- Date: 13px Regular, `#94a3b8`

### 3. Recording Button (Primary CTA)

```
Size: 72x72 circle
Background: Accent color
Icon: White mic icon, 32x32
Shadow: 0 4px 12px rgba(accent, 0.3)
Recording State: Red pulse animation
```

### 4. Waveform Visualizer

```
Height: 60px
Bar Count: 40-60 bars
Bar Width: 3px
Bar Gap: 2px
Color: Accent color
Animation: Real-time amplitude mapping
```

### 5. Input Fields

```
Background: #F2F2F7
Border: 1px solid #E5E5EA
Border Radius: 10px
Padding: 12px 16px
Font: 15px Regular
Focus Border: Accent color
Placeholder: #94a3b8
```

### 6. Buttons

| Type | Background | Text | Border Radius | Height |
|------|-----------|------|--------------|--------|
| **Primary** | Accent color | White | 10px | 48px |
| **Secondary** | Transparent | Accent color | 10px | 48px |
| **Destructive** | `#fef2f2` | `#ef4444` | 10px | 48px |
| **Ghost** | Transparent | `#5a5a60` | 8px | 36px |

### 7. Chips / Tags

```
Background: Accent muted (15% opacity)
Text: Accent primary
Border Radius: 20px (pill)
Padding: 6px 12px
Font: 12px Medium
```

### 8. Modal / Bottom Sheet

```
Background: #ffffff
Border Radius: 16px 16px 0 0 (bottom sheet)
Padding: 20px
Max Height: 85% screen
Handle: 36x4px, #E5E5EA, centered top
```

---

## Screen Layouts

### 1. Recording Screen (Dictate Tab)

```
┌─────────────────────────┐
│  Header: "Dictate"      │  ← 44px
├─────────────────────────┤
│                         │
│    [Waveform Area]      │  ← 60px, centered
│                         │
│    [00:45]              │  ← Timer, 28px Bold
│                         │
│         [●]             │  ← Record button, 72px
│                         │
│    [Input Mode Toggle]  │  ← Voice / Upload
│                         │
│    [Example Prompts]    │  ← Scrollable chips
│                         │
├─────────────────────────┤
│  Tab Bar                 │  ← 56px
└─────────────────────────┘
```

### 2. Notes History Screen

```
┌─────────────────────────┐
│  Header: "History"      │  ← 44px
├─────────────────────────┤
│  [Search Bar]           │  ← 40px
│  [All | Ideas | Tasks]  │  ← Filter chips
├─────────────────────────┤
│  ┌───────────────────┐  │
│  │ Note Card 1       │  │  ← Swipe to delete
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ Note Card 2       │  │
│  └───────────────────┘  │
│  ...                    │
├─────────────────────────┤
│  Tab Bar                 │
└─────────────────────────┘
```

### 3. AI Agent Chat Screen

```
┌─────────────────────────┐
│  Header: "AI Agent"     │
├─────────────────────────┤
│  [User Message Bubble]  │  ← Right aligned, accent
│  [AI Response Bubble]   │  ← Left aligned, gray
│  ...                    │
│  [User Message Bubble]  │
│  [AI Response Bubble]   │
├─────────────────────────┤
│  [Text Input] [Send]    │  ← 56px
├─────────────────────────┤
│  Tab Bar                 │
└─────────────────────────┘
```

---

## Animations

### Principles
- **Duration**: 200-300ms for most transitions
- **Easing**: `ease-out` for entrances, `ease-in` for exits
- **Feedback**: Haptic feedback on button presses (iOS/Android)

### Key Animations

| Interaction | Animation |
|------------|-----------|
| Record button tap | Scale 0.95 → 1.0, 100ms |
| Card appear | Fade in + slide up, 200ms |
| Tab switch | Crossfade, 150ms |
| Modal open | Slide up from bottom, 300ms |
| Delete swipe | Card slides right, reveal red delete |
| Waveform | Real-time bar height mapping, 50ms update |

---

## Iconography

### Library
Use **Lucide React Native** (`lucide-react-native`) for consistency with the web app.

### Common Icons

| Icon | Usage | Size |
|------|-------|------|
| `Mic` | Record button | 32px |
| `Square` | Stop recording | 24px |
| `Play` / `Pause` | Audio playback | 20px |
| `Trash2` | Delete action | 20px |
| `Search` | Search bar | 20px |
| `Sparkles` | AI features | 20px |
| `ListTodo` | Tasks tab | 24px |
| `History` | History tab | 24px |
| `Settings` | Settings tab | 24px |
| `Bot` | AI Agent tab | 24px |
| `Send` | Chat send | 20px |
| `Upload` | Text upload | 20px |

---

## Accessibility

### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|---------------|
| **Color Contrast** | Minimum 4.5:1 for body text, 3:1 for large text |
| **Touch Targets** | Minimum 44x44pt (iOS), 48x48dp (Android) |
| **Dynamic Type** | Support iOS Dynamic Type and Android font scaling |
| **VoiceOver/TalkBack** | Proper accessibility labels on all interactive elements |
| **Reduced Motion** | Respect `prefers-reduced-motion` setting |

### React Native Accessibility Props

```typescript
<TouchableOpacity
  accessibilityLabel="Record voice note"
  accessibilityRole="button"
  accessibilityHint="Starts voice recording for AI transcription"
>
```

---

## Platform-Specific Guidelines

### iOS Specific

| Element | Guideline |
|---------|-----------|
| Navigation | Large title style on main screens |
| Safe Areas | Respect notch, home indicator, status bar |
| Haptics | Light impact on button press, success on save |
| Gestures | Swipe back for navigation, swipe delete on cards |
| Status Bar | Dark content on light background |

### Android Specific

| Element | Guideline |
|---------|-----------|
| Navigation | Material 3 bottom navigation |
| Ripple Effect | Material ripple on touch |
| Gestures | Swipe back from edge, long press for context menu |
| Status Bar | Match app background color |
| Back Button | Hardware back button navigation |

---

## Dark Mode

Toggle via settings. Respects system preference if set to "system".

### Implementation

```typescript
// Detect system theme
import { useColorScheme } from 'react-native';

const scheme = useColorScheme(); // 'light' | 'dark' | null
const isDark = scheme === 'dark' || settings.theme === 'dark';
```

### Dark Mode Color Mapping

```typescript
const colors = isDark ? {
  bgApp: '#0f172a',
  bgCard: '#1e293b',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  borderColor: '#334155',
  bgInput: '#334155',
} : {
  bgApp: '#F2F2F7',
  bgCard: '#ffffff',
  textPrimary: '#1C1C1E',
  textSecondary: '#5a5a60',
  borderColor: '#E5E5EA',
  bgInput: '#F2F2F7',
};
```

---

## Design Assets

### Required Assets

| Asset | Size | Format | Purpose |
|-------|------|--------|---------|
| App Icon | 1024x1024 | PNG | App Store / Play Store |
| Adaptive Icon | 1024x1024 | PNG | Android foreground |
| Splash Screen | 1242x2208 | PNG | Launch screen |
| Favicon | 64x64 | PNG | Web fallback |

### Splash Screen Design

```
Background: #F2F2F7
Center: NoteWave logo (waveform icon + "NoteWave" text)
Logo Color: Accent blue (#3b82f6)
Text: Inter Bold, 32px
```

---

## Offline Mode UI Components

### 1. Sync Status Badge

Small indicator shown on each note card to display sync state.

```
Size: 16x16
Position: Top-right corner of note card
Border Radius: 8px (circle)
```

| Status | Color | Icon | Background |
|--------|-------|------|-----------|
| **Synced** | `#10b981` (green) | Checkmark | `rgba(16, 185, 129, 0.15)` |
| **Pending** | `#f59e0b` (amber) | Clock | `rgba(245, 158, 11, 0.15)` |
| **Conflict** | `#f97316` (orange) | Warning triangle | `rgba(249, 115, 22, 0.15)` |
| **Local Only** | `#3b82f6` (blue) | Lock | `rgba(59, 130, 246, 0.15)` |
| **Offline** | `#94a3b8` (gray) | WiFi-off | `rgba(148, 163, 184, 0.15)` |

### 2. Offline Banner

Top banner shown when app detects no network connectivity.

```
Height: 48px
Background: #fef3c7 (amber-100)
Text: #92400e (amber-900)
Font: 14px Medium
Icon: WiFi-off (16px)
Position: Below status bar, above header
Dismissable: Yes (tap X or swipe down)
```

**Content:**
```
┌─────────────────────────────────────┐
│  📡 Offline Mode  [Sync When Online] │  ← X
└─────────────────────────────────────┘
```

**Behavior:**
- Auto-shows when network is lost
- Disappears when network is restored and sync completes
- "Sync When Online" button triggers manual sync attempt
- Can be dismissed, but reappears on next screen change if still offline

### 3. Sync Progress Indicator

Shown during active sync operations.

```
Height: 3px (progress bar at top of screen)
Color: Accent color (default #3b82f6)
Animation: Indeterminate progress (moving gradient)
```

**Alternative (bottom sheet):**
```
┌─────────────────────────────────────┐
│  Syncing...                         │
│  ████████████░░░░░░  65%           │
│  13 of 20 notes synced             │
└─────────────────────────────────────┘
```

### 4. Pending Sync Counter

Badge on the History tab showing count of pending notes.

```
Position: Top-right of tab label
Size: 18x18 (circle)
Background: #f59e0b (amber)
Text: White, 11px Bold
Minimum: Show only if count > 0
Maximum: Show "9+" for 10+ pending
```

### 5. Conflict Resolution Screen

Dedicated screen for resolving sync conflicts.

```
┌─────────────────────────────────────┐
│  Sync Conflicts (3)            [←]  │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │  "Project Meeting Notes"      │  │
│  │                               │  │
│  │  Modified on both devices     │  │
│  │  Last local: 2 min ago        │  │
│  │  Last cloud: 5 min ago        │  │
│  │                               │  │
│  │  [Keep Local]  [Use Cloud]    │  │
│  │  [Merge Manually]             │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  "Shopping List"              │  │
│  │  ...                          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 6. Settings - Offline Section

Add to Settings screen:

```
┌─────────────────────────────────────┐
│  Offline & Sync                     │
├─────────────────────────────────────┤
│  ☑ Cloud Sync              [TOGGLE] │
│  ☑ Auto-Sync When Online   [TOGGLE] │
│  ☐ Wi-Fi Only              [TOGGLE] │
│  ☐ Delete Local After Sync [TOGGLE] │
│  ☐ Force Offline Mode      [TOGGLE] │
│                                    │
│  Storage Usage                     │
│  Notes: 2.3 MB of 100 MB          │
│  Audio: 145 MB of 500 MB          │
│                                    │
│  [Clear Local Audio Cache]         │
│  [Sync Now]                        │
└─────────────────────────────────────┘
```

### 7. Note Card with Offline States

Updated note card design showing sync status:

```
┌─────────────────────────────────────┐
│  [●]  ← Sync status badge          │
│  Meeting Notes with Team            │  ← Title
│  Discussed Q3 roadmap and...        │  ← Summary
│                                     │
│  📋 Ideas    ⏱️ 2:34    📅 Today   │
│                                     │
│  ─────────────────────────          │  ← Divider
│  ☐ Review proposal      ☑ Send doc  │  ← Action items
└─────────────────────────────────────┘
```

---

## Consistency Checklist

- [ ] All screens use `#F2F2F7` background (light mode)
- [ ] All cards use `#ffffff` with 12px border radius
- [ ] All primary buttons use accent color
- [ ] All text uses Inter font family
- [ ] All icons are from Lucide library
- [ ] All touch targets are minimum 44x44pt
- [ ] All screens respect safe areas
- [ ] All interactive elements have accessibility labels
- [ ] Dark mode colors are properly mapped
- [ ] Accent color is customizable and applied consistently
- [ ] Sync status badges are shown on all note cards
- [ ] Offline banner appears when network is lost
- [ ] Pending sync counter is shown on History tab
- [ ] Conflict resolution screen is accessible from Settings
- [ ] Offline settings are clearly labeled in Settings screen
