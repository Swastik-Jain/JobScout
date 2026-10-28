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
from app.models.models import UserProfile, JobMatch
from app.api.deps import profile_to_dict, get_current_user

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    headline: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    preferred_location: Optional[str] = None
    seniority_level: Optional[str] = None
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
def get_my_profile(
    current_user: UserProfile = Depends(get_current_user),
):
    return profile_to_dict(current_user)


@router.put("/profile/me")
def update_my_profile(
    req: ProfileUpdateRequest,
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    user = session.get(UserProfile, current_user.id)
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
    if req.preferred_location is not None:
        user.preferred_location = req.preferred_location
    if req.seniority_level is not None:
        user.seniority_level = req.seniority_level
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

    return profile_to_dict(user)


@router.post("/profile/analyze-repos")
async def analyze_repos(
    req: RepoAnalysisRequest,
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Streams terminal logs + Gemini analysis result for GitHub repo links.
    Returns SSE-compatible text/event-stream for the authenticated user.
    """
    from app.agents.repo_agent import stream_repo_analysis

    async def event_generator():
        async for chunk in stream_repo_analysis(req.repo_links):
            yield f"data: {chunk}\n\n"
            await asyncio.sleep(0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.put("/profile/{profile_id}")
def update_profile(
    profile_id: int,
    profile_data: ProfileUpdateRequest,
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Update profile by ID. Strictly enforces user ownership and uses sanitized ProfileUpdateRequest DTO."""
    if current_user.id != profile_id:
        raise HTTPException(status_code=403, detail="You do not have permission to modify this profile.")
    return update_my_profile(req=profile_data, current_user=current_user, session=session)


