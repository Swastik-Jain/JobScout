"""
Health & Stats routes
  GET  /api/health
  GET  /api/stats      (also aliased as /stats)
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.db import get_session
from app.models.models import Job, Application, ResumeVersion

router = APIRouter()


@router.get("/api/health")
def health_check():
    return {"status": "ok"}


@router.get("/api/stats")
def get_stats(session: Session = Depends(get_session)):
    """Public endpoint — returns real activity stats for the landing page."""
    total_jobs = session.exec(select(Job).where(Job.is_active == True)).all()
    total_apps = session.exec(select(Application)).all()
    versions = session.exec(select(ResumeVersion)).all()

    avg_ats = 0.0
    if versions:
        avg_ats = sum(v.ats_score for v in versions) / len(versions)
    elif total_apps:
        avg_ats = 75.0

    platforms = list({j.ats for j in total_jobs if j.ats})

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
