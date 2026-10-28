"""
Resume & Apply routes
  POST  /generate-resume
  POST  /apply
  GET   /applications
  WS    /logs
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.db import get_session
from app.models.models import UserProfile, Job, JobMatch
from app.api.deps import get_current_user, profile_to_dict
from app.agents.orchestrator import orchestrator

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class ResumeRequest(BaseModel):
    job_id: int
    critic_comment: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/generate-resume")
async def generate_resume(
    req: ResumeRequest = None,
    job_id: int = 1,
    critic_comment: Optional[str] = None,
    current_user: UserProfile = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Support both JSON body and query params
    if req:
        job_id = req.job_id
        critic_comment = req.critic_comment

    job = session.get(Job, job_id) or session.get(JobMatch, job_id)

    job_target = (
        job.dict()
        if job
        else {
            "id": job_id,
            "title": "Target Role",
            "company": "Target Company",
            "description": "Target job description.",
        }
    )

    initial_state = {
        "user_profile": profile_to_dict(current_user),
        "selected_job": job_target,
        "jobs": [],
        "resume_md": "",
        "ats_score": 0.0,
        "critic_feedback": critic_comment or "",
        "status": "start",
        "logs": [],
    }
    result = await orchestrator.ainvoke(initial_state)
    return {
        "resume_md": result["resume_md"],
        "ats_score": result["ats_score"],
        "logs": result["logs"],
        "improvements": result.get("improvements", []),
    }



@router.websocket("/logs")
async def websocket_logs(websocket: WebSocket):
    from app.utils.log_generator import generate_agent_logs
    await websocket.accept()
    try:
        async for msg in generate_agent_logs():
            await websocket.send_json({"log": msg})
    except WebSocketDisconnect:
        print("Client disconnected")
