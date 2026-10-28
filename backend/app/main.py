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
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    init_db()
    # Launch background ATS feed ingestion if database is fresh
    import asyncio
    from app.core.db import engine
    from sqlmodel import Session, select
    from app.models.models import IngestedJob
    from app.tools.ats_adapters import sync_all_active_sources

    async def _bg_initial_sync():
        with Session(engine) as session:
            has_jobs = session.exec(select(IngestedJob)).first()
            if not has_jobs:
                print("[Startup] IngestedJob table empty. Initiating first-time background feed sync...")
                await sync_all_active_sources(session)

    asyncio.create_task(_bg_initial_sync())



from fastapi import Request
from fastapi.responses import JSONResponse
import traceback


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    logging.exception("Unhandled server exception on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred."},
    )


# ── Routers ───────────────────────────────────────────────────────────────────
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.profile import router as profile_router
from app.api.jobs import router as jobs_router
from app.api.resume import router as resume_router
from app.api.applications import router as applications_router

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(jobs_router)
app.include_router(resume_router)
app.include_router(applications_router)

