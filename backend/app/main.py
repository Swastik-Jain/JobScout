"""
Application entry point
━━━━━━━━━━━━━━━━━━━━━━
Creates the FastAPI app, wires up CORS, startup events, and includes
all domain routers. Business logic lives in app/api/*.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import init_db

from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.profile import router as profile_router
from app.api.jobs import router as jobs_router
from app.api.resume import router as resume_router

app = FastAPI(title="Autonomous Job Application System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(jobs_router)
app.include_router(resume_router)
