# 🎯 JobScout AI

An AI-powered, multi-agent platform that autonomously discovers jobs, tailors ATS-optimised resumes, and tracks applications — all in real time.

---

## 🏗️ Project Structure

```
JobScout/
├── backend/          # FastAPI + LangGraph + Gemini agents
│   ├── app/
│   │   ├── agents/   # job_finder, resume, repo, orchestrator
│   │   ├── api/
│   │   ├── core/     # DB init, config
│   │   ├── models/
│   │   ├── tools/
│   │   └── main.py
│   ├── requirements.txt
│   ├── Procfile
│   └── .env.example
└── frontend/
    └── web/          # React + Vite + TypeScript + TailwindCSS
        ├── src/
        ├── vite.config.ts
        └── .env.example
```

---

## 🚀 Quick Start (Local)

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in your API keys
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend/web
npm install
npm run dev                     # starts at http://localhost:5173
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite path (default: `sqlite:///./jobscout.db`) |
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) key for Gemini |
| `SERPER_API_KEY` | [Serper.dev](https://serper.dev) key for job search |
| `GITHUB_TOKEN` | (Optional) GitHub Personal Access Token for verified repo inspections & higher rate limits |
| `SECRET_KEY` | JWT signing secret — **use a long random string in production** |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (default: localhost) |

### Frontend (`frontend/web/.env.local`)

| Variable | Description |
|---|---|
| `VITE_BACKEND_URL` | Backend URL (only needed in production, default: `http://localhost:8000`) |

---

## 🌐 Deployment

### Backend → Render / Railway / Fly.io
- Set all env vars from `backend/.env.example`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set `ALLOWED_ORIGINS` to your Vercel frontend URL
- For Render, prefer the repo `render.yaml` blueprint so the service builds from `backend/`
- If you configure Render manually, set `Root Directory` to `backend`

### Frontend → Vercel / Netlify
- Build command: `npm run build`
- Output dir: `dist`
- Set `VITE_BACKEND_URL` to your deployed backend URL

---

## 🧠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, Framer Motion |
| Backend | FastAPI, LangGraph, SQLModel (SQLite) |
| AI Agents | Google Gemini 1.5 Flash / Pro |
| Job Search | Serper.dev API |
| Auth | JWT (python-jose) + bcrypt |

---

## 📄 License
MIT
