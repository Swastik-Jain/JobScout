"""
Jobs routes
  GET  /fetch-jobs    — trigger live job scan (Serper + Gemini)
  GET  /jobs          — list saved jobs from DB
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.db import get_session
from app.models.models import UserProfile, JobMatch, ApplicationHistory
from app.api.deps import profile_to_dict

router = APIRouter()


@router.get("/fetch-jobs")
async def get_jobs(session: Session = Depends(get_session)):
    from app.agents.job_finder_agent import run_job_finder_agent

    user = session.exec(select(UserProfile)).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="Complete your profile first before scanning for jobs.",
        )

    # Clear stale job listings + orphaned application history
    old_jobs = session.exec(select(JobMatch)).all()
    old_job_ids = {j.id for j in old_jobs}
    for j in old_jobs:
        session.delete(j)

    old_apps = session.exec(select(ApplicationHistory)).all()
    for a in old_apps:
        if a.job_id in old_job_ids:
            session.delete(a)

    session.commit()

    # Derive job role from profile
    profile_dict = profile_to_dict(user)
    skills = profile_dict.get("skills") or []
    headline = profile_dict.get("headline") or ""

    if skills:
        job_role = skills[0]
    elif headline:
        job_role = " ".join(headline.split()[:3])
    else:
        job_role = "Software Developer"

    print(f"[fetch-jobs] Searching for: '{job_role}'")
    jobs_data = await run_job_finder_agent(job_role=job_role, user_profile=profile_dict)

    saved_jobs = []
    for job_dict in jobs_data:
        try:
            job = JobMatch(**job_dict)
            session.add(job)
            saved_jobs.append(job)
        except Exception as e:
            print(f"[fetch-jobs] Skipping malformed job: {e}")

    session.commit()
    for j in saved_jobs:
        session.refresh(j)
    return saved_jobs


@router.get("/jobs")
def list_saved_jobs(session: Session = Depends(get_session)):
    """Return all saved jobs from DB, sorted by match_score descending."""
    return session.exec(
        select(JobMatch).order_by(JobMatch.match_score.desc())
    ).all()
