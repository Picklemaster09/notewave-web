# NoteWave - AI Voice Notes & Tasks

> Record voice notes, get AI-powered transcriptions, action items, and task management. Powered by Gemini AI.

## Quick Start

```bash
npm install
npm run dev
```

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | Complete project architecture, tech stack, and features |
| [`docs/BACKEND_API.md`](docs/BACKEND_API.md) | Backend API reference - all endpoints, auth flow, Supabase schema |
| [`docs/ANDROID_APP_RECIPE.md`](docs/ANDROID_APP_RECIPE.md) | Step-by-step Android app build guide (React Native + Expo) |
| [`docs/IOS_APP_RECIPE.md`](docs/IOS_APP_RECIPE.md) | Step-by-step iOS app build guide (React Native + Expo) |
| [`docs/DESIGN_GUIDELINES.md`](docs/DESIGN_GUIDELINES.md) | Mobile UI design system - colors, typography, components |

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Cloudflare Worker (single edge API)
- **Auth**: Auth0 (PKCE flow, RS256 JWT)
- **AI**: Google Gemini (primary) + OpenAI (fallback)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2 (audio files)

## Auth0 Applications

| Platform | Client ID | Type |
|----------|-----------|------|
| Web | `<YOUR_WEB_CLIENT_ID>` | SPA |
| Android | `<YOUR_ANDROID_CLIENT_ID>` | Native |
| iOS | `<YOUR_IOS_CLIENT_ID>` | Native |

## Project Structure

```
notewave-web/
├── worker.js                 # Backend API (Cloudflare Worker)
├── src/                      # React frontend
│   ├── App.tsx               # Main app
│   ├── config.ts             # API + Auth0 config
│   ├── authToken.ts          # Token management
│   ├── supabase.ts           # API service layer
│   └── components/           # UI components
├── docs/                     # Mobile app build recipes
└── .env.example              # Environment template
```

## Building Mobile Apps

See the [`docs/`](docs/) directory for complete build recipes:

- **Android**: React Native + Expo + Auth0 Native SDK
- **iOS**: React Native + Expo + Auth0 Native SDK + Face ID
- **Design**: Clean, light theme matching the web dashboard

## API

All API calls go through the Cloudflare Worker you have deployed.

See [`docs/BACKEND_API.md`](docs/BACKEND_API.md) for the full endpoint reference.

## License

Private - All rights reserved.