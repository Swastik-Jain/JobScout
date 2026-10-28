# JobScout Frontend (Web)

Interactive, real-time client application for **JobScout** — the Autonomous Job Search, ATS Match Optimization, and Application Management platform.

---

## 🚀 Key Features & Pages

- **Mission Control (`src/pages/MissionControl.tsx`)**:
  - Full application lifecycle tracker with Kanban and list views.
  - Strict atomic state transitions (`saved` ➔ `prepared` ➔ `applied` ➔ `interviewing` ➔ `offered` / `rejected`).
  - Integrated Review & Edit Modal for tailored resumes, cover notes, and interview Q&A cards before applying.
  - DOCX and Markdown resume export triggers.

- **Candidate Profile & Repo Intelligence (`src/pages/Profile.tsx`)**:
  - Structured profile editing (target role, location preferences, seniority, verified technical skills, work history).
  - Real-time GitHub repository inspection via Server-Sent Events (SSE) with stream buffer chunking to prevent dropped events.

- **Client-Side Heuristic Fraud Guard (`src/lib/fraudHeuristics.tsx`)**:
  - Transparent, client-side pattern matching inspecting job metadata for recruitment scams.
  - Flags high-risk signals: wire transfer requests, advance-fee equipment purchases, Telegram/WhatsApp-only interview channels, P2P payment methods, unrealistic compensation lures.
  - Risk tiers: `BLOCKED` (≥60% risk score), `WARNING` (≥25%), and `SAFE`.

- **Live Streaming Logs & Console (`src/contexts/TerminalContext.tsx`)**:
  - Real-time WebSocket terminal displaying agent reasoning steps, ATS feed synchronization progress, and evaluation metrics.

---

## 🛠️ Technology Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/)
- **Styling**: TailwindCSS utility classes + Custom Dark Glassmorphism Design System
- **Animation**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **HTTP Client**: [Axios](https://axios-http.com/) with automatic JWT Bearer token injection

---

## 💻 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file in `frontend/web/` if custom endpoints are needed:
```env
VITE_API_URL=http://localhost:8000
```
*(By default, Vite proxies `/api` and `/ws` to `http://localhost:8000` via `vite.config.ts`)*.

### 3. Run Dev Server
```bash
npm run dev
```

### 4. Verification & Linting
```bash
# Type check TypeScript project
npx tsc -b

# Run ESLint rules
npm run lint

# Production build bundle
npm run build
```
