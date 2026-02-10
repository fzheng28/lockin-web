# Lock In

Live focus coaching + tab discipline, wrapped in a calm studio vibe. An AI-powered productivity app that helps you stay focused and avoid distractions.

## Features

- **Live Focus Session** — Real-time AI coaching via webcam and microphone. The AI monitors your session (gaze, posture, phone usage, talking) and gives playful feedback when you get distracted.
- **Tab Guard** — Chrome extension for tab discipline. Monitor tabs, flag distraction patterns, and apply soft blocks (“glass wall”) or hard blocks based on your rules.
- **Focus modes** — Choose between Live (camera + audio) or Tab (extension-based) monitoring.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express
- **AI:** Google Gemini API for behavioral analysis and proctoring

## Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini)

## Running Locally

### 1. Install dependencies

```bash
npm install
cd backend && npm install && cd ..
```

### 2. Environment variables

Create a `backend/.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Optional:

- `GEMINI_MODEL` — Model name (default: `gemini-3-flash-preview`)
- `PORT` — Server port (default: `3001`)
- `CORS_ORIGINS` — Comma-separated allowed origins (empty = allow all)

### 3. Build and run

```bash
npm run deploy-start
```

This builds the React app and starts the Express server. Open [http://localhost:3001](http://localhost:3001).

### 4. Optional: development with hot reload

For frontend-only changes with hot reload:

```bash
# Terminal 1: backend
cd backend && node server.js

# Terminal 2: frontend (from project root)
npm run build && npm run dev
```

Then open [http://localhost:5173](http://localhost:5173). For API calls to work, either run the backend on the same port as Vite or add a proxy in `vite.config.ts` for `/api`.

---

## Running Remotely (Deployment)

The app is designed to run on platforms like [Render](https://render.com).

### Deploy on Render

1. Create a new **Web Service** and connect your repo.
2. Configure:
   - **Build Command:** `npm install && cd backend && npm install && cd .. && npm run build`
   - **Start Command:** `cd backend && node server.js`
   - **Environment variables:** Set `GEMINI_API_KEY` in the Render dashboard.
3. Deploy. The service will serve both the static frontend and API from a single origin.

### Environment variables (production)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `PORT` | No | Port (Render sets this automatically) |
| `GEMINI_MODEL` | No | Model name (default: `gemini-3-flash-preview`) |
| `CORS_ORIGINS` | No | Allowed origins (e.g. `https://yourapp.com`) |

### Live deployment

Current live app: [https://lockin-web.onrender.com](https://lockin-web.onrender.com)

---

## Chrome Extension (Tab Guard)

The Lock In Chrome extension is in `public/lock-in-extension/`. To install:

1. Download `public/lock-in-extension.zip` or load `public/lock-in-extension/lockedIn-main/` as an unpacked extension.
2. In Chrome: `chrome://extensions` → Enable Developer mode → Load unpacked (or drag the zip).
3. Ensure the extension’s backend URL matches your deployed or local API (see `background.js` `BACKEND_BASE_URL`).

---

## Project structure

```
lockin-web/
├── backend/           # Express server, API, serves built frontend
│   ├── server.js
│   └── public/        # Vite build output
├── src/               # React app
│   ├── components/    # WelcomeScreen, LiveSession, TabSession, ModeSelection
│   └── hooks/         # useProctoring (camera, audio, AI)
├── public/
│   └── lock-in-extension/  # Chrome extension
└── package.json       # Root deps + scripts
```

## Collaborators
- **Chunrong Huang**
- **Fengyi Zheng**
