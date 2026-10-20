"""
Health & Stats routes
  GET  /api/health
  GET  /api/stats      (also aliased as /stats)
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.db import get_session
from app.models.models import JobMatch, ApplicationHistory

router = APIRouter()


@router.get("/api/health")
def health_check():
    return {"status": "ok"}


@router.get("/api/stats")
def get_stats(session: Session = Depends(get_session)):
    """Public endpoint — returns real activity stats for the landing page."""
    total_jobs = session.exec(select(JobMatch)).all()
    total_apps = session.exec(select(ApplicationHistory)).all()

    avg_ats = 0.0
    if total_apps:
        avg_ats = sum(a.ats_score for a in total_apps) / len(total_apps)

    platforms = list({j.platform for j in total_jobs if j.platform})

    return {
        "jobs_scanned": len(total_jobs),
        "applications_submitted": len(total_apps),
        "avg_ats_score": round(avg_ats, 1),
        "platforms_active": len(platforms) if platforms else 0,
        "system_status": "Operational",
    }


# Backward-compatible alias
@router.get("/stats")
def get_stats_alias(session: Session = Depends(get_session)):
    return get_stats(session)
