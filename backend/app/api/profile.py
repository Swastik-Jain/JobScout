"""
Profile routes
  GET   /profile/me
  PUT   /profile/me
  POST  /profile/analyze-repos    (SSE stream)
  POST  /profile                  (legacy)
  PUT   /profile/{profile_id}
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from sqlalchemy.orm.attributes import flag_modified

from app.core.db import get_session, engine
from app.core.security import decode_token
from app.models.models import UserProfile, JobMatch
from app.api.deps import profile_to_dict

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    headline: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    skills: Optional[List[str]] = None
    experience: Optional[List[dict]] = None
    projects: Optional[List[dict]] = None
    education: Optional[List[dict]] = None
    github_repos: Optional[List[dict]] = None


class RepoAnalysisRequest(BaseModel):
    repo_links: List[str]
    email: str


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/profile/me")
def get_my_profile(token: str, session: Session = Depends(get_session)):
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token.")
    user = session.exec(select(UserProfile).where(UserProfile.email == email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return profile_to_dict(user)


@router.put("/profile/me")
def update_my_profile(
    req: ProfileUpdateRequest,
    token: str,
    session: Session = Depends(get_session),
):
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token.")
    user = session.exec(select(UserProfile).where(UserProfile.email == email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found.")

    if req.name is not None:
        user.name = req.name
    if req.phone is not None:
        user.phone = req.phone
    if req.headline is not None:
        user.headline = req.headline
    if req.github_url is not None:
        user.github_url = req.github_url
    if req.linkedin_url is not None:
        user.linkedin_url = req.linkedin_url
    if req.skills is not None:
        user.skills = list(req.skills)
        flag_modified(user, "skills")
    if req.experience is not None:
        user.experience = list(req.experience)
        flag_modified(user, "experience")
    if req.projects is not None:
        user.projects = list(req.projects)
        flag_modified(user, "projects")
    if req.education is not None:
        user.education = list(req.education)
        flag_modified(user, "education")
    if req.github_repos is not None:
        user.github_repos = list(req.github_repos)
        flag_modified(user, "github_repos")

    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)
    return profile_to_dict(user)


@router.post("/profile/analyze-repos")
async def analyze_repos(req: RepoAnalysisRequest, session: Session = Depends(get_session)):
    """
    Streams terminal logs + Gemini analysis result for GitHub repo links.
    Returns SSE-compatible text/event-stream.
    """
    from app.agents.repo_agent import stream_repo_analysis

    user = session.exec(select(UserProfile).where(UserProfile.email == req.email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    async def event_generator():
        async for chunk in stream_repo_analysis(req.repo_links):
            yield f"data: {chunk}\n\n"
            await asyncio.sleep(0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/profile")
def create_profile(profile: UserProfile, session: Session = Depends(get_session)):
    """Legacy endpoint — upserts a full UserProfile object."""
    existing = session.exec(
        select(UserProfile).where(UserProfile.email == profile.email)
    ).first()
    if existing:
        existing.skills = profile.skills
        existing.experience = profile.experience
        existing.projects = profile.projects
        existing.education = profile.education
        session.add(existing)
        profile = existing
    else:
        session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


async def _recalculate_job_queue_scores(profile_id: int):
    from app.agents.job_finder_agent import rank_enriched_jobs
    with Session(engine) as session:
        user = session.get(UserProfile, profile_id)
        if not user:
            return
        jobs = session.exec(select(JobMatch)).all()
        if not jobs:
            return
        jobs_dict_list = [
            {
                "title": j.title, "company": j.company, "platform": j.platform,
                "url": j.url, "snippet": j.description,
            }
            for j in jobs
        ]
        rescored_jobs = await rank_enriched_jobs(jobs_dict_list, user.dict())
        for scored_job in rescored_jobs:
            db_job = next(
                (j for j in jobs
                 if j.title == scored_job.get("title") and j.company == scored_job.get("company")),
                None,
            )
            if db_job:
                db_job.match_score = scored_job.get("match_score", 0)
                db_job.justification = scored_job.get("justification")
                db_job.key_requirements = scored_job.get("key_requirements", [])
        session.commit()


@router.put("/profile/{profile_id}")
def update_profile(
    profile_id: int,
    profile_data: UserProfile,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    user = session.get(UserProfile, profile_id)
    if not user:
        raise HTTPException(status_code=404)
    user.projects = profile_data.projects
    user.experience = profile_data.experience
    session.commit()
    session.refresh(user)
    background_tasks.add_task(_recalculate_job_queue_scores, user.id)
    return user
