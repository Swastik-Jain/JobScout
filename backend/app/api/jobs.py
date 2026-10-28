"""
Jobs routes
  GET   /fetch-jobs      — trigger fast job scan (queries IngestedJob DB + Gemini scoring)
  GET   /jobs            — list saved jobs from DB
  POST  /jobs/sync       — trigger background ATS feed synchronization
  POST  /jobs/discover   — trigger offline ATS company source discovery via Serper
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select

from app.core.db import get_session
from app.models.models import UserProfile, Job, JobScore, JobMatch, CompanySource
from app.api.deps import get_current_user, profile_to_dict
from app.tools.ats_adapters import sync_all_active_sources
from app.agents.job_finder_agent import run_job_finder_agent, discover_new_ats_sources_offline

router = APIRouter()


@router.get("/fetch-jobs")
async def get_jobs(
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Fast, reliable job scan:
    - Queries active verified positions in the Job catalog database
    - Applies word-boundary matching and hard seniority/location filters
    - Enriches descriptions for top candidates and scores with Gemini
    - Saves per-user JobScore and returns verified listings without wiping applications
    """
    # Derive job role from profile
    profile_dict = profile_to_dict(current_user)
    skills = profile_dict.get("skills") or []
    headline = profile_dict.get("headline") or ""

    if skills:
        job_role = skills[0]
    elif headline:
        job_role = " ".join(headline.split()[:3])
    else:
        job_role = "Software Developer"

    print(f"[fetch-jobs] Searching for: '{job_role}' for user {current_user.email}")
    jobs_data = await run_job_finder_agent(job_role=job_role, user_profile=profile_dict, session=session)

    # Persist scores in JobScore for this user without deleting Application records
    for job_dict in jobs_data:
        jid = job_dict.get("id")
        if jid:
            existing_score = session.exec(
                select(JobScore).where(JobScore.user_id == current_user.id, JobScore.job_id == jid)
            ).first()
            if existing_score:
                existing_score.match_score = float(job_dict.get("match_score", 0))
                existing_score.justification = str(job_dict.get("justification", ""))
                existing_score.key_requirements = job_dict.get("key_requirements", [])
                session.add(existing_score)
            else:
                score = JobScore(
                    user_id=current_user.id,
                    job_id=jid,
                    match_score=float(job_dict.get("match_score", 0)),
                    justification=str(job_dict.get("justification", "")),
                    key_requirements=job_dict.get("key_requirements", []),
                )
                session.add(score)

    session.commit()
    return jobs_data


@router.get("/jobs")
def list_saved_jobs(
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Return all scored active jobs for the current user, sorted by match_score descending."""
    scores = session.exec(
        select(JobScore).where(JobScore.user_id == current_user.id).order_by(JobScore.match_score.desc())
    ).all()
    
    results = []
    for s in scores:
        job = session.get(Job, s.job_id)
        if job and job.is_active:
            results.append({
                "id": job.id,
                "external_id": job.external_id,
                "title": job.title,
                "company": job.company,
                "description": job.description,
                "location": job.location,
                "platform": job.ats.title(),
                "url": job.url,
                "match_score": s.match_score,
                "justification": s.justification,
                "key_requirements": s.key_requirements,
            })
    return results


@router.post("/jobs/sync")
async def sync_feeds(background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    """Background synchronization of all active ATS company sources."""
    background_tasks.add_task(sync_all_active_sources, session)
    return {"message": "ATS feed synchronization started in background."}


@router.post("/jobs/discover")
async def discover_sources(session: Session = Depends(get_session)):
    """Trigger offline scheduled ATS source discovery via Serper."""
    count = await discover_new_ats_sources_offline(session)
    return {"message": f"Discovery complete. Discovered {count} new verified company ATS sources."}
